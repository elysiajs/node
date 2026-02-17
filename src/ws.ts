import { defineHooks, Peer, WSError } from 'crossws'
import {
	Context,
	getSchemaValidator,
	serializeCookie,
	ValidationError,
	type AnyElysia
} from 'elysia'
import { parseSetCookies } from 'elysia/adapter/utils'
import { ElysiaTypeCheck } from 'elysia/schema'
import { isNotEmpty, randomId } from 'elysia/utils'
import {
	createHandleWSResponse,
	createWSMessageParser,
	ElysiaWS
} from 'elysia/ws'
import type { ServerWebSocket } from 'elysia/ws/bun'
import type { AnyWSLocalHook } from 'elysia/ws/types'

export interface NodeWebSocketContext {
	data: Context
	validateResponse: ElysiaTypeCheck<any> | undefined
	ping: ElysiaWS['ping']
	pong: ElysiaWS['pong']
	open(ws: Peer): Promise<void>
	message(ws: ServerWebSocket<any>, message: string): Promise<void>
	drain(ws: ServerWebSocket<any>): Promise<void>
	close(ws: ServerWebSocket<any>, code: number, reason: string): Promise<void>
	error(ws: ServerWebSocket<any>, error: WSError): void
}

export interface NodeWebSocketPeer extends Omit<Peer, 'context'> {
	context: NodeWebSocketContext
}

export function createWebSocketAdapter() {
	const store: Record<string, NodeWebSocketContext> = {}

	function handler(app: AnyElysia, path: string, options: AnyWSLocalHook) {
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

		const toServerWebSocket = (peer: Peer, context: Context) => {
			const ws = peer as any as ServerWebSocket<any>

			// @ts-ignore, context.context is intentional
			// first context is srvx.context (alias of bun.ws.data)
			// second context is Elysia context
			ws.data = context
			ws.sendText = ws.send
			ws.sendBinary = ws.send
			ws.publishText = ws.publish
			ws.publishBinary = ws.publish
			ws.isSubscribed = (topic: string) => peer.topics.has(topic)
			// @ts-ignore
			ws.cork = () => {
				console.log('ws.cork is not supported yet')
			}

			return ws
		}

		app.route(
			'WS',
			path as any,
			// @ts-ignore
			async (context: Context) => {
				// ! Enable static code analysis just in case resolveUnknownFunction doesn't work, do not remove
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				// @ts-ignore
				const { set, path, qi, headers, query, params } = context

				// @ts-ignore
				const id = context.request.wsId

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

				const handleResponse = createHandleWSResponse(validateResponse)
				const parseMessage = parse
					? createWSMessageParser(parse)
					: undefined

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

				const handleErrors = errorHandlers.length
					? async (ws: ServerWebSocket<any>, error: unknown) => {
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
					: undefined

				store[id] = {
					data: context,
					validateResponse,
					ping(ws, data?: unknown) {
						return options.ping?.(ws as any, data) as number
					},
					pong(ws, data?: unknown) {
						return options.pong?.(ws as any, data) as number
					},
					async open(_ws) {
						const ws = toServerWebSocket(_ws, context)

						try {
							await handleResponse(
								ws,
								options.open?.(new ElysiaWS(ws, context as any))
							)
						} catch (error) {
							handleErrors?.(ws, error)
						}
					},
					async message(ws, message) {
						if (message.includes('ping')) {
							try {
								return void ws.pong(message)
							} catch (error) {
								handleErrors?.(ws, error)
							}
						}

						if (parseMessage)
							message = await parseMessage(ws, message)

						if (message)
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
									new ElysiaWS(ws, context as any, message),
									message as any
								)
							)
						} catch (error) {
							handleErrors?.(ws, error)
						}
					},
					async drain(ws) {
						try {
							await handleResponse(
								ws,
								options.drain?.(
									new ElysiaWS(ws, context as any)
								)
							)
						} catch (error) {
							handleErrors?.(ws, error)
						}
					},
					async close(ws, code, reason) {
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
							handleErrors?.(ws, error)
						}
					},
					error(ws, error) {
						handleErrors?.(ws, error)
					}
				}

				return ''
			},
			{
				...rest,
				websocket: options
			} as any
		)
	}

	function createConfig(app: AnyElysia) {
		return defineHooks({
			async upgrade(request) {
				// @ts-ignore
				const id = (request.wsId = randomId())

				const response = await app.handle(request)

				const context = store[id]
				if (!context) return response

				return {
					context: context as any,
					headers: context.data.set.headers as any
				}
			},
			open(ws) {
				const context = ws.context as any as NodeWebSocketContext

				context.open(ws)
			},
			message(ws, message) {
				const context = ws.context as any as NodeWebSocketContext

				// ws is parsed in context.open
				context.message(ws as any as ServerWebSocket, message.text())
			},
			close(ws, detail) {
				const context = ws.context as any as NodeWebSocketContext

				context.close(
					// ws is parsed in context.open
					ws as any as ServerWebSocket,
					detail.code!,
					detail.reason!
				)
			},
			error(ws, error) {
				const context = ws.context as any as NodeWebSocketContext

				// ws is parsed in context.open
				context.error?.(ws as any as ServerWebSocket, error)
			}
		})
	}

	return { handler, createConfig, context: store }
}
