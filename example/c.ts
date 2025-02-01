import { Elysia } from 'elysia'
import { node } from '../src'
import cors from '@elysiajs/cors'

const app = new Elysia({
	adapter: node()
})
	.use(
		cors({
			origin: true,
			credentials: true,
			preflight: true
		})
	)
	.post('/', ({ body }) => body)
	.listen(8000, ({ port }) => {
		console.log(`Server is running on http://localhost:${port}`)

		fetch('http://localhost:8000', {
			headers: {
				authorization: `Bearer 12345`
			}
		})
	})

// console.log(app._handle.toString())
// console.log(app.routes[0].compile().toString())
