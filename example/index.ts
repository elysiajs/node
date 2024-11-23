import { Elysia, t } from 'elysia'
import { file } from 'elysia'
import { node } from '../src'
import http from 'http'

const body = Buffer.from('Hello, World!');
const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);

const app = new Elysia({
	adapter: node()
})
	.macro({
		randomId(enabled: boolean) {
			return {
				resolve() {
					return {
						id: ~~(Math.random() * 1000000)
					}
				}
			}
		}
	})
	.onError(({ error, code }) => {
		if (code === 'PARSE') {
			console.log(error)
		}
	})
	.get('/', 'hi')
	.post('/', ({ body }) => body)
	.post('/file', ({ body: { image } }) => image, {
		body: t.Object({
			image: t.File({ type: 'image' })
		})
	})
	.ws('/', {
		message: ({ body }) => body
	})
	.listen(3000)
