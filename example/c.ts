import { Elysia } from 'elysia'
import { node } from '../src'

const plugin = new Elysia({ prefix: '/api/v1' }).post(
	'/',
	async ({ body, store, error, request }) => {
		return {
			message: 'Hello World'
		}
	}
)

const app = new Elysia({
	adapter: node()
})
	.use(plugin)
	.listen(8000, ({ port }) => {
		console.log(`Server is running on http://localhost:${port}`)
	})

// console.log(app._handle.toString())
// console.log(app.routes[0].compile().toString())
