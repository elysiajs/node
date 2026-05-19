import { Elysia, file, sse } from 'elysia'
import { cors } from '@elysiajs/cors'
import { fromTypes, openapi } from '@elysiajs/openapi'

import { node } from '../src'

const subapp = new Elysia({ adapter: node() }).ws('/', {
	message: () => 'Hello WebSocket'
})

const app = new Elysia({
	adapter: node()
})
	.use(subapp)
	.listen(3000)
