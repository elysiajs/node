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

import type { ElysiaAdapter } from 'elysia'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'

import type { Server } from 'elysia/universal'
import { isNumericString, randomId } from 'elysia/utils'

import { defineHooks } from 'crossws'
import { serve } from 'crossws/server'

import type { ServerWebSocket } from 'elysia/ws/bun'
import { createWebSocketAdapter, type NodeWebSocketContext } from './ws'

import {
	mapCompactResponse,
	mapEarlyResponse,
	mapResponse,
	createStaticHandler
} from './handle'

export const node = () => {
	const ws = createWebSocketAdapter()

	return {
		...WebStandardAdapter,
		name: '@elysiajs/node',
		handler: {
			mapCompactResponse,
			mapEarlyResponse,
			mapResponse,
			createStaticHandler
		},
		ws: ws.handler,
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
						const id = (request.wsId = randomId())

						const response = await app.handle(request)

						const context = ws.context[id]
						if (!context) return response

						return {
							context: context as any,
							headers: context.data.set.headers as any
						}
					},
					open(ws) {
						const context =
							ws.context as any as NodeWebSocketContext

						context.open(ws)
					},
					message(ws, message) {
						const context =
							ws.context as any as NodeWebSocketContext

						// ws is parsed in context.open
						context.message(
							ws as any as ServerWebSocket,
							message.text()
						)
					},
					close(ws, detail) {
						const context =
							ws.context as any as NodeWebSocketContext

						context.close(
							// ws is parsed in context.open
							ws as any as ServerWebSocket,
							detail.code!,
							detail.reason!
						)
					},
					error(ws, error) {
						const context =
							ws.context as any as NodeWebSocketContext

						// ws is parsed in context.open
						context.error?.(ws as any as ServerWebSocket, error)
					}
				})

				const serverOptions: Parameters<typeof serve>[0] =
					typeof options === 'number'
						? {
								port: options,
								silent: true,
								websocket,
								fetch: app.fetch,
								reusePort: true
							}
						: {
								reusePort: true,
								...options,
								silent: true,
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
					publish() {},
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
