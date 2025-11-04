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
		}
	})
	.get('/image', async () => file('test/kyuukurarin.mp4'))
	.get('/generator', async function* () {
		for (let i = 0; i < 10000; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10))
			yield 'A'
		}
	})
	.post('/', ({ body }) => body, {
		parse: 'json'
	})
	.get('/', ({ request }) => {
		console.log(request)

		return 'ok'
	})
	.listen(3000)

// console.log(app.fetch.toString())
