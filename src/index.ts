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

import { WebStandardAdapter } from 'elysia/adapter/web-standard'

import type { Server } from 'elysia/universal'
import { requestId } from 'elysia/utils'

import { serve } from 'crossws/server'

import { createWebSocketAdapter } from './ws'

import { mapCompactResponse, mapResponse } from './handle'
import { createAdapter } from 'elysia/adapter'

export const node = () => {
	const ws = createWebSocketAdapter()

	return createAdapter({
		...WebStandardAdapter,
		name: '@elysia/node',
		websocket: true,
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

			const serverOptions: Parameters<typeof serve>[0] =
				typeof options === 'number'
					? ({
							port: options,
							silent: true,
							websocket: ws.createConfig(app),
							fetch: app.fetch,
							reusePort: true
						} as any)
					: {
							reusePort: true,
							...options,
							silent: true,
							websocket: ws.createConfig(app),
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
				id: requestId(),
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
					server = serve(serverOptions)

					return serverInfo
				},
				requestIP() {
					throw new Error(
						"This adapter doesn't support Bun requestIP method"
					)
				},
				stop() {
					return server.close()
				},
				// @ts-ignore — bridges Elysia 2's WS route handler to crossws
				upgrade: ws.upgrade,
				url: new URL(
					`http://${hostname === '::' ? 'localhost' : hostname}:${port}`
				),
				[Symbol.dispose]() {
					server.close()
				},
				// @ts-ignore
				raw: server
			} satisfies Server

			// Elysia 2's WS route handler upgrades via app.server.upgrade()
			app.server = serverInfo

			if (callback) callback(serverInfo)

			const onSetup = app['~ext']?.setup
			if (onSetup)
				for (let i = 0; i < onSetup.length; i++) onSetup[i](app)
		}
	})
}

export default node
