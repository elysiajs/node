import {
	getSchemaValidator,
	serializeCookie,
	ValidationError,
	type ElysiaAdapter
} from 'elysia'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'

import { defineHooks } from 'crossws'
import { serve } from 'crossws/server'

import {
	mapCompactResponse,
	mapEarlyResponse,
	mapResponse,
	createStaticHandler
} from './handle'

import type {
	Server as NodeServer,
	IncomingMessage,
	ServerResponse
} from 'http'
import type {
	Http2Server,
	Http2ServerRequest,
	Http2ServerResponse
} from 'http2'

import { isNotEmpty, isNumericString, randomId } from 'elysia/utils'
import type { Server } from 'elysia/universal'
import {
	createHandleWSResponse,
	createWSMessageParser,
	ElysiaWS
} from 'elysia/ws'
import { ServerWebSocket } from 'elysia/ws/bun'
import { parseSetCookies } from 'elysia/adapter/utils'

const toServerWebSocket = (ws: ServerWebSocket) => {
	// @ts-ignore, context.context is intentional
	// first context is srvx.context (alias of bun.ws.data)
	// second context is Elysia context
	ws.data = ws.context.context
	ws.sendText = ws.send
	ws.sendBinary = ws.send
	ws.publishText = ws.publish
	ws.publishBinary = ws.publish
	ws.isSubscribed = () => false
	// @ts-ignore
	ws.cork = () => {}
}

