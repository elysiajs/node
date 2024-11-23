/* eslint-disable sonarjs/no-duplicated-branches */
/* eslint-disable sonarjs/no-nested-switch */
/* eslint-disable sonarjs/no-duplicate-string */
import { serialize } from 'cookie'

import type { IncomingMessage, ServerResponse } from 'http'
import { Readable } from 'stream'

import { isNotEmpty, StatusMap } from 'elysia/utils'
import { Cookie, serializeCookie } from 'elysia/cookies'
import { ElysiaCustomStatusResponse } from 'elysia/error'
import { ElysiaFile } from 'elysia/universal/file'
import { mergeResponseWithSetHeaders } from 'elysia/adapter/web-standard/handler'

import type { Context } from 'elysia/context'
import type { HTTPHeaders, Prettify } from 'elysia/types'

import type { ReadStream } from 'fs'

type SetResponse = Prettify<
	Omit<Context['set'], 'status'> & {
		status: number
	}
>

export type ElysiaNodeResponse = [
	response: unknown,
	set: Omit<Context['set'], 'headers' | 'status'> & {
		headers?: Omit<HTTPHeaders, 'content-length'> & {
			'content-length'?: number
		}

		status: number
	}
]

const handleFile = (
	response: File | Blob,
	set?: Context['set'],
	res?: HttpResponse
): ElysiaNodeResponse => {
	const size = response.size

	if (set) {
		let setHeaders: Record<string, any>

		if (set.headers instanceof Headers) {
			setHeaders = {
				'accept-ranges': 'bytes',
				'content-range': `bytes 0-${size - 1}/${size}`,
				'transfer-encoding': 'chunked'
			}

			// @ts-ignore
			for (const [key, value] of (set.headers as Headers).entries())
				if (key in set.headers) setHeaders[key] = value
		} else if (isNotEmpty(set.headers)) {
			Object.assign(
				{
					'accept-ranges': 'bytes',
					'content-range': `bytes 0-${size - 1}/${size}`,
					'transfer-encoding': 'chunked'
				},
				set.headers
			)

			setHeaders = set.headers
		}
	}

	if (res)
		return response.arrayBuffer().then((arrayBuffer) => {
			set!.headers['content-type'] = response.type
			set!.headers['content-range'] =
				`bytes 0-${arrayBuffer.byteLength - 1}/${arrayBuffer.byteLength}`

			delete set?.headers['content-length']

			const nodeBuffer = Buffer.from(arrayBuffer)

			res.writeHead(set!.status as number, set!.headers)
			res.end(nodeBuffer)

			return [nodeBuffer, set]
		}) as any

	return [response, set] as ElysiaNodeResponse
}

const handleElysiaFile = (
	response: ElysiaFile,
	set?: SetResponse,
	res?: HttpResponse
) => {
	let headers
	let status

	if (!set) {
		headers = {
			'accept-range': 'bytes',
			'content-type': (response as ElysiaFile).type,
			'content-range': `bytes 0-${(response as ElysiaFile).length - 1}/${(response as ElysiaFile).length}`
		}

		if (res) res.writeHead(200, headers)

		status = 200
	} else {
		Object.assign(set.headers, {
			'accept-range': 'bytes',
			'content-type': (response as ElysiaFile).type,
			'content-range': `bytes 0-${(response as ElysiaFile).length - 1}/${(response as ElysiaFile).length}`
		})

		if (res) res.writeHead(set.status, set.headers)

		status = set.status
		headers = set.headers
	}

	if (res) {
		;((response as ElysiaFile).value as ReadStream).pipe(res)
	}

	return [
		response,
		{
			status,
			headers: headers as any
		}
	] satisfies ElysiaNodeResponse
}

const handleStream = (
	generator: Generator | AsyncGenerator,
	set?: Context['set'],
	res?: HttpResponse
): ElysiaNodeResponse => {
	if (!set)
		set = {
			status: 200,
			headers: {
				'transfer-encoding': 'chunked',
				'content-type': 'text/event-stream;charset=utf8'
			}
		}
	else {
		set.headers['transfer-encoding'] = 'chunked'
		set.headers['content-type'] = 'text/event-stream;charset=utf8'
	}

	if (res) res.writeHead(set.status as number, set.headers)

	return [handleStreamResponse(generator, set, res), set as any]
}

