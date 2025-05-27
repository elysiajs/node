import type { ElysiaAdapter } from 'elysia'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'

import { serve } from '@hono/node-server'

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

				const { promise: serverInfo, resolve: setServerInfo } =
					Promise.withResolvers<Server>()

				// @ts-expect-error closest possible type
				app.server = serverInfo

				const serverOptions: any =
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

				let server = serve(serverOptions, () => {
					const address = server.address()
					const hostname =
						typeof address === 'string'
							? address
							: address
								? address.address
								: 'localhost'

					const port =
						typeof address === 'string' ? 0 : (address?.port ?? 0)

					const serverInfo: Server = {
						...server,
						id: randomId(),
						development: process.env.NODE_ENV !== 'production',
						fetch: app.fetch,
						hostname,
						// @ts-expect-error
						get pendingRequests() {
							const { promise, resolve, reject } =
								Promise.withResolvers<number>()

							server.getConnections((error, total) => {
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
							server.ref()
						},
						unref() {
							server.unref()
						},
						reload() {
							server.close(() => {
								server = serve(serverOptions)
							})
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
						// @ts-expect-error additional property
						raw: server
					} satisfies Server

					setServerInfo(serverInfo)

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
				})

				// @ts-ignore
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
