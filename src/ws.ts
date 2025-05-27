// import {
// 	AnyElysia,
// 	serializeCookie,
// 	ValidationError,
// 	type TSchema
// } from 'elysia'
// import { isNotEmpty, randomId } from 'elysia/utils'
// import { getSchemaValidator } from 'elysia/schema'

// import { createServer } from 'http'

// import { WebSocketServer } from 'ws'
// import type { WebSocket as NodeWebSocket } from 'ws'
// import {
// 	createHandleWSResponse,
// 	createWSMessageParser,
// 	ElysiaWS
// } from 'elysia/ws'
// import type { ServerWebSocket } from 'elysia/ws/bun'
// import { parseSetCookies } from 'elysia/adapter/web-standard/handler'

// import type { AnyWSLocalHook } from 'elysia/ws/types'

// export const attachWebSocket = (
// 	app: AnyElysia,
// 	server: ReturnType<typeof createServer>
// ) => {
// 	const wsServer = new WebSocketServer({
// 		noServer: true
// 	})

// 	const staticWsRouter = app.router.static.ws
// 	const router = app.router.http
// 	const history = app.router.history

// 	server.on('upgrade', (request, socket, head) => {
// 		wsServer.handleUpgrade(request, socket, head, async (ws) => {
// 			const qi = request.url!.indexOf('?')
// 			let path = request.url!
// 			if (qi !== -1) path = request.url!.substring(0, qi)

// 			const index = staticWsRouter[path]
// 			if (index === undefined) return

// 			const route = history[index]
// 			if (!route) {
// 				router.find('$INTERNALWS', path)
// 				return
// 			}

// 			if (!route.websocket) return
// 			const websocket: AnyWSLocalHook = route.websocket

// 			const validateMessage = getSchemaValidator(route.hooks.body, {
// 				// @ts-expect-error private property
// 				modules: app.definitions.typebox,
// 				// @ts-expect-error private property
// 				models: app.definitions.type as Record<string, TSchema>,
// 				normalize: app.config.normalize
// 			})

// 			const validateResponse = getSchemaValidator(
// 				route.hooks.response as any,
// 				{
// 					// @ts-expect-error private property
// 					modules: app.definitions.typebox,
// 					// @ts-expect-error private property
// 					models: app.definitions.type as Record<string, TSchema>,
// 					normalize: app.config.normalize
// 				}
// 			)

// 			const parseMessage = createWSMessageParser(route.hooks.parse)
// 			const handleResponse = createHandleWSResponse(validateResponse)

// 			const context = requestToContext(app, request, undefined as any)
// 			const set = context.set

// 			if (set.cookie && isNotEmpty(set.cookie)) {
// 				const cookie = serializeCookie(set.cookie)

// 				if (cookie) set.headers['set-cookie'] = cookie
// 			}

// 			if (
// 				set.headers['set-cookie'] &&
// 				Array.isArray(set.headers['set-cookie'])
// 			)
// 				set.headers = parseSetCookies(
// 					new Headers(set.headers as any) as Headers,
// 					set.headers['set-cookie']
// 				) as any

// 			if (route.hooks.upgrade) {
// 				if (typeof route.hooks.upgrade === 'function') {
// 					const temp = route.hooks.upgrade(context as any)
// 					if (temp instanceof Promise) await temp

// 					Object.assign(set.headers, context.set.headers)
// 				} else if (route.hooks.upgrade)
// 					Object.assign(
// 						set.headers,
// 						route.hooks.upgrade as Record<string, any>
// 					)
// 			}

// 			if (route.hooks.transform)
// 				for (let i = 0; i < route.hooks.transform.length; i++) {
// 					const hook = route.hooks.transform[i]
// 					const operation = hook.fn(context)

// 					if (hook.subType === 'derive') {
// 						if (operation instanceof Promise)
// 							Object.assign(context, await operation)
// 						else Object.assign(context, operation)
// 					} else if (operation instanceof Promise) await operation
// 				}

// 			if (route.hooks.beforeHandle)
// 				for (let i = 0; i < route.hooks.beforeHandle.length; i++) {
// 					const hook = route.hooks.beforeHandle[i]
// 					let response = hook.fn(context)

// 					if (hook.subType === 'resolve') {
// 						if (response instanceof Promise)
// 							Object.assign(context, await response)
// 						else Object.assign(context, response)

// 						continue
// 					} else if (response instanceof Promise)
// 						response = await response
// 				}

// 			let _id: string | undefined
// 			Object.assign(context, {
// 				get id() {
// 					if (_id) return _id

// 					return (_id = randomId())
// 				},
// 				validator: validateResponse
// 			})

// 			const elysiaWS = nodeWebSocketToServerWebSocket(
// 				ws,
// 				wsServer,
// 				context as any
// 			)

// 			if (websocket.open)
// 				handleResponse(
// 					elysiaWS,
// 					websocket.open!(new ElysiaWS(elysiaWS, context as any))
// 				)

// 			if (websocket.message)
// 				ws.on('message', async (_message) => {
// 					const message = await parseMessage(elysiaWS, _message)

// 					if (validateMessage?.Check(message) === false)
// 						return void ws.send(
// 							new ValidationError(
// 								'message',
// 								validateMessage,
// 								message
// 							).message as string
// 						)

// 					handleResponse(
// 						elysiaWS,
// 						websocket.message!(
// 							new ElysiaWS(elysiaWS, context as any, message),
// 							message
// 						)
// 					)
// 				})

// 			if (websocket.close)
// 				ws.on('close', (code, reason) => {
// 					handleResponse(
// 						elysiaWS,
// 						websocket.close!(
// 							new ElysiaWS(elysiaWS, context as any),
// 							code,
// 							reason.toString()
// 						)
// 					)
// 				})
// 		})
// 	})
// }
