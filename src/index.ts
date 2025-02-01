/* eslint-disable sonarjs/no-duplicate-string */
import { createServer, type IncomingMessage } from 'http'
import { Readable } from 'stream'

import formidable from 'formidable'

import { Elysia } from 'elysia'
import type { Server } from 'elysia/universal'

import {
	isNotEmpty,
	isNumericString,
	mergeLifeCycle,
	randomId
} from 'elysia/utils'
import { type ElysiaAdapter } from 'elysia/adapter'

import { mapResponse, mapEarlyResponse, mapCompactResponse } from './handler'

import { attachWebSocket } from './ws'
import { WebStandardAdapter } from 'elysia/adapter/web-standard'
import {
	readFileToWebStandardFile,
	unwrapArrayIfSingle,
	withResolvers
} from './utils'

export const ElysiaNodeContext = Symbol('ElysiaNodeContext')

const getUrl = (req: IncomingMessage) => {
	if (req.headers.host) return `http://${req.headers.host}${req.url}`

	if (req.socket?.localPort)
		return `http://localhost:${req.socket?.localPort}${req.url}`

	return `http://localhost${req.url}`
}

export const nodeRequestToWebstand = (
	req: IncomingMessage,
	abortController?: AbortController
) => {
	let _signal: AbortSignal
	let _body: unknown

	return new Request(getUrl(req), {
		method: req.method,
		headers: req.headers as Record<string, string>,
		get body() {
			if (req.method === 'GET' || req.method === 'HEAD') return null
			if (_body !== undefined) return _body
			if (req.readable) return (_body = Readable.toWeb(req) as any)

			return null
		},
		get signal() {
			if (_signal) return _signal

			const controller = abortController ?? new AbortController()
			_signal = controller.signal

			req.once('close', () => {
				controller.abort()
			})

			return _signal
		},
		// @ts-expect-error
		duplex: 'half'
	})
}