export const node = () => {
	const wsState: Record<string, unknown> = {}

	return {
		...WebStandardAdapter,
		name: 'node',
		handler: {
			mapCompactResponse,
			mapEarlyResponse,
			mapResponse,
			createStaticHandler
		},
		ws(app, path, options) {
			const { parse, body, response, ...rest } = options

			const validateMessage = getSchemaValidator(body, {
				// @ts-expect-error private property
				modules: app.definitions.typebox,
				// @ts-expect-error private property
				models: app.definitions.type as Record<string, TSchema>,
				normalize: app.config.normalize
			})

			const validateResponse = getSchemaValidator(response as any, {
				// @ts-expect-error private property
				modules: app.definitions.typebox,
				// @ts-expect-error private property
				models: app.definitions.type as Record<string, TSchema>,
				normalize: app.config.normalize
			})

			app.route(
				'WS',
				path as any,
				async (context: any) => {
					// ! Enable static code analysis just in case resolveUnknownFunction doesn't work, do not remove
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { set, path, qi, headers, query, params } = context

					const id = context.request.id

					// @ts-ignore
					context.validator = validateResponse

					if (options.upgrade) {
						if (typeof options.upgrade === 'function') {
							const temp = options.upgrade(context as any)
							if (temp instanceof Promise) await temp
						} else if (options.upgrade)
							Object.assign(
								set.headers,
								options.upgrade as Record<string, any>
							)
					}

					if (set.cookie && isNotEmpty(set.cookie)) {
						const cookie = serializeCookie(set.cookie)

						if (cookie) set.headers['set-cookie'] = cookie
					}

					if (
						set.headers['set-cookie'] &&
						Array.isArray(set.headers['set-cookie'])
					)
						set.headers = parseSetCookies(
							new Headers(set.headers as any) as Headers,
							set.headers['set-cookie']
						) as any

					const handleResponse =
						createHandleWSResponse(validateResponse)
					const parseMessage = createWSMessageParser(parse)

					let _id: string | undefined

					if (typeof options.beforeHandle === 'function') {
						const result = options.beforeHandle(context)
						if (result instanceof Promise) await result
					}

					const errorHandlers = [
						...(options.error
							? Array.isArray(options.error)
								? options.error
								: [options.error]
							: []),
						...(app.event.error ?? []).map((x) =>
							typeof x === 'function' ? x : x.fn
						)
					].filter((x) => x)

					const handleErrors = !errorHandlers.length
						? () => {}
						: async (ws: ServerWebSocket<any>, error: unknown) => {
								for (const handleError of errorHandlers) {
									let response = handleError(
										Object.assign(context, { error })
									)
									if (response instanceof Promise)
										response = await response

									await handleResponse(ws, response)

									if (response) break
								}
							}

					wsState[id] = {
						context,
						headers: isNotEmpty(set.headers)
							? (set.headers as Record<string, string>)
							: undefined,
						id,
						validator: validateResponse,
						ping(data?: unknown) {
							options.ping?.(data)
						},
						pong(data?: unknown) {
							options.pong?.(data)
						},
						open: async (ws: ServerWebSocket<any>) => {
							toServerWebSocket(ws)

							try {
								await handleResponse(
									ws,
									options.open?.(
										new ElysiaWS(ws, context as any)
									)
								)
							} catch (error) {
								handleErrors(ws, error)
							}
						},
						message: async (
							ws: ServerWebSocket<any>,
							_message: any
						) => {
							const message = await parseMessage(
								ws,
								_message.text()
							)

							if (validateMessage?.Check(message) === false)
								return void ws.send(
									new ValidationError(
										'message',
										validateMessage,
										message
									).message as string
								)

							try {
								await handleResponse(
									ws,
									options.message?.(
										new ElysiaWS(
											ws,
											context as any,
											message
										),
										message as any
									)
								)
							} catch (error) {
								handleErrors(ws, error)
							}
						},
						drain: async (ws: ServerWebSocket<any>) => {
							try {
								await handleResponse(
									ws,
									options.drain?.(
										new ElysiaWS(ws, context as any)
									)
								)
							} catch (error) {
								handleErrors(ws, error)
							}
						},
						close: async (
							ws: ServerWebSocket<any>,
							code: number,
							reason: string
						) => {
							try {
								await handleResponse(
									ws,
									options.close?.(
										new ElysiaWS(ws, context as any),
										code,
										reason
									)
								)
							} catch (error) {
								handleErrors(ws, error)
							}
						}
					}

					return ''
				},
				{
					...rest,
					websocket: options
				} as any
			)
		},
		listen(app) {
			return (options, callback) => {
				if (typeof options === 'string') {
					if (!isNumericString(options))
						throw new Error('Port must be a numeric value')

					options = parseInt(options)
				}

				const websocket = defineHooks({
					async upgrade(request) {
						// @ts-ignore
						const id = (request.id = randomId())

						const response = await app.handle(request)
						if (response.status >= 300) return response

						const ws = wsState[id]

						return {
							// @ts-ignore
							headers: ws!.headers,
							context: ws as any
						}
					},
					open(ws) {
						// @ts-ignore
						ws.context.open?.(ws)
					},
					message(ws, message) {
						// @ts-ignore
						ws.context.message?.(ws, message)
					}
				})

				const serverOptions =
					typeof options === 'number'
						? {
								port: options,
								websocket,
								fetch: app.fetch
							}
						: {
								...options,
								websocket,
								fetch: app.fetch
							}

				let server = serve(serverOptions)
				const nodeServer = server.node?.server as
					| NodeServer<typeof IncomingMessage, typeof ServerResponse>
					| Http2Server<
							typeof IncomingMessage,
							typeof ServerResponse,
							typeof Http2ServerRequest,
							typeof Http2ServerResponse
					  >
					| undefined

				// @ts-ignore
				const hostname = server.serveOptions.host ?? 'localhost'
				const port = server.options.port

				const serverInfo: Server = {
					...server,
					id: randomId(),
					development: process.env.NODE_ENV !== 'production',
					fetch: app.fetch,
					hostname,
					get pendingRequests() {
						const { promise, resolve, reject } =
							Promise.withResolvers<number>()

						nodeServer?.getConnections((error, total) => {
							if (error) reject(error)

							resolve(total)
						})

						return promise
					},
					get pendingWebSockets() {
						return 0
					},
					port,
					publish() {
						throw new Error(
							"This adapter doesn't support uWebSocket Publish method"
						)
					},
					ref() {
						nodeServer?.ref()
					},
					unref() {
						nodeServer?.unref()
					},
					reload() {
						nodeServer?.close()
						server = serve(serverOptions)
					},
					requestIP() {
						throw new Error(
							"This adapter doesn't support Bun requestIP method"
						)
					},
					stop() {
						server.close()
					},
					upgrade() {
						throw new Error(
							"This adapter doesn't support Web Standard Upgrade method"
						)
					},
					url: new URL(
						`http://${hostname === '::' ? 'localhost' : hostname}:${port}`
					),
					[Symbol.dispose]() {
						server.close()
					},
					raw: server
				} satisfies Server

				if (callback) callback(serverInfo)

				// @ts-ignore private property
				app.router.http.build?.()

				if (app.event.start)
					for (let i = 0; i < app.event.start.length; i++)
						app.event.start[i].fn(this)

				process.on('beforeExit', () => {
					server.close()

					if (app.event.stop)
						for (let i = 0; i < app.event.stop.length; i++)
							app.event.stop[i].fn(this)
				})
			}
		}
	} satisfies ElysiaAdapter
}

export default node
