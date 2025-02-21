import { Elysia, file } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { node } from '../src'

const plugin = async () => new Elysia().get('/async', () => 'ok')

const app = new Elysia({
	adapter: node()
})
	.use(cors())
	.use(swagger())
	.get('/image', () => file('test/kyuukurarin.mp4'))
	.post('/', ({ body }) => body, {
		type: 'json'
	})
	.get('/', () => 'ok')
	.ws('/ws', {
		message(ws, message) {
			ws.send(message)
		}
	})
	.listen(3000)
