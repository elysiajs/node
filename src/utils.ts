import { FastResponse as Response } from 'srvx'
import type { ReadStream } from 'fs'

import { isNotEmpty, StatusMap } from 'elysia/utils'
import type { Context } from 'elysia/context'
import {
	createStreamHandler,
	responseToSetHeaders,
	streamResponse
} from 'elysia/adapter/utils'

export const handleFile = (
	response: ReadStream | File | Blob,
	set?: Context['set']
): Response => {
	if (response instanceof Promise)
		return response.then((res) => handleFile(res, set)) as any

	// @ts-ignore
	const size = response.size
	const immutable =
		set &&
		(set.status === 206 ||
			set.status === 304 ||
			set.status === 412 ||
			set.status === 416)

	const defaultHeader = immutable
		? {
				'transfer-encoding': 'chunked'
			}
		: ({
				'accept-ranges': 'bytes',
				'content-range': size
					? `bytes 0-${size - 1}/${size}`
					: undefined,
				'transfer-encoding': 'chunked'
			} as any)

	if (!set && !size) return new Response(response as Blob)

	if (!set)
		return new Response(response as Blob, {
			headers: defaultHeader
		})

	if (set.headers instanceof Headers) {
		let setHeaders: Record<string, any> = defaultHeader

		setHeaders = {}
		// @ts-ignore
		for (const [key, value] of set.headers.entries())
			if (key in set.headers) setHeaders[key] = value

		if (immutable) {
			delete set.headers['content-length']
			delete set.headers['accept-ranges']
		}

		return new Response(response as Blob, {
			status: set.status as number,
			headers: setHeaders
		})
	}

	if (isNotEmpty(set.headers))
		return new Response(response as Blob, {
			status: set.status as number,
			headers: Object.assign(defaultHeader, set.headers)
		})

	return new Response(response as Blob, {
		status: set.status as number,
		headers: defaultHeader
	})
}

interface CreateHandlerParameter {
	mapResponse(
		response: unknown,
		set: Context['set'],
		request?: Request
	): Response
	mapCompactResponse(response: unknown, request?: Request): Response
}

// Merge header by allocating a new one
// In Bun, response.headers can be mutable
// while in Node and Cloudflare Worker is not
// default to creating a new one instead
export function mergeHeaders(
	responseHeaders: Headers,
	setHeaders: Context['set']['headers']
) {
	// @ts-ignore
	const headers = new Headers(Object.fromEntries(responseHeaders.entries()))

	// Merge headers: Response headers take precedence, set.headers fill in non-conflicting ones
	if (setHeaders instanceof Headers)
		// @ts-ignore
		for (const key of setHeaders.keys()) {
			if (key === 'set-cookie') {
				if (headers.has('set-cookie')) continue

				for (const cookie of setHeaders.getSetCookie())
					headers.append('set-cookie', cookie)
			} else if (!responseHeaders.has(key))
				headers.set(key, setHeaders?.get(key) ?? '')
		}
	else
		for (const key in setHeaders)
			if (key === 'set-cookie')
				headers.append(key, setHeaders[key] as any)
			else if (!responseHeaders.has(key))
				headers.set(key, setHeaders[key] as any)

	return headers
}

export function mergeStatus(
	responseStatus: number,
	setStatus: Context['set']['status']
) {
	if (typeof setStatus === 'string') setStatus = StatusMap[setStatus]

	if (responseStatus === 200) return setStatus

	return responseStatus
}

export const createResponseHandler = (handler: CreateHandlerParameter) => {
	const handleStream = createStreamHandler(handler)

	return (response: Response, set: Context['set'], request?: Request) => {
		const newResponse = new Response(response.body, {
			headers: mergeHeaders(response.headers, set.headers),
			status: mergeStatus(response.status, set.status)
		})

		if (
			!(newResponse as Response).headers.has('content-length') &&
			(newResponse as Response).headers.get('transfer-encoding') ===
				'chunked'
		)
			return handleStream(
				streamResponse(newResponse as Response),
				responseToSetHeaders(newResponse as Response, set),
				request,
				// @ts-ignore
				true // don't auto-format SSE for pre-formatted Response
			) as any

		return newResponse
	}
}