export const handleStreamResponse = (
	generator: Generator | AsyncGenerator,
	set?: Context['set'],
	res?: HttpResponse
) => {
	const readable = new Readable({
		read() {}
	})

	if (res) readable.pipe(res)
	;(async () => {
		let init = generator.next()
		if (init instanceof Promise) init = await init

		if (init.done) {
			if (set) return mapResponse(init.value, set, res)
			return mapCompactResponse(init.value, res)
		}

		// abortSignal?.addEventListener('abort', () => {
		// 	end = true

		// 	try {
		// 		readable.push(null)
		// 	} catch {
		// 		// nothing
		// 	}
		// })

		if (init.value !== undefined && init.value !== null) {
			if (typeof init.value === 'object')
				try {
					readable.push(Buffer.from(JSON.stringify(init.value)))
				} catch {
					readable.push(Buffer.from(init.value.toString()))
				}
			else readable.push(Buffer.from(init.value.toString()))
		}

		for await (const chunk of generator) {
			if (chunk === undefined || chunk === null) continue

			if (typeof chunk === 'object')
				try {
					readable.push(Buffer.from(JSON.stringify(chunk)))
				} catch {
					readable.push(Buffer.from(chunk.toString()))
				}
			else readable.push(Buffer.from(chunk.toString()))

			// Wait for the next event loop
			// Otherwise the data will be mixed up
			await new Promise<void>((resolve) => setTimeout(() => resolve(), 0))
		}

		readable.push(null)
	})()

	return readable
}

export async function* streamResponse(response: Response) {
	const body = response.body

	if (!body) return

	const reader = body.getReader()
	const decoder = new TextDecoder()

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			yield decoder.decode(value)
		}
	} finally {
		reader.releaseLock()
	}
}

type HttpResponse = ServerResponse<IncomingMessage> & {
	req: IncomingMessage
}