export const node = () => {
	return {
		name: 'node',
		handler: {
			mapResponse,
			mapEarlyResponse,
			mapCompactResponse
		},
		composeHandler: {
			declare(inference) {
				if (inference.request || inference.cookie)
					return (
						`if(!('request' in c)){` +
						`let _request\n` +
						`Object.defineProperty(c,'request',{` +
						`get(){` +
						`if(_request)return _request\n` +
						`return _request=nodeRequestToWebstand(c[ElysiaNodeContext].req)` +
						`}` +
						`})` +
						'}\n'
					)
			},
			mapResponseContext: 'c[ElysiaNodeContext].res',
			headers: `c.headers=c[ElysiaNodeContext].req.headers\n`,
			inject: {
				ElysiaNodeContext,
				nodeRequestToWebstand,
				formidable,
				readFileToWebStandardFile,
				unwrapArrayIfSingle
			},
			parser: {
				declare: `const req=c[ElysiaNodeContext].req\n`,
				json() {
					let fnLiteral =
						'c.body=await new Promise((re)=>{' +
						`let body\n` +
						`req.on('data',(chunk)=>{` +
						`if(body) body=Buffer.concat([body,chunk])\n` +
						`else body=chunk` +
						`})\n` +
						`req.on('end',()=>{`

					fnLiteral +=
						`if(!body || !body.length)return re()\n` +
						`else re(JSON.parse(body))`

					return fnLiteral + `})` + '})\n'
				},
				text() {
					let fnLiteral =
						'c.body=await new Promise((re)=>{' +
						`let body\n` +
						`req.on('data',(chunk)=>{` +
						`if(body) body=Buffer.concat([body,chunk])\n` +
						`else body=chunk` +
						`})\n` +
						`req.on('end',()=>{`

					fnLiteral +=
						`if(!body || !body.length)return re()\n` +
						`else re(body)`

					return fnLiteral + `})` + '})\n'
				},
				urlencoded() {
					let fnLiteral =
						'c.body=await new Promise((re)=>{' +
						`let body\n` +
						`req.on('data',(chunk)=>{` +
						`if(body) body=Buffer.concat([body,chunk])\n` +
						`else body=chunk` +
						`})\n` +
						`req.on('end',()=>{`

					fnLiteral +=
						`if(!body || !body.length)return re()\n` +
						`else re(parseQuery(body))`

					return fnLiteral + `})` + '})\n'
				},
				arrayBuffer() {
					let fnLiteral =
						'c.body=await new Promise((re)=>{' +
						`let body\n` +
						`req.on('data',(chunk)=>{` +
						`if(body) body=Buffer.concat([body,chunk])\n` +
						`else body=chunk` +
						`})\n` +
						`req.on('end',()=>{`

					fnLiteral +=
						`if(!body || !body.length)return re()\n` +
						`else re(` +
						`body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)` +
						`)`

					return fnLiteral + `})` + '})\n'
				},
				formData() {
					return (
						'const fields=await formidable({}).parse(req)\n' +
						// Fields
						'c.body={}\n' +
						'let fieldKeys=Object.keys(fields[0])\n' +
						'for(let i=0;i<fieldKeys.length;i++){' +
						'c.body[fieldKeys[i]]=unwrapArrayIfSingle(fields[0][fieldKeys[i]])' +
						'}\n' +
						// Files
						'fieldKeys=Object.keys(fields[1])\n' +
						'for(let i=0;i<fieldKeys.length;i++){' +
						'c.body[fieldKeys[i]]=unwrapArrayIfSingle(await readFileToWebStandardFile(fields[1][fieldKeys[i]]))' +
						'}\n'
					)
				}
			}
		},
		composeGeneralHandler: {
			parameters: 'r,res',
			inject: {
				nodeRequestToWebstand,
				ElysiaNodeContext
			},
			createContext: (app) => {
				let decoratorsLiteral = ''
				let fnLiteral =
					`const qi=r.url.indexOf('?')\n` +
					`let p=r.url\n` +
					`if(qi!==-1)p=r.url.substring(0,qi)\n`

				// @ts-expect-error private
				const defaultHeaders = app.setHeaders

				// @ts-ignore
				for (const key of Object.keys(app.singleton.decorator))
					decoratorsLiteral += `,${key}: decorator['${key}']`

				const hasTrace = !!app.event.trace?.length

				if (hasTrace) fnLiteral += `const id=randomId()\n`

				fnLiteral += `let _request\n` + `const c={`

				// @ts-ignore protected
				if (app.inference.request || app.inference.cookie)
					fnLiteral +=
						`get request(){` +
						`if(_request)return _request\n` +
						`return _request = nodeRequestToWebstand(r)` +
						`},`

				fnLiteral +=
					`store,` +
					`qi,` +
					`path:p,` +
					`url:r.url,` +
					`redirect,` +
					`error,`

				fnLiteral +=
					'[ElysiaNodeContext]:{' +
					'req:r,' +
					'res' +
					// '_signal:undefined,' +
					// 'get signal(){' +
					// 'if(this._signal) return this._signal\n' +
					// 'const controller = new AbortController()\n' +
					// 'this._signal = controller.signal\n' +
					// // `req.once('close', () => { controller.abort() })\n` +
					// 'return this._signal' +
					// '}' +
					'},'

				fnLiteral += `set:{headers:`

				fnLiteral += Object.keys(defaultHeaders ?? {}).length
					? 'Object.assign({}, app.setHeaders)'
					: '{}'

				fnLiteral += `,status:200}`

				// @ts-ignore private
				// if (app.inference.server)
				// 	fnLiteral += `,get server(){return getServer()}`

				if (hasTrace) fnLiteral += ',[ELYSIA_REQUEST_ID]:id'

				fnLiteral += decoratorsLiteral
				fnLiteral += `}\n`

				return fnLiteral
			},
			websocket() {
				return ''
			},
			error404(hasEventHook, hasErrorHook) {
				let findDynamicRoute = `if(route===null){`

				if (hasErrorHook)
					findDynamicRoute += `return app.handleError(c,notFound,false,${this.parameters})`
				else
					findDynamicRoute +=
						`if(c.set.status===200)c.set.status=404\n` +
						`res.writeHead(c.set.status, c.set.headers)\n` +
						`res.end(error404Message)\n` +
						`return [error404Message, c.set]`

				findDynamicRoute += '}'

				return {
					declare: hasErrorHook
						? ''
						: `const error404Message=notFound.message.toString()\n`,
					code: findDynamicRoute
				}
			}
		},
		composeError: {
			declare: `\nconst res = context[ElysiaNodeContext].res\n`,
			inject: {
				ElysiaNodeContext
			},
			mapResponseContext: ',res',
			validationError:
				`context.set.headers['content-type'] = 'application/json;charset=utf-8'\n` +
				`res.writeHead(context.set.status, context.set.headers)\n` +
				`res.end(error.message)\n` +
				`return [error.message, context.set]`,
			unknownError:
				`if(error.status)context.set.status=error.status\n` +
				`res.writeHead(context.set.status, context.set.headers)\n` +
				`res.end(error.message)\n` +
				`return [error.message, context.set]`
		},
		ws(app, path, options) {
			const key = Object.keys(app.router.static.ws).length
			app.router.static.ws[path] = key

			const lifecycle = mergeLifeCycle(options, {})

			app.router.history.push({
				method: '$INTERNALWS',
				path,
				compile: undefined as any,
				composed: undefined as any,
				handler: undefined as any,
				hooks: lifecycle,
				websocket: options
			})
			app.router.http.history.push(['$INTERNALWS', path, options])
		},
		listen(app) {
			return (options, callback) => {
				app.compile()

				if (typeof options === 'string') {
					if (!isNumericString(options))
						throw new Error('Port must be a numeric value')

					options = parseInt(options)
				}

				const webStandardApp = new Elysia({
					...app.options,
					adapter: WebStandardAdapter
				})
					.use(app)
					.compile()

				app.fetch = webStandardApp.fetch

				const { promise: serverInfo, resolve: setServerInfo } =
					withResolvers<Server>()

				// @ts-expect-error closest possible type
				app.server = serverInfo

				let server = createServer(
					// @ts-expect-error private property
					app._handle
				).listen(
					typeof options === 'number'
						? options
						: {
								...options,
								// @ts-ignore
								host: options?.hostname
							},
					() => {
						const address = server.address()
						const hostname =
							typeof address === 'string'
								? address
								: address
									? address.address
									: 'localhost'
						const port =
							typeof address === 'string'
								? 0
								: (address?.port ?? 0)

						const serverInfo: Server = {
							id: randomId(),
							development: process.env.NODE_ENV !== 'production',
							fetch: app.fetch,
							hostname,
							// @ts-expect-error
							get pendingRequests() {
								const { promise, resolve, reject } =
									withResolvers<number>()

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
								server.close()

								server = createServer(
									// @ts-expect-error private property
									app._handle
								).listen(
									typeof options === 'number'
										? options
										: {
												...options,
												// @ts-ignore
												host: options?.hostname
											}
								)
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
					}
				)

				// @ts-ignore
				app.router.http.build?.()

				if (
					isNotEmpty(app.router.static.ws) ||
					app.router.http.history.find((x) => x[0] === 'ws')
				)
					attachWebSocket(app, server)

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
