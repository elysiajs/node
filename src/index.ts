import type { ElysiaAdapter } from 'elysia'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'

import { serve, FastResponse } from 'srvx'

import { isNumericString, randomId } from 'elysia/utils'
import type { Server } from 'elysia/universal'

export const node = () => {
	return {
		...WebStandardAdapter,
		name: 'node',
		listen(app) {
			return (options, callback) => {
				if (typeof options === 'string') {
					if (!isNumericString(options))
						throw new Error('Port must be a numeric value')

					options = parseInt(options)
				}

				const serverOptions =
					typeof options === 'number'
						? {
								port: options,
								fetch: app.fetch
							}
						: {
								...options,
								// @ts-ignore
								host: options?.hostname
							}

				let server = serve(serverOptions)
				const nodeServer = server.node?.server

				console.log(nodeServer)

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

				app.modules.then(() => {
					try {
						serverInfo.reload(
							typeof options === 'object'
								? (options as any)
								: {
										port: options
									}
						)
					} catch {}
				})

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
