import assert from 'node:assert/strict'
import test from 'node:test'

import { Elysia, status } from 'elysia'

import { node as http } from '../src'
import { node as websocket } from '../src/websocket'

test('configures websocket support', () => {
	assert.equal(http().setup, undefined)
	assert.equal(typeof websocket().setup, 'function')
})

test('keeps the status code of an ElysiaStatus', async () => {
	const app = new Elysia({ adapter: http() })
		.get('/value', () => status(201, { created: true }))
		.get('/text', () => status(418, "I'm a teapot"))
		.get('/thrown', () => {
			throw status(409, 'conflict')
		})
		.get('/set', ({ set }) => {
			set.headers['x-test'] = '1'
			return status(202, 'accepted')
		})
		.guard({ beforeHandle: ({ status }) => status(401) }, (app) =>
			app.get('/guarded', () => 'secret')
		)

	for (const [path, code] of [
		['/value', 201],
		['/text', 418],
		['/thrown', 409],
		['/set', 202],
		['/guarded', 401]
	] as const) {
		const response = await app.handle(
			new Request(`http://localhost${path}`)
		)

		assert.equal(response.status, code, path)
	}
})
