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

import { createAdapter, type ElysiaAdapterOptions } from 'elysia/adapter'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'
import { requestId } from 'elysia/utils'
import type { Server } from 'elysia/universal'

import type { serve as serveHttp } from 'srvx'

import { mapCompactResponse, mapResponse } from './handle'
import type { createWebSocketAdapter } from './ws'

type Serve = typeof serveHttp
type WebSocketAdapter = ReturnType<typeof createWebSocketAdapter>

// can't use extends because of the type of `serve` function
// so we use intersection type instead
type ServerOptions = Parameters<Serve>[0] & {
	websocket?: ReturnType<WebSocketAdapter['createConfig']>
}

export const createNodeAdapter = (
	serve: Serve,
	ws?: WebSocketAdapter,
	options?: Partial<ElysiaAdapterOptions>
) =>
	createAdapter({
		...options,
		...WebStandardAdapter,
		response: {
			compact: mapCompactResponse,
			map: mapResponse
		},
		listen(app, options, callback) {
			if (typeof options === 'string') {
				options = +options

				if (isNaN(options))
					throw new Error('Port must be a numeric value')
			}

			const serverOptions: ServerOptions =
				typeof options === 'object'
					? {
							...options,
							node: {
								exclusive: options.reusePort === false,
								// @ts-expect-error
								...options.node
							},
							silent: true,
							fetch: app.fetch,
							websocket: ws ? ws.createConfig(app) : undefined
						}
					: ({
							port: +options,
							node: { exclusive: false },
							silent: true,
							fetch: app.fetch,
							websocket: ws ? ws.createConfig(app) : undefined
						} as any)

			const createServer = () => {
				const server = serve(serverOptions)
				server.ready().catch(console.error)

				return server
			}
			let server = createServer()

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
				development: process.env.NODE_ENV !== 'production',
				...server,
				id: requestId(),
				fetch: app.fetch,
				hostname,
				get pendingRequests() {
					const { promise, resolve, reject } =
						Promise.withResolvers<number>()

					nodeServer?.getConnections((error, total) => {
						if (error) reject(error)

						resolve(total)
					})

					return promise as any
				},
				get pendingWebSockets() {
					return 0
				},
				port: port as any,
				publish() {
					return 0
				},
				ref() {
					nodeServer?.ref()
				},
				unref() {
					nodeServer?.unref()
				},
				reload() {
					nodeServer?.close()
					server = createServer()

					return serverInfo
				},
				stop() {
					return server.close()
				},
				...(ws && {
					// @ts-ignore — bridges Elysia 2's WS route handler to crossws
					upgrade: ws.upgrade
				}),
				url: new URL(
					`http://${hostname === '::' ? 'localhost' : hostname}:${port}`
				),
				[Symbol.dispose]() {
					server.close()
				},
				// @ts-ignore
				raw: server
			} satisfies Server

			app.server = serverInfo

			if (callback) callback(serverInfo)

			const onSetup = app['~ext']?.setup
			if (onSetup)
				for (let i = 0; i < onSetup.length; i++) onSetup[i](app)
		}
	})
