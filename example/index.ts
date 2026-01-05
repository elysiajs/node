import { Elysia, file, sse } from 'elysia'
import { cors } from '@elysiajs/cors'
import { fromTypes, openapi } from '@elysiajs/openapi'

import { node } from '../src'

const app = new Elysia({
	adapter: node()
})

app.use(cors())
	.use(openapi())
	.get('/redirect', ({ cookie, redirect }) => {
		cookie.a.value = 'cookie value'

		return redirect('https://example.com')
	})
	.ws('/ws/:id', {
		open({ data, subscribe, isSubscribed }) {
			console.log(data)
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
	.get('/', () => 'ok')
	.listen(3000)
