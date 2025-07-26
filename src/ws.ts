import type {
	ServerWebSocket,
	ServerWebSocketSendStatus,
	WebSocketReadyState
} from 'elysia/ws/bun'
import uWS from 'uWebSockets.js'

export class UwsWebSocketWrapper<T = any> implements ServerWebSocket<T> {
	constructor(private ws: uWS.WebSocket<T>) {}

	get readyState(): WebSocketReadyState {
		return 1 as WebSocketReadyState // OPEN state
	}

	get remoteAddress() {
		return Buffer.from(this.ws.getRemoteAddressAsText()).toString()
	}

	get data() {
		return this.ws.getUserData()
	}

	send(data: string | Buffer, compress?: boolean): ServerWebSocketSendStatus {
		const isBinary = Buffer.isBuffer(data)
		return this.ws.send(data, isBinary, compress)
	}

	sendText(data: string, compress?: boolean): ServerWebSocketSendStatus {
		return this.ws.send(data, false, compress)
	}

	sendBinary(data: Buffer, compress?: boolean): ServerWebSocketSendStatus {
		return this.ws.send(data, true, compress)
	}

	ping(data?: string | Buffer): ServerWebSocketSendStatus {
		return this.ws.ping(data)
	}

	pong(data?: string | Buffer): ServerWebSocketSendStatus {
		return 1 // uWS handles pong automatically
	}

	close(code?: number, reason?: string): void {
		if (code !== undefined) {
			this.ws.end(code, reason)
		} else {
			this.ws.close()
		}
	}

	terminate(): void {
		this.ws.close()
	}

	subscribe(topic: string): void {
		this.ws.subscribe(topic)
	}

	unsubscribe(topic: string): void {
		this.ws.unsubscribe(topic)
	}

	publish(
		topic: string,
		data: string | Buffer,
		compress?: boolean
	): ServerWebSocketSendStatus {
		const isBinary = Buffer.isBuffer(data)
		const result = this.ws.publish(topic, data, isBinary, compress)
		return result ? 1 : 0
	}

	publishText(
		topic: string,
		data: string,
		compress?: boolean
	): ServerWebSocketSendStatus {
		const result = this.ws.publish(topic, data, false, compress)
		return result ? 1 : 0
	}

	publishBinary(
		topic: string,
		data: Buffer,
		compress?: boolean
	): ServerWebSocketSendStatus {
		const result = this.ws.publish(topic, data, true, compress)
		return result ? 1 : 0
	}

	isSubscribed(topic: string): boolean {
		return this.ws.isSubscribed(topic)
	}

	cork<T = unknown>(callback: (ws: ServerWebSocket<T>) => T): T {
		let result: T
		this.ws.cork(() => {
			result = callback(this as unknown as ServerWebSocket<T>)
		})
		return result!
	}
}
