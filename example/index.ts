import { Elysia, file } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { node } from '../src'

const app = new Elysia({ adapter: node() })
	.use((app) =>
		app
			.derive({ as: 'global' }, async ({ cookie }) => {})
			.onAfterHandle({ as: 'global' }, async ({ response }) => {
				return response
			})
	)
	.get('/', () => 'ok')
	.listen(3000)
