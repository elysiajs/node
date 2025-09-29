import { Elysia, file, sse } from 'elysia'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'

import { node } from '../src'

const app = new Elysia({
	adapter: node()
})
	.use(cors())
	.use(openapi())
	.ws('/ws/:id', {
		open({ data, subscribe, isSubscribed }) {
			subscribe('welcome')
		},
		message(ws, message) {
			ws.send(message)
		},
		close(ws, code, reason) {}
	})
	.get('/image', async () => file('test/kyuukurarin.mp4'))
	.get('/generator', async function* () {
		for (let i = 0; i < 100; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10))
			yield sse('A')
		}
	})
	.post('/', ({ body }) => body, {
		type: 'json'
	})
	.get('/', ({ request }) => {
		console.log(request)

		return 'ok'
	})
	.listen(3000)

// console.log(app.fetch.toString())
