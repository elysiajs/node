import { Elysia, file, sse } from 'elysia'

import { node } from '../src'

const subapp = new Elysia({ adapter: node() }).ws('/', function* () {
	yield "OK"
	yield 'Hello WebSocket'
})

const app = new Elysia({
	adapter: node()
})
	.get('/', 'ok')
	.use(subapp)
	.listen(3000)
