import { Elysia, file } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'

import { node } from '../src'

const app = new Elysia({
	adapter: node()
})
	.use(cors())
	.use(swagger())
	.ws('/ws', {
		open() {
			console.log('OPENED')
		},
		message(ws, message) {
			ws.send(message)
		}
	})
	.get('/image', async () => file('test/images/midori.png'))
	.get('/generator', async function* () {
		for (let i = 0; i < 100; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10))
			yield 'A'
		}
	})
	.post('/', ({ body }) => body, {
		type: 'json'
	})
	.get('/', () => 'ok')
	.listen(3000)
