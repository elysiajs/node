import { Elysia, t } from 'elysia'
import { node } from '../src'
import cors from '@elysiajs/cors'

const app = new Elysia({
	adapter: node()
})
	.use(cors())
	.get('/home', () => {
		return 'Home'
	})
