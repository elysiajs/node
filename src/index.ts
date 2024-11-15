/* eslint-disable sonarjs/no-duplicate-string */
import { createServer, type IncomingMessage } from 'http'
import { Readable } from 'stream'

import { isNotEmpty, isNumericString, mergeLifeCycle } from 'elysia/utils'
import { type ElysiaAdapter } from 'elysia/adapter'
import { mapResponse, mapEarlyResponse, mapCompactResponse } from './handler'

import { type WSLocalHook } from 'elysia/ws'
import { attachWebSocket } from './ws'

export const ElysiaNodeContext = Symbol('ElysiaNodeContext')

const getUrl = (req: IncomingMessage) => {
	if (req.headers.host) return `http://${req.headers.host}${req.url}`

	if (req.socket?.localPort)
		return `http://localhost:${req.socket?.localPort}${req.url}`

	return `http://localhost${req.url}`
}

export type EmptyWebsocket = WSLocalHook<
	{},
	{},
	{
		decorator: {}
		store: {}
		derive: {}
		resolve: {}
	},
	{},
	[]
>

export const nodeRequestToWebstand = (
	req: IncomingMessage,
	abortController?: AbortController
) => {
	let _signal: AbortSignal

	return new Request(getUrl(req), {
		method: req.method,
		headers: req.headers as Record<string, string>,
		get body() {
			return req.method === 'GET' || req.method === 'HEAD'
				? null
				: (Readable.toWeb(req) as any)
		},
		get signal() {
			if (_signal) return _signal

			const controller = abortController ?? new AbortController()
			_signal = controller.signal

			req.once('close', () => {
				controller.abort()
			})

			return _signal
		}
	})
}

export const node = () => {
	return {
		name: 'node',
		handler: {
			mapResponse,
			mapEarlyResponse,
			mapCompactResponse,
			createStaticHandler: (value, _hook, defaultHeaders) =>
				mapResponse(value, {
					status: 200,
					headers: defaultHeaders ?? {}
				}) as any
		},
		composeHandler: {
			declare(inference) {
				if (inference.request)
					return (
						`Object.defineProperty(c,'request',{` +
						`get(){` +
						`return nodeRequestToWebstand(c[ElysiaNodeContext].req)` +
						`}` +
						`})\n`
					)
			},
			mapResponseContext: 'c[ElysiaNodeContext].res',
			headers: `c.headers=c[ElysiaNodeContext].req.headers\n`,
			inject: {
				ElysiaNodeContext,
				nodeRequestToWebstand
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
					return '\n'
				},
				formData() {
					return '\n'
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
					decoratorsLiteral += `,${key}: app.singleton.decorator.${key}`

				const hasTrace = app.event.trace.length > 0

				if (hasTrace) fnLiteral += `const id=randomId()\n`

				fnLiteral += `let _request\n` + `const c={`

				// @ts-ignore protected
				if (app.inference.request)
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
				`c.set.status = error.status\n` +
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
			app.router.ws.history.push(['$INTERNALWS', path, options])
		},
		listen(app) {
			return (options, callback) => {
				app.compile()

				if (typeof options === 'string') {
					if (!isNumericString(options))
						throw new Error('Port must be a numeric value')

					options = parseInt(options)
				}

				const server = createServer(
					// @ts-ignore private property
					app._handle
				).listen(options, () => {
					if (callback)
						// @ts-ignore
						callback()
				})

				if (
					isNotEmpty(app.router.static.ws) ||
					app.router.ws.history.length
				)
					attachWebSocket(app, server)

				for (let i = 0; i < app.event.start.length; i++)
					app.event.start[i].fn(this)

				process.on('beforeExit', () => {
					server.close()

					for (let i = 0; i < app.event.stop.length; i++)
						app.event.stop[i].fn(this)
				})
			}
		}
	} satisfies ElysiaAdapter
}

export default node
