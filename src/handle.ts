import { FastResponse as Response } from 'srvx'

import {
	createResponseHandler,
	createStreamHandler,
	handleFile,
	handleSet,
	materializeSetHeaders
} from 'elysia/adapter/utils'
import { ElysiaFile, mime } from 'elysia/universal/file'
import { formToFormData, isElysiaForm, isNotEmpty } from 'elysia/utils'
import {
	ElysiaStatus,
	internalServerErrorBody,
	PROBLEM_JSON
} from 'elysia/error'

import type { Context } from 'elysia/context'
import type { MaybePromise } from 'elysia/types'

const textPlainInit = {
	headers: [['content-type', 'text/plain']]
} as unknown as ResponseInit

const jsonInit = {
	headers: { 'content-type': 'application/json' }
} as const

function json(response: unknown): Response {
	const body = JSON.stringify(response)
	if (body === undefined)
		throw new TypeError('Value is not JSON serializable')

	return new Response(body, jsonInit)
}

const defaultHeaders = '\0'

// FastResponse reads init when Node writes the response, so it gets a copy.
// an afterResponse hook can still change set by then
function withSet(
	body: unknown,
	set?: Context['set'],
	contentType?: string
): Response {
	if (!set) return new Response(body as BodyInit)

	const source = set.headers as unknown
	let headers: Headers | Record<string, unknown>

	if (source instanceof Headers) {
		headers = new Headers(source)
		if (contentType && !headers.get('content-type'))
			headers.set('content-type', contentType)
	} else {
		const copy = (headers = { ...(source as Record<string, unknown>) })

		let hasContentType = !contentType
		for (const key in copy) {
			if (!Object.hasOwn(copy, key)) continue

			const value = copy[key]
			if (Array.isArray(value)) copy[key] = value.slice()

			if (
				value &&
				key.length === 12 &&
				key.toLowerCase() === 'content-type'
			)
				hasContentType = true
		}

		if (!hasContentType) copy['content-type'] = contentType
	}

	return new Response(body as BodyInit, { ...set, headers } as ResponseInit)
}

function handleElysiaFile(
	file: ElysiaFile,
	set: Context['set'] = {
		headers: {}
	},
	request?: Request
) {
	const path = file.path
	const contentType =
		mime[
			path
				.slice(path.lastIndexOf('.') + 1)
				.toLowerCase() as any as keyof typeof mime
		]

	const headers = materializeSetHeaders(set)
	if (contentType) headers['content-type'] = contentType

	const stats = file.stats
	if (stats)
		return stats.then((stat) => {
			const size = stat.size as number
			const status = set.status
			const immutable =
				status === 206 ||
				status === 304 ||
				status === 412 ||
				status === 416

			if (size !== undefined && !immutable)
				headers['content-length'] = size

			if (request?.headers.get('range'))
				return handleFile(file, set, request, size)

			if (!immutable) {
				headers['accept-ranges'] ??= 'bytes'
				if (size)
					headers['content-range'] ??= `bytes 0-${size - 1}/${size}`
			}

			return withSet(file.value, set)
		}) as any

	return handleFile(file.value as any, set, request)
}

function responseTag(response: unknown) {
	if (typeof response === 'string') return 'String'
	if (response == null) return

	const constructor = Object.getPrototypeOf(response)?.constructor
	// a generator's constructor is not callable
	if (typeof constructor !== 'function')
		// @ts-expect-error
		return typeof response.next === 'function' ? '' : undefined

	return constructor.name
}

