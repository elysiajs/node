import { defineHooks, type Message, type Peer } from 'crossws'

import type { AnyElysia } from 'elysia/base'
import { buildGlobalWSHandler, type ServerWebSocket } from 'elysia/ws'

export interface WSUpgradeData {
	headers?: Record<string, any>
	data: any
}

function toServerWebSocket(peer: Peer): ServerWebSocket<any> {
	const ws = peer as any

	ws.data = peer.context

	if (ws.sendText) return ws

	ws.sendText = ws.send
	ws.sendBinary = ws.send
	ws.publishText = ws.publish
	ws.publishBinary = ws.publish
	ws.isSubscribed = (topic: string) => peer.topics.has(topic)
	ws.subscriptions = peer.topics
	// ws lib exposes ping/pong on the raw socket; crossws Peer doesn't
	ws.ping = (data?: any) => ws._internal?.ws?.ping?.(data)
	ws.pong = (data?: any) => ws._internal?.ws?.pong?.(data)
	ws.cork = (cb: () => unknown) => cb?.()

	Object.defineProperty(ws, 'readyState', {
		get: () => ws._internal?.ws?.readyState
	})

	return ws
}

export function createWebSocketAdapter() {
	const pending = new WeakMap<Request, WSUpgradeData>()
	const global = buildGlobalWSHandler()

	function upgrade(request: Request, options: WSUpgradeData) {
		pending.set(request, options)

		return true
	}

	const createConfig = (app: AnyElysia) =>
		defineHooks({
			async upgrade(request) {
				const response = await app.fetch(request as any)

				const opts = pending.get(request as any)
				if (!opts) return response
				pending.delete(request as any)

				return { context: opts.data, headers: opts.headers as any }
			},
			open(peer) {
				global.open?.(toServerWebSocket(peer))
			},
			message(peer, message: Message) {
				const raw = message.rawData
				global.message?.(
					toServerWebSocket(peer),
					(typeof raw === 'string'
						? raw
						: message.uint8Array()) as string
				)
			},
			drain(peer) {
				global.drain?.(toServerWebSocket(peer))
			},
			close(peer, details) {
				global.close?.(
					toServerWebSocket(peer),
					details.code ?? 1000,
					details.reason ?? ''
				)
			}
		})

	return { createConfig, upgrade }
}
