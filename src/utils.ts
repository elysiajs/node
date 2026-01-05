import { FastResponse as Response } from 'srvx'
import type { ReadStream } from 'fs'

import { isNotEmpty } from 'elysia/utils'
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

export const createResponseHandler = (handler: CreateHandlerParameter) => {
	const handleStream = createStreamHandler(handler)

	return (response: Response, set: Context['set'], request?: Request) => {
		const newResponse = new Response(response.body, {
			headers: Object.assign(
				// @ts-ignore
				Object.fromEntries(response.headers.entries()),
				set.headers
			),
			status: response.status ?? set.status
		})

		if (
			!(newResponse as Response).headers.has('content-length') &&
			(newResponse as Response).headers.get('transfer-encoding') ===
				'chunked'
		)
			return handleStream(
				streamResponse(newResponse as Response),
				responseToSetHeaders(newResponse as Response, set),
				request
			) as any

		return newResponse
	}
}