function mapResponseWithSet(
	response: unknown,
	set: Context['set'],
	request?: Request,
	owned?: boolean
): Response {
	handleSet(set)

	switch (responseTag(response)) {
		case 'String':
			return withSet(response, set, 'text/plain')

		case 'Array':
			return Response.json(response, set as ResponseInit)

		case 'ElysiaForm':
			return withSet(
				formToFormData(response as Record<string, unknown>),
				set
			)

		case 'Object':
			// @ts-expect-error
			if (typeof response?.next === 'function')
				return handleStream(
					response as any,
					set,
					request,
					undefined,
					owned
				) as any

			return Response.json(response, set as ResponseInit)

		case 'Number':
		case 'Boolean':
			return withSet((response as number | boolean).toString(), set)

		case 'ElysiaFile':
			return handleElysiaFile(response as ElysiaFile, set, request)

		case 'File':
		case 'Blob':
			return handleFile(response as Blob, set, request)

		case 'ElysiaStatus':
			set.status = (response as ElysiaStatus<200>).status
			if ((response as ElysiaStatus<200>).headers)
				Object.assign(
					materializeSetHeaders(set),
					(response as ElysiaStatus<200>).headers
				)

			return mapResponseWithSet(
				(response as ElysiaStatus<200>).response,
				set,
				request,
				owned
			)

		case undefined:
			return response
				? Response.json(response, set as ResponseInit)
				: withSet(null, set)

		case 'Response':
			return handleResponse(response as Response, set, request, owned)

		case 'Error':
			return errorToResponse(response as Error, set, request, owned)

		case 'Promise':
			return (response as Promise<any>).then((x) =>
				mapResponseWithSet(x, set, request, owned)
			) as any

		case 'Function':
			return mapResponseWithSet(
				(response as Function)(),
				set,
				request,
				owned
			)

		case 'FormData':
			return withSet(response, set)

		default:
			return mapFallback(response, set, request, owned) as Response
	}
}

export function mapResponse(
	response: unknown,
	set: Context['set'],
	request?: Request,
	owned?: boolean
): Response {
	const headers = set.headers
	if (
		set.status !== undefined ||
		set.cookie ||
		(headers as any)[defaultHeaders] === headers ||
		isNotEmpty(headers)
	)
		return mapResponseWithSet(response, set, request, owned)

	if (response instanceof ElysiaStatus) {
		set.status = (response as ElysiaStatus<200>).status
		if ((response as ElysiaStatus<200>).headers)
			Object.assign(set.headers, (response as ElysiaStatus<200>).headers)

		return mapResponse(
			(response as ElysiaStatus<200>).response,
			set,
			request,
			owned
		)
	}

	if (response instanceof Response)
		return owned
			? handleResponse(response, undefined, request, true)
			: response

	if (response instanceof Promise)
		return (response as Promise<any>).then((x) =>
			mapResponse(x, set, request, owned)
		) as any

	// Stream response defers a 'set' API, assume that it may include 'set'
	if (
		// @ts-expect-error
		typeof response?.next === 'function' ||
		response instanceof ReadableStream
	)
		return handleStream(
			response as any,
			set,
			request,
			undefined,
			owned
		) as any

	return mapCompactResponse(response, request, owned)
}

export function mapCompactResponse(
	response: unknown,
	request?: Request,
	owned?: boolean
): Response {
	switch (responseTag(response)) {
		case 'String':
			return new Response(response as string, textPlainInit)

		case 'Array':
			return json(response)

		case 'ElysiaForm':
			return new Response(
				formToFormData(response as Record<string, unknown>)
			)

		case 'Object':
			return json(response)

		case 'Number':
		case 'Boolean':
			return new Response((response as number | boolean).toString())

		case 'ElysiaFile':
			return handleElysiaFile(response as ElysiaFile, undefined, request)

		case 'File':
		case 'Blob':
			return handleFile(response as File, undefined, request)

		case 'ElysiaStatus':
			return mapResponse(
				(response as ElysiaStatus<200>).response,
				{
					status: (response as ElysiaStatus<200>).status,
					headers: (response as ElysiaStatus<200>).headers
						? Object.assign(
								{},
								(response as ElysiaStatus<200>).headers
							)
						: {}
				} as Context['set'],
				request,
				owned
			)

		case undefined:
			return response ? json(response) : new Response('')

		case 'Response':
			return owned
				? handleResponse(response as Response, undefined, request, true)
				: (response as Response)

		case 'Error':
			return errorToResponse(response as Error, undefined, request, owned)

		case 'Promise':
			return (response as any as Promise<unknown>).then((x) =>
				mapCompactResponse(x, request, owned)
			) as any

		// ? Maybe response or Blob
		case 'Function':
			return mapCompactResponse((response as Function)(), request, owned)

		case 'FormData':
			return new Response(response as FormData)

		default:
			return mapFallback(response, undefined, request, owned) as Response
	}
}

