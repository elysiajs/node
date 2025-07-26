import type { ElysiaAdapter } from 'elysia'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'
import type { Context } from 'elysia/context'
import { getSchemaValidator } from 'elysia/schema'
import type { Server } from 'elysia/universal'
import { randomId } from 'elysia/utils'
import {
	ElysiaWS,
	createHandleWSResponse,
	createWSMessageParser
} from 'elysia/ws'
import { AnyWSLocalHook } from 'elysia/ws/types'
import uWS from 'uWebSockets.js'
import { applyResponse, createWebRequest } from './utils'
import { UwsWebSocketWrapper } from './ws'

interface UwsSocketData {
	context: Record<string, unknown>
}

const wsHandlers = new Map<string, AnyWSLocalHook>()

export const node = (): ElysiaAdapter => ({
	...WebStandardAdapter,
	name: 'node',

	listen(app) {
		return (options, callback) => {
			app.compile()

			const config =
				typeof options === 'string'
					? { port: parseInt(options), hostname: '0.0.0.0' }
					: typeof options === 'number'
					? { port: options, hostname: '0.0.0.0' }
					: { hostname: '0.0.0.0', port: 3000, ...options }

			const { hostname, port } = config
			const uwsApp = uWS.App()

			// Register WebSocket routes
			for (const [path, handler] of wsHandlers) {
				const uwsPath = path.replace(/:([^/]+)/g, ':$1')
				const parseMessage = createWSMessageParser(handler.parse!)
				const handleResponse = createHandleWSResponse(
					getSchemaValidator(handler.response!, {
						normalize: app.config.normalize
					})
				)

				uwsApp.ws<UwsSocketData>(uwsPath, {
					upgrade: (res, req, context) => {
						try {
							const request = createWebRequest(res, req)
							const wsContext = {
								request,
								store: app.store,
								decorator: app.decorator,
								server: app.server as Server,
								set: { headers: {}, status: 200 },
								path: req.getUrl(),
								query: Object.fromEntries(
									new URLSearchParams(req.getQuery())
								),
								params: {},
								headers: (() => {
									const h: Record<string, string> = {}
									request.headers.forEach(
										(value, key) => (h[key] = value)
									)
									return h
								})()
							}

							res.upgrade(
								{ context: wsContext },
								req.getHeader('sec-websocket-key'),
								req.getHeader('sec-websocket-protocol'),
								req.getHeader('sec-websocket-extensions'),
								context
							)
						} catch (error) {
							res.writeStatus('400').end(
								'WebSocket upgrade failed'
							)
						}
					},

					open: (ws) => {
						const { context } = ws.getUserData()
						const wrapper = new UwsWebSocketWrapper(
							ws as uWS.WebSocket<never>
						)
						const elysiaWs = new ElysiaWS(wrapper, context)

						if (handler.open) {
							const result = handler.open(elysiaWs)
							if (result !== undefined)
								handleResponse(wrapper, result)
						}
					},

					message: async (ws, message, isBinary) => {
						const { context } = ws.getUserData()
						const wrapper = new UwsWebSocketWrapper(
							ws as uWS.WebSocket<never>
						)
						const elysiaWs = new ElysiaWS(wrapper, context)

						const data = isBinary
							? Buffer.from(message)
							: Buffer.from(message).toString()
						const parsed = await parseMessage(elysiaWs, data)

						if (handler.message) {
							const result = handler.message(elysiaWs, parsed)
							if (result !== undefined)
								handleResponse(wrapper, result)
						}
					},

					close: (ws, code, message) => {
						const { context } = ws.getUserData()
						const wrapper = new UwsWebSocketWrapper(
							ws as uWS.WebSocket<never>
						)
						const elysiaWs = new ElysiaWS(wrapper, context)

						if (handler.close) {
							const result = handler.close(
								elysiaWs,
								code,
								Buffer.from(message).toString()
							)
							if (result !== undefined)
								handleResponse(wrapper, result)
						}
					}
				})
			}

			// Register HTTP routes
			for (const route of app.router.history) {
				if (wsHandlers.has(route.path) || !route.composed) continue

				const uwsPath = route.path.replace(/:([^/]+)/g, ':$1')
				const handler = (
					res: uWS.HttpResponse,
					req: uWS.HttpRequest
				) => {
					let aborted = false
					res.onAborted(() => (aborted = true))
					;(async () => {
						try {
							const request = createWebRequest(res, req)
							const context = {
								request,
								set: {
									headers: {} as Record<string, string>,
									status: 200
								},
								store: app.store,
								decorator: app.decorator,
								server: app.server as Server,
								path: req.getUrl(),
								query: Object.fromEntries(
									new URLSearchParams(req.getQuery())
								),
								params: {},
								headers: (() => {
									const h: Record<string, string> = {}
									request.headers.forEach(
										(value, key) => (h[key] = value)
									)
									return h
								})(),
								body: undefined,
								cookie: {},
								redirect: () =>
									new Response(null, { status: 302 }),
								route: route.path,
								error: () =>
									new Response('Error', {
										status: 500
									}),
								status: () => new Response()
							} as unknown as Context

							const response =
								typeof route.composed === 'function'
									? await route.composed(context)
									: route.composed

							if (response) {
								Object.entries(context.set.headers).forEach(
									([key, value]) => {
										if (typeof value === 'string')
											response.headers.append(key, value)
									}
								)

								if (!aborted) await applyResponse(res, response)
							}
						} catch (error) {
							if (!aborted) {
								res.writeStatus('500').end(
									'Internal Server Error'
								)
							}
						}
					})()
				}

				const methods = {
					GET: () => uwsApp.get(uwsPath, handler),
					POST: () => uwsApp.post(uwsPath, handler),
					PUT: () => uwsApp.put(uwsPath, handler),
					DELETE: () => uwsApp.del(uwsPath, handler),
					PATCH: () => uwsApp.patch(uwsPath, handler),
					OPTIONS: () => uwsApp.options(uwsPath, handler),
					HEAD: () => uwsApp.head(uwsPath, handler)
				}

				methods[route.method as keyof typeof methods]?.() ||
					uwsApp.any(uwsPath, handler)
			}

			// Start server
			uwsApp.listen(hostname, port, (listenSocket) => {
				if (listenSocket) {
					const server: Server = {
						hostname,
						port,
						development: process.env.NODE_ENV !== 'production',
						id: randomId(),
						pendingRequests: 0,
						pendingWebSockets: 0,
						fetch: app.fetch,
						stop: () => uWS.us_listen_socket_close(listenSocket),
						publish: (
							topic: string,
							data: string | Buffer,
							compress?: boolean
						) =>
							+uwsApp.publish(
								topic,
								data,
								Buffer.isBuffer(data),
								compress
							),
						reload: () =>
							console.warn(
								'Hot reload not supported with uWebSockets.js'
							),
						ref: () => {},
						unref: () => {},
						requestIP: () => {
							throw new Error('requestIP not supported')
						},
						upgrade: () => {
							throw new Error('Manual upgrade not supported')
						},
						url: new URL(
							`http://${
								hostname === '::' ? 'localhost' : hostname
							}:${port}`
						),
						[Symbol.dispose]: function () {
							this.stop()
						}
					}

					app.server = server
					if (callback) callback(server)
				} else {
					throw new Error(`Failed to listen on ${hostname}:${port}`)
				}
			})

			// Lifecycle events
			app.event.start?.forEach((event) => event.fn(app))
			process.on('beforeExit', () => {
				app.server?.stop()
				app.event.stop?.forEach((event) => event.fn(app))
			})
		}
	},

	ws(app, path, handler) {
		wsHandlers.set(path, handler)
	}
})

export default node