export const mapResponse = (
	response: unknown,
	set: Context['set'],
	res?: HttpResponse
): ElysiaNodeResponse => {
	if (isNotEmpty(set.headers) || set.status !== 200 || set.cookie) {
		if (typeof set.status === 'string') set.status = StatusMap[set.status]

		if (set.cookie && isNotEmpty(set.cookie)) {
			const cookie = serializeCookie(set.cookie)

			if (cookie) set.headers['set-cookie'] = cookie
		}
	}

	switch (response?.constructor?.name) {
		case 'String':
			set.headers['content-type'] = 'text/plain;charset=utf8'

			if (res) {
				set.headers['content-length'] = (response as string).length
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'Array':
		case 'Object':
			response = JSON.stringify(response)

			set.headers['content-type'] = 'application/json;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'ElysiaFile':
			return handleElysiaFile(response as ElysiaFile, set as any, res)

		case 'File':
		case 'Blob':
			set.headers['content-length'] = (response as File | Blob)
				.size as any

			return handleFile(response as File | Blob, set, res)

		case 'ElysiaCustomStatusResponse':
			set.status = (response as ElysiaCustomStatusResponse<200>).code

			return mapResponse(
				(response as ElysiaCustomStatusResponse<200>).response,
				set,
				res
			)

		case 'ReadableStream':
			if (!set.headers['content-type']?.startsWith('text/event-stream'))
				set.headers['content-type'] = 'text/event-stream;charset=utf8'

			// Already set by Node
			// set.headers['transfer-encoding'] = 'chunked'

			if (res) {
				res.writeHead(set.status!, set.headers)
				readableStreamToReadable(response as ReadableStream).pipe(res)
			}

			// abortSignal?.addEventListener(
			// 	'abort',
			// 	{
			// 		handleEvent() {
			// 			if (!abortSignal.aborted)
			// 				(response as ReadableStream).cancel()
			// 		}
			// 	},
			// 	{
			// 		once: true
			// 	}
			// )

			return [response as ReadableStream, set as any]

		case undefined:
			if (!response) {
				if (res) {
					set.headers['content-length'] = 0
					set.headers['content-type'] = 'text/plain;charset=utf8'
					res.writeHead(set.status!, set.headers)
					res.end('')
				}

				return ['', set as any]
			}

			response = JSON.stringify(response)

			set.headers['content-type'] = 'application/json;charset=utf8'
			set.headers['content-length'] = (response as string)?.length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'Response':
			mergeResponseWithSetHeaders(response as Response, set)

			if (
				(response as Response).headers.get('transfer-encoding') ===
				'chunked'
			)
				return handleStream(
					streamResponse(response as Response),
					set,
					res
				) as any

			return [
				responseToValue(response as Response, res, set as SetResponse),
				set as any
			]

		case 'Error':
			return errorToResponse(response as Error, set, res)

		case 'Promise':
			return (response as Promise<any>).then((x) =>
				mapResponse(x, set, res)
			) as any

		case 'Function':
			return mapResponse((response as Function)(), set, res)

		case 'Number':
		case 'Boolean':
			response = (response as number | boolean).toString()

			set.headers['content-type'] = 'text/plain;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'Cookie':
			if (response instanceof Cookie)
				return mapResponse(response.value, set, res)

			return mapResponse(response?.toString(), set, res)

		case 'FormData':
			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response as FormData, set as any]

		default:
			if (response instanceof Response) {
				mergeResponseWithSetHeaders(response as Response, set)

				return [
					responseToValue(
						response as Response,
						res,
						set as SetResponse
					),
					set as any
				]
			}

			if (response instanceof Promise)
				return response.then((x) => mapResponse(x, set, res)) as any

			if (response instanceof Error)
				return errorToResponse(response as Error, set, res)

			if (response instanceof ElysiaCustomStatusResponse) {
				set.status = (response as ElysiaCustomStatusResponse<200>).code

				return mapResponse(
					(response as ElysiaCustomStatusResponse<200>).response,
					set,
					res
				)
			}

			if (response instanceof ElysiaFile)
				return handleElysiaFile(response as ElysiaFile, set as any, res)

			// @ts-expect-error
			if (typeof response?.next === 'function')
				return handleStream(response as any, set, res)

			// @ts-expect-error
			if (typeof response?.then === 'function')
				// @ts-expect-error
				return response.then((x) => mapResponse(x, set, res)) as any

			// @ts-expect-error
			if (typeof response?.toResponse === 'function')
				return mapResponse((response as any).toResponse(), set, res)

			if ('charCodeAt' in (response as any)) {
				const code = (response as any).charCodeAt(0)

				if (code === 123 || code === 91) {
					if (!set.headers['Content-Type'])
						set.headers['content-type'] =
							'application/json;charset=utf8'

					response = JSON.stringify(response)
					set.headers['content-length'] = (response as string).length

					if (res) {
						res.writeHead(set.status!, set.headers)
						res.end(response)
					}

					return [response, set as any]
				}
			}

			set.headers['content-type'] = 'text/plain;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response as any, set as any]
	}
}