export function errorToResponse(
	error: Error & { toResponse?(): MaybePromise<Response> },
	set?: Context['set'],
	request?: Request,
	owned = false
) {
	if (error?.toResponse) {
		const targetSet = set ?? ({ headers: {} } as Context['set'])

		const apply = (resolved: unknown) => {
			if (resolved instanceof Response) targetSet.status = resolved.status
			return mapResponse(resolved, targetSet, request, owned)
		}

		const raw = error.toResponse()

		// @ts-ignore
		return typeof raw?.then === 'function' ? raw.then(apply) : apply(raw)
	}

	const status =
		set?.status && set.status !== 200 ? (set.status as number) : 500

	const body = internalServerErrorBody(error)
	body.status = status

	const headers = (set ? materializeSetHeaders(set) : {}) as Record<
		string,
		string
	>
	headers['content-type'] = PROBLEM_JSON

	return new Response(JSON.stringify(body), { status, headers })
}

function mapFallback(
	response: unknown,
	set?: Context['set'],
	request?: Request,
	owned = false
): Response | undefined {
	// recheck Response, Promise, Error because some library may extends Response
	if (response instanceof Response)
		return handleResponse(response, set, request, owned)

	if (response instanceof Promise)
		return response.then((x) =>
			set
				? mapResponse(x, set, request, owned)
				: mapCompactResponse(x, request, owned)
		) as any

	if (response instanceof Error)
		return errorToResponse(response as Error, set, request, owned)

	if (response instanceof ElysiaStatus) {
		if (set) {
			set.status = response.status
			if (response.headers)
				set.headers = { ...set.headers, ...response.headers }
			return mapResponse(response.response, set, request, owned)
		} else
			return mapResponse(
				(response as ElysiaStatus<200>).response,
				{
					status: (response as ElysiaStatus<200>).status,
					headers: response.headers ? { ...response.headers } : {}
				} as Context['set'],
				request,
				owned
			)
	}

	if (response instanceof ElysiaFile)
		return handleElysiaFile(response as ElysiaFile, undefined, request)

	if (isElysiaForm(response))
		return withSet(formToFormData(response as Record<string, unknown>), set)

	if (
		// @ts-expect-error
		typeof response?.next === 'function' ||
		response instanceof ReadableStream
	)
		return handleStream(
			response as any,
			set,
			request,
			undefined,
			owned
		) as any

	if (typeof (response as Promise<unknown>)?.then === 'function')
		return (response as Promise<unknown>).then((x) =>
			set
				? mapResponse(x, set, request, owned)
				: mapCompactResponse(x, request, owned)
		) as any

	// custom class with an array-like value
	// eg. Bun.sql`` result
	if (Array.isArray(response)) return json(response) as any

	// @ts-expect-error
	if (typeof response?.toResponse === 'function')
		return set
			? mapResponse((response as any).toResponse(), set, request, owned)
			: mapCompactResponse((response as any).toResponse(), request, owned)

	// @ts-expect-error
	if (response?.constructor?.name === 'Cookie' && response.jar)
		// @ts-expect-error
		return withSet(response.value, set)

	return withSet(response, set)
}

const handleResponse = createResponseHandler()

const handleStream = createStreamHandler({
	mapResponse,
	mapCompactResponse
})
