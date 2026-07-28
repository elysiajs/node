import { Elysia, file, sse } from 'elysia'

import { node } from '../src/websocket'
import { websocket } from 'elysia/websocket'

const subapp = new Elysia().use(websocket()).ws('/', function* () {
	yield 'OK'
	yield 'Hello WebSocket'
})

new Elysia({
	adapter: node()
})
	.get('/', () => 'ok')
	.use(subapp)
	.listen(3000)
