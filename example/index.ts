import { cors } from '@elysiajs/cors'
import swagger from '@elysiajs/swagger'
import { Elysia, file } from 'elysia'
import { node } from '../src'

const app = new Elysia({
	adapter: node()
})
	.use(cors())
	.use(swagger())
	.get('/image', async () => file('test/kyuukurarin.mp4'))
	.get('/generator', async function* () {
		for (let i = 0; i < 100; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10))
			yield 'A'
		}
	})
	.get('/stream', async function* () {
		for (let i = 0; i < 10; i++) {
			yield `Chunk ${i}\n`
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	})
	.post('/', ({ body }) => body, {
		type: 'json'
	})
	.get('/', () => 'Hello from uWebSockets.js!')
	.ws('/ws', {
		open(ws) {
			console.log('WebSocket connected')
			ws.subscribe('chat')
			ws.publish('chat', 'Someone joined the chat!')
		},
		message(ws, message) {
			console.log('Received message:', message)
			ws.publish('chat', `Echo: ${message}`)
		},
		close(ws) {
			console.log('WebSocket disconnected')
		}
	})
	.listen(3000, (server) => {
		console.log(`🦊 Elysia is running at ${server.hostname}:${server.port}`)
		console.log(
			`WebSocket available at ws://${server.hostname}:${server.port}/ws`
		)
	})
