import {
	AnyElysia,
	ELYSIA_REQUEST_ID,
	redirect,
	serializeCookie,
	ValidationError,
	type Context,
	type TSchema
} from 'elysia'
import type { TypeCheck } from 'elysia/type-system'
import { getSchemaValidator, isNotEmpty, randomId } from 'elysia/utils'

import { createServer, IncomingMessage, OutgoingMessage } from 'http'

import { nodeRequestToWebstand, ElysiaNodeContext } from '.'

import WebSocket from 'ws'
import type { WebSocket as NodeWebSocket, WebSocketServer } from 'ws'
import {
	createHandleWSResponse,
	createWSMessageParser,
	ElysiaWS
} from 'elysia/ws'
import type { ServerWebSocket } from 'elysia/ws/bun'
import { parseSetCookies } from 'elysia/adapter/web-standard/handler'

import type { AnyWSLocalHook } from 'elysia/ws/types'

export const nodeWebSocketToServerWebSocket = (
	ws: NodeWebSocket,
	wss: WebSocketServer,
	data: {
		id: string
		validator?: TypeCheck<TSchema>
	}
) => {
	const addListener = (message: string) => {
		for (const client of wss.clients)
			if (client !== ws && client.readyState === 1) client.send(message)
	}

	return {
		send(data, compress) {
			ws.send(data, {
				binary: Buffer.isBuffer(data),
				compress
			})

			return ws.readyState
		},
		sendText(data, compress) {
			ws.send(data, { binary: false, compress })

			return ws.readyState
		},
		sendBinary(data, compress) {
			ws.send(data, { binary: true, compress })

			return ws.readyState
		},
		close(code, reason) {
			ws.close(code, reason)
		},
		terminate() {
			ws.terminate()
		},
		ping(data) {
			ws.ping(data)

			return ws.readyState
		},
		pong(data) {
			ws.pong(data)

			return ws.readyState
		},
		publish(topic, data, _compress) {
			ws.emit(topic, data)

			return ws.readyState
		},
		publishText(topic, data, _compress) {
			ws.emit(topic, data)

			return ws.readyState
		},
		publishBinary(topic, data, _compress) {
			ws.emit(topic, data)

			return ws.readyState
		},
		subscribe(topic) {
			ws.addListener(topic, addListener)
		},
		unsubscribe(topic) {
			ws.removeListener(topic, addListener)
		},
		isSubscribed(topic) {
			return ws.eventNames().includes(topic)
		},
		cork(callback) {
			return callback(this as any)
		},
		remoteAddress: '127.0.0.1',
		get readyState() {
			return ws.readyState
		},
		get binaryType() {
			return ws.binaryType as any
		},
		data
	} satisfies ServerWebSocket<{
		id?: string
		validator?: TypeCheck<TSchema>
	}>
}

export const requestToContext = (
	app: AnyElysia,
	request: IncomingMessage,
	response: OutgoingMessage
): Context => {
	const url = request.url!
	const s = url.indexOf('/', 11)
	const qi = url.indexOf('?', s + 1)
	const path = qi === -1 ? url.substring(s) : url.substring(s, qi)

	const set: Context['set'] = {
		cookie: {},
		status: 200,
		headers: Object.assign(
			{},
			// @ts-expect-error private property
			app.setHeaders
		)
	}

	return Object.assign(
		{},
		// @ts-expect-error private property
		app.singleton.decorator,
		{
			// @ts-expect-error private property
			store: app.singleton.store,
			qi,
			path,
			url,
			set,
			redirect,
			get request() {
				return nodeRequestToWebstand(request)
			},
			[ElysiaNodeContext]: {
				req: request,
				res: undefined
			},
			headers: request.headers
		}
	) as unknown as Context
}

export const attachWebSocket = (
	app: AnyElysia,
	server: ReturnType<typeof createServer>
) => {
	const wsServer = new WebSocket.Server({
		noServer: true
	})

	const staticWsRouter = app.router.static.ws
	const dynamicWsRouter = app.router.ws
	const history = app.router.history

	server.on('upgrade', (request, socket, head) => {
		wsServer.handleUpgrade(request, socket, head, async (ws) => {
			const qi = request.url!.indexOf('?')
			let path = request.url!
			if (qi !== -1) path = request.url!.substring(0, qi)

			const index = staticWsRouter[path]
			if (index === undefined) return

			const route = history[index]

			if (!route) {
				dynamicWsRouter.find('$INTERNALWS', path)
				return
			}

			if (!route.websocket) return
			const websocket: AnyWSLocalHook = route.websocket

			const validateMessage = getSchemaValidator(route.hooks.body, {
				// @ts-expect-error private property
				modules: app.definitions.typebox,
				// @ts-expect-error private property
				models: app.definitions.type as Record<string, TSchema>,
				normalize: app.config.normalize
			})

			const validateResponse = getSchemaValidator(
				route.hooks.response as any,
				{
					// @ts-expect-error private property
					modules: app.definitions.typebox,
					// @ts-expect-error private property
					models: app.definitions.type as Record<string, TSchema>,
					normalize: app.config.normalize
				}
			)

			const parseMessage = createWSMessageParser(route.hooks.parse)
			const handleResponse = createHandleWSResponse(validateResponse)

			const context = requestToContext(app, request, undefined as any)
			const set = context.set

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

			if (route.hooks.upgrade) {
				if (typeof route.hooks.upgrade === 'function') {
					const temp = route.hooks.upgrade(context as any)
					if (temp instanceof Promise) await temp

					Object.assign(set.headers, context.set.headers)
				} else if (route.hooks.upgrade)
					Object.assign(
						set.headers,
						route.hooks.upgrade as Record<string, any>
					)
			}

			if (route.hooks.transform)
				for (let i = 0; i < route.hooks.transform.length; i++) {
					const hook = route.hooks.transform[i]
					const operation = hook.fn(context)

					if (hook.subType === 'derive') {
						if (operation instanceof Promise)
							Object.assign(context, await operation)
						else Object.assign(context, operation)
					} else if (operation instanceof Promise) await operation
				}

			if (route.hooks.beforeHandle)
				for (let i = 0; i < route.hooks.beforeHandle.length; i++) {
					const hook = route.hooks.beforeHandle[i]
					let response = hook.fn(context)

					if (hook.subType === 'resolve') {
						if (response instanceof Promise)
							Object.assign(context, await response)
						else Object.assign(context, response)

						continue
					} else if (response instanceof Promise)
						response = await response
				}

			let _id: string | undefined
			Object.assign(context, {
				get id() {
					if (_id) return _id

					return (_id = randomId())
				},
				validator: validateResponse
			})

			const elysiaWS = nodeWebSocketToServerWebSocket(
				ws,
				wsServer,
				context as any
			)

			if (websocket.open)
				handleResponse(
					elysiaWS,
					websocket.open!(new ElysiaWS(elysiaWS, context as any))
				)

			if (websocket.message)
				ws.on('message', async (_message) => {
					const message = await parseMessage(elysiaWS, _message)

					if (validateMessage?.Check(message) === false)
						return void ws.send(
							new ValidationError(
								'message',
								validateMessage,
								message
							).message as string
						)

					handleResponse(
						elysiaWS,
						websocket.message!(
							new ElysiaWS(elysiaWS, context as any, message),
							message
						)
					)
				})

			if (websocket.close)
				ws.on('close', (code, reason) => {
					handleResponse(
						elysiaWS,
						websocket.close!(
							new ElysiaWS(elysiaWS, context as any),
							code,
							reason.toString()
						)
					)
				})
		})
	})
}