export const mapEarlyResponse = (
	response: unknown,
	set: Context['set'],
	res?: HttpResponse
): ElysiaNodeResponse | undefined => {
	if (response === undefined || response === null) return

	if (isNotEmpty(set.headers) || set.status !== 200 || set.cookie) {
		if (typeof set.status === 'string') set.status = StatusMap[set.status]

		if (set.cookie && isNotEmpty(set.cookie)) {
			const cookie = serializeCookie(set.cookie)

			if (cookie) set.headers['set-cookie'] = cookie
		}
	}

	switch (response?.constructor?.name) {
		case 'String':
			set.headers['content-type'] = 'text/plain;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'Array':
		case 'Object':
			response = JSON.stringify(response)

			set.headers['content-type'] = 'application/json;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]

		case 'ElysiaFile':
			return handleElysiaFile(response as ElysiaFile, set as any, res)

		case 'File':
		case 'Blob':
			return handleFile(response as File | Blob, set, res)

		case 'ElysiaCustomStatusResponse':
			set.status = (response as ElysiaCustomStatusResponse<200>).code

			return mapEarlyResponse(
				(response as ElysiaCustomStatusResponse<200>).response,
				set,
				res
			)

		case 'ReadableStream':
			if (!set.headers['content-type']?.startsWith('text/event-stream'))
				set.headers['content-type'] = 'text/event-stream;charset=utf8'

			if (res) {
				res.writeHead(set.status!, set.headers)
				readableStreamToReadable(response as ReadableStream).pipe(res)
			}

			// abortSignal?.addEventListener(
			// 	'abort',
			// 	{
			// 		handleEvent() {
			// 			if (!abortSignal?.aborted)
			// 				(response as ReadableStream).cancel()
			// 		}
			// 	},
			// 	{
			// 		once: true
			// 	}
			// )

			return [response as ReadableStream, set as any]

		case undefined:
			if (!response) {
				set.headers['content-length'] = 0 as any

				if (res) {
					res.writeHead(set.status!, set.headers)
					res.end(response)
				}

				return ['', set as any]
			}

			response = JSON.stringify(response)

			set.headers['content-type'] = 'application/json;charset=utf8'
			set.headers['content-length'] = (response as string).length

			return [response, set as any]

		case 'Response':
			mergeResponseWithSetHeaders(response as Response, set)

			if (
				(response as Response).headers.get('transfer-encoding') ===
				'chunked'
			)
				return handleStream(
					streamResponse(response as Response),
					set,
					res
				) as any

			return [
				responseToValue(response as Response, res, set as SetResponse),
				set as any
			]

		case 'Error':
			return errorToResponse(response as Error, set, res)

		case 'Promise':
			return (response as Promise<unknown>).then((x) =>
				mapEarlyResponse(x, set, res)
			) as any

		case 'Function':
			return mapEarlyResponse((response as Function)(), set, res)

		case 'Number':
		case 'Boolean':
			response = (response as number | boolean).toString()

			set.headers['content-type'] = 'text/plain;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response as number | boolean, set as any]

		case 'Cookie':
			if (response instanceof Cookie)
				return mapEarlyResponse(response.value, set, res)

			return mapEarlyResponse(response?.toString(), set, res)

		case 'FormData':
			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response as FormData, set as any]

		default:
			if (response instanceof Response) {
				mergeResponseWithSetHeaders(response as Response, set)

				return [
					responseToValue(response, res, set as SetResponse),
					set as any
				]
			}

			if (response instanceof Promise)
				return response.then((x) =>
					mapEarlyResponse(x, set, res)
				) as any

			if (response instanceof Error)
				return errorToResponse(response as Error, set, res)

			if (response instanceof ElysiaCustomStatusResponse) {
				set.status = (response as ElysiaCustomStatusResponse<200>).code

				return mapEarlyResponse(
					(response as ElysiaCustomStatusResponse<200>).response,
					set,
					res
				)
			}

			// @ts-ignore
			if (typeof response?.next === 'function')
				return handleStream(response as any, set, res)

			// @ts-expect-error
			if (typeof response?.then === 'function')
				// @ts-expect-error
				return response.then((x) =>
					mapEarlyResponse(x, set, res)
				) as any

			// @ts-expect-error
			if (typeof response?.toResponse === 'function')
				return mapEarlyResponse(
					(response as any).toResponse(),
					set,
					res
				)

			if ('charCodeAt' in (response as any)) {
				const code = (response as any).charCodeAt(0)

				if (code === 123 || code === 91) {
					response = JSON.stringify(response)

					if (!set.headers['Content-Type'])
						set.headers['content-type'] =
							'application/json;charset=utf8'
					set.headers['content-length'] = (response as string).length

					if (res) {
						res.writeHead(set.status!, set.headers)
						res.end(response)
					}

					return [response, set as any]
				}
			}

			set.headers['content-type'] = 'text/plain;charset=utf8'
			set.headers['content-length'] = (response as string).length

			if (res) {
				res.writeHead(set.status!, set.headers)
				res.end(response)
			}

			return [response, set as any]
	}
}

