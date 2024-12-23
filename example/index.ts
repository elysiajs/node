import { Elysia } from 'elysia'
import { node } from '../src'

const plugin = async () => new Elysia().get('/async', () => 'ok')

const app = new Elysia({
	adapter: node()
})
	.post('/', ({ body }) => body, {
		type: 'json'
	})
	.get('/', 'ok')
	.listen(3000)
