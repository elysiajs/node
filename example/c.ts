import { Elysia } from 'elysia'
import { node } from '../src'

new Elysia({ adapter: node() })
	.ws('/', {
		upgrade({ set }) {
			set.headers['a'] = 'b'
		},
		open(ws) {
			ws.subscribe('topic')
			ws.publish('topic', 'Hello')
		},
		message(ws, message) {
			ws.publish('topic', message)
		}
	})
	.listen(3000)