export const mapCompactResponse = (
	response: unknown,
	res?: HttpResponse
): ElysiaNodeResponse => {
	return mapResponse(
		response,
		{
			status: 200,
			headers: {}
		},
		res
	)

	// switch (response?.constructor?.name) {
	// 	case 'String':
	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'text/plain;charset=utf8',
	// 				'content-length': (response as string).length
	// 			})
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'text/plain;charset=utf8',
	// 					'content-length': (response as string).length
	// 				}
	// 			}
	// 		]

	// 	case 'Array':
	// 	case 'Object':
	// 		response = JSON.stringify(response)

	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'application/json;charset=utf8',
	// 				'content-length': (response as string).length
	// 			})
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'application/json;charset=utf8',
	// 					'content-length': (response as string).length
	// 				}
	// 			}
	// 		]

	// 	case 'ElysiaFile':
	// 		return handleElysiaFile(response as ElysiaFile, undefined, res)

	// 	case 'Blob':
	// 		if (res) {
	// 			res.writeHead(200)
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response as File | Blob,
	// 			{
	// 				status: 200
	// 			}
	// 		]

	// 	case 'ElysiaCustomStatusResponse':
	// 		return mapResponse(
	// 			(response as ElysiaCustomStatusResponse<200>).response,
	// 			{
	// 				status: (response as ElysiaCustomStatusResponse<200>).code,
	// 				headers: {}
	// 			},
	// 			res
	// 		)

	// 	case 'ReadableStream':
	// 		// abortSignal?.addEventListener(
	// 		// 	'abort',
	// 		// 	{
	// 		// 		handleEvent() {
	// 		// 			if (!abortSignal?.aborted)
	// 		// 				(response as ReadableStream).cancel()
	// 		// 		}
	// 		// 	},
	// 		// 	{
	// 		// 		once: true
	// 		// 	}
	// 		// )
	// 		//
	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'text/event-stream;charset=utf8'
	// 			})
	// 			readableStreamToReadable(response as ReadableStream).pipe(res)
	// 		}

	// 		return [
	// 			response as ReadableStream,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'Content-Type': 'text/event-stream;charset=utf8'
	// 				}
	// 			}
	// 		]

	// 	case undefined:
	// 		if (!response) {
	// 			if (res) {
	// 				res.writeHead(200, {
	// 					'content-type': 'text/plain;charset=utf8',
	// 					'content-length': 0
	// 				})
	// 				res.end('')
	// 			}

	// 			return [
	// 				'',
	// 				{
	// 					status: 200,
	// 					headers: {
	// 						'content-type': 'text/plain;charset=utf8',
	// 						'content-length': 0 as any
	// 					}
	// 				}
	// 			]
	// 		}

	// 		response = JSON.stringify(response)

	// 		res?.writeHead(200, {
	// 			'content-type': 'application/json;charset=utf8',
	// 			'content-length': (response as string).length
	// 		})

	// 		return [
	// 			response,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'application/json;charset=utf8',
	// 					'content-length': (response as string).length
	// 				}
	// 			}
	// 		]

	// 	case 'Response':
	// 		if (
	// 			(response as Response).headers.get('transfer-encoding') ===
	// 			'chunked'
	// 		)
	// 			return handleStream(
	// 				streamResponse(response as Response),
	// 				undefined,
	// 				res
	// 			) as any

	// 		const set = {
	// 			status: 200,
	// 			headers: {}
	// 		}

	// 		return [responseToValue(response as Response, res, set), set]

	// 	case 'Error':
	// 		return errorToResponse(response as Error, undefined, res)

	// 	case 'Promise':
	// 		// @ts-ignore
	// 		return (response as any as Promise<unknown>).then((x) =>
	// 			mapCompactResponse(x, res)
	// 		)

	// 	// ? Maybe response or Blob
	// 	case 'Function':
	// 		return mapCompactResponse((response as Function)(), res)

	// 	case 'Number':
	// 	case 'Boolean':
	// 		response = (response as number | boolean).toString()

	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'text/plain;charset=utf8',
	// 				'content-length': (response as string).length
	// 			})
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'text/plain;charset=utf8',
	// 					'content-length': (response as string).length
	// 				}
	// 			}
	// 		]

	// 	case 'Cookie':
	// 		if (response instanceof Cookie)
	// 			return mapCompactResponse(response.value, res)

	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'text/plain;charset=utf8',
	// 				'content-length': response?.toString()
	// 			})
	// 			res.end(response?.toString())
	// 		}

	// 		return [
	// 			response?.toString(),
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'text/plain;charset=utf8'
	// 				}
	// 			}
	// 		]

	// 	case 'FormData':
	// 		if (res) {
	// 			res.writeHead(200)
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response as FormData,
	// 			{
	// 				status: 200,
	// 				headers: {}
	// 			}
	// 		]

	// 	default:
	// 		if (response instanceof Response) {
	// 			const set = {
	// 				status: 200,
	// 				headers: {}
	// 			}

	// 			return [responseToValue(response, res, set), set]
	// 		}

	// 		if (response instanceof Promise)
	// 			return response.then((x) => mapCompactResponse(x, res)) as any

	// 		if (response instanceof Error)
	// 			return errorToResponse(response as Error, undefined, res)

	// 		if (response instanceof ElysiaCustomStatusResponse)
	// 			return mapResponse(
	// 				(response as ElysiaCustomStatusResponse<200>).response,
	// 				{
	// 					status: (response as ElysiaCustomStatusResponse<200>)
	// 						.code,
	// 					headers: {}
	// 				},
	// 				res
	// 			)

	// 		if (response instanceof ElysiaFile)
	// 			return handleElysiaFile(response as ElysiaFile, undefined, res)

	// 		// @ts-expect-error
	// 		if (typeof response?.next === 'function')
	// 			return handleStream(response as any, undefined, res)

	// 		// @ts-expect-error
	// 		if (typeof response?.then === 'function')
	// 			// @ts-expect-error
	// 			return response.then((x) => mapCompactResponse(x, res)) as any

	// 		// @ts-expect-error
	// 		if (typeof response?.toResponse === 'function')
	// 			return mapCompactResponse((response as any).toResponse(), res)

	// 		if ('charCodeAt' in (response as any)) {
	// 			const code = (response as any).charCodeAt(0)

	// 			if (code === 123 || code === 91) {
	// 				response = JSON.stringify(response)

	// 				if (res) {
	// 					res.writeHead(200, {
	// 						'content-type': 'application/json;charset=utf8',
	// 						'content-length': (response as string).length
	// 					})
	// 					res.end(response)
	// 				}

	// 				return [response, { status: 200 } as any]
	// 			}
	// 		}

	// 		if (res) {
	// 			res.writeHead(200, {
	// 				'content-type': 'text/plain;charset=utf8',
	// 				'content-length': (response as string).length
	// 			})
	// 			res.end(response)
	// 		}

	// 		return [
	// 			response as any,
	// 			{
	// 				status: 200,
	// 				headers: {
	// 					'content-type': 'text/plain;charset=utf8'
	// 				}
	// 			}
	// 		]
	// }
}

