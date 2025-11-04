import { Elysia, file, sse } from 'elysia'

import { node } from '../src'

new Elysia({ adapter: node() })
	.get('/video', file('test/kyuukurarin.mp4'))
	.listen(3000)
