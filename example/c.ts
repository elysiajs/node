import { Elysia, t } from 'elysia'
import { node } from '../src'
import cors from '@elysiajs/cors'

const app = new Elysia({ adapter: node() })
	.use((app) =>
		app
			.derive({ as: 'global' }, async ({ cookie }) => {})
			.onAfterHandle({ as: 'global' }, async ({ response }) => {
				console.log('onAfterHandle', response)
				// await commitSession();
				return response
			})
	)
	.get('/', () => 'Hello World')
	.listen(3000)

console.log(app._handle)