export const errorToResponse = (
	error: Error,
	set?: Context['set'],
	res?: HttpResponse
) => {
	const response = JSON.stringify({
		name: error?.name,
		message: error?.message,
		cause: error?.cause
	})
	let status: number = set?.status as number
	if (!status) status = 500
	if (set?.status === 200) status = 500

	let headers = set?.headers
	if (!headers)
		headers = {
			'content-length': response.length as any,
			'content-type': 'application/json;charset=utf8'
		}
	else {
		headers['content-length'] = response.length
		headers['content-type'] = 'application/json;charset=utf8'
	}

	if (res) {
		res.writeHead(status, headers)
		res.end(response)
	}

	return [
		response,
		{
			status,
			headers: headers as any
		}
	] as const satisfies ElysiaNodeResponse
}

export const readableStreamToReadable = (webStream: ReadableStream) =>
	new Readable({
		async read() {
			const reader = webStream.getReader()

			try {
				// eslint-disable-next-line no-constant-condition
				while (true) {
					const { done, value } = await reader.read()

					if (done) break

					this.push(Buffer.from(value))
				}
			} catch (error) {
				this.destroy(error as Error)
			}
		}
	})

export const responseToValue = (
	r: Response,
	res: HttpResponse | undefined,
	set: SetResponse
) => {
	responseHeaderToNodeHeader(r, set, res)

	if (res) res.statusCode = r.status

	return r
		.arrayBuffer()
		.then((buffer) => {
			set.headers['content-length'] = buffer.byteLength

			if (res) res.end(Buffer.from(buffer))

			return buffer
		})
		.catch((error) => errorToResponse(error, undefined, res))
}

const responseHeaderToNodeHeader = (
	response: Response,
	set: SetResponse,
	res?: HttpResponse
) => {
	if (set.status !== response.status) set.status = response.status

	// @ts-ignore
	for (const x of response.headers.entries()) {
		set.headers[x[0]] = x[1]
		if (res) res.setHeader(x[0], x[1])
	}
}
