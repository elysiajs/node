import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { Elysia, file, form } from 'elysia'

import { node as http } from '../src'
import { node as websocket } from '../src/websocket'

test('configures websocket support', () => {
	assert.equal(http().websocket, false)
	assert.equal(websocket().websocket, true)
})

test('serves files in full, by range, and when empty', async () => {
	const image = 'test/images/midori.png'
	const bytes = readFileSync(image)
	const empty = join(mkdtempSync(join(tmpdir(), 'elysia-node-')), 'empty.txt')
	writeFileSync(empty, '')

	const port = 30000 + Math.floor(Math.random() * 20000)
	const app = new Elysia({ adapter: http() })
		.get('/image', file(image))
		.get('/empty', file(empty))
		.listen(port)
	const url = `http://localhost:${port}`

	try {
		const full = await fetch(`${url}/image`)
		assert.equal(full.status, 200)
		assert.equal(full.headers.get('content-type'), 'image/png')
		assert.equal(full.headers.get('content-length'), String(bytes.length))
		assert.equal(full.headers.get('accept-ranges'), 'bytes')
		assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes)

		const ranged = await fetch(`${url}/image`, {
			headers: { range: 'bytes=10-19' }
		})
		assert.equal(ranged.status, 206)
		assert.equal(
			ranged.headers.get('content-range'),
			`bytes 10-19/${bytes.length}`
		)
		assert.deepEqual(
			Buffer.from(await ranged.arrayBuffer()),
			bytes.subarray(10, 20)
		)

		const none = await fetch(`${url}/empty`)
		assert.equal(none.status, 200)
		assert.equal(none.headers.get('content-range'), null)
		assert.equal(await none.text(), '')
	} finally {
		await app.stop(true)
	}
})

test('form is sent as multipart', async () => {
	const body = () => form({ a: '1' })
	const own = () => form({ a: '1', constructor: { name: 'Function' } })

	// a subclass misses the switch and lands in mapFallback
	class Form extends Object.getPrototypeOf(form({})).constructor {}
	const fallback = () => Object.setPrototypeOf(body(), Form.prototype)

	const withHeader =
		(response: () => unknown) =>
		({ set }: { set: { headers: Record<string, unknown> } }) => {
			set.headers['x-a'] = '1'

			return response() as any
		}

	const port = 30000 + Math.floor(Math.random() * 20000)
	const app = new Elysia({ adapter: http() })
		.get('/sync', body)
		.get('/async', async () => body())
		.get('/own', own)
		.get('/fallback', fallback)
		.get('/fallback-async', async () => fallback())
		.get('/set', withHeader(body))
		.get('/set-async', async (context) => withHeader(body)(context))
		.get('/set-own', withHeader(own))
		.get('/set-fallback', withHeader(fallback))
		.get('/status', ({ status }) => status(201, body()))
		.listen(port)
	const url = `http://localhost:${port}`

	try {
		for (const path of [
			'sync',
			'async',
			'own',
			'fallback',
			'fallback-async',
			'set',
			'set-async',
			'set-own',
			'set-fallback',
			'status'
		]) {
			const response = await fetch(`${url}/${path}`)
			assert.equal(response.status, path === 'status' ? 201 : 200, path)
			assert.match(
				response.headers.get('content-type') ?? '',
				/^multipart\/form-data; boundary=/,
				path
			)
			assert.equal(
				response.headers.get('x-a'),
				path.startsWith('set') ? '1' : null,
				path
			)
			assert.equal((await response.formData()).get('a'), '1', path)
		}
	} finally {
		await app.stop(true)
	}
})

test('a constructor key in the body does not steer the response', async () => {
	const port = 30000 + Math.floor(Math.random() * 20000)
	const app = new Elysia({ adapter: http() })
		.post('/compact', ({ body }) => body)
		.post('/set', ({ body, set }) => {
			set.headers['x-a'] = '1'

			return body
		})
		.listen(port)
	const url = `http://localhost:${port}`

	try {
		for (const path of ['compact', 'set'])
			for (const name of ['Function', 'String', 'Promise']) {
				const body = { constructor: { name } }
				const response = await fetch(`${url}/${path}`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				})

				assert.equal(response.status, 200, `${path} ${name}`)
				assert.deepEqual(await response.json(), body, `${path} ${name}`)
			}
	} finally {
		await app.stop(true)
	}
})

// FastResponse reads its init when Node writes the response, later than
// afterResponse and later than the next request sharing a headers object
test('response is fixed once the handler returns', async () => {
	const shared = { 'x-shared': '1' }
	const bodies = {
		text: () => 'ok',
		number: () => 1,
		boolean: () => true,
		empty: () => null,
		formData: () => new FormData(),
		form: () => form({ a: '1' }),
		bytes: () => new Uint8Array([1]),
		file: () => file('test/images/midori.png')
	}

	const port = 30000 + Math.floor(Math.random() * 20000)
	const app = new Elysia({ adapter: http() })
		.onAfterResponse(({ path, set }) => {
			if (!path.startsWith('/hook')) return

			set.status = 202
			set.headers['x-a'] = 'after'
			;(set.headers['x-list'] as unknown as string[])[0] = 'after'
		})
		// a sync route writes before afterResponse runs, an async one doesn't
		.get('/hook/:kind', async ({ params, set }) => {
			set.status = 201
			set.headers['x-a'] = 'before'
			set.headers['x-list'] = ['before'] as unknown as string

			return bodies[params.kind as keyof typeof bodies]()
		})
		.get('/casing', ({ set }) => {
			set.headers['Content-Type'] = 'text/html'

			return '<b>ok</b>'
		})
		.get('/shared-text', ({ set }) => {
			set.headers = shared

			return 'ok'
		})
		.get('/shared-json', ({ set }) => {
			set.headers = shared

			return { ok: true }
		})
		.get('/cookies', ({ cookie }) => {
			cookie.a.value = '1'
			cookie.b.value = '2'

			return 'ok'
		})
		.listen(port)
	const url = `http://localhost:${port}`

	try {
		for (const kind of Object.keys(bodies)) {
			const hook = await fetch(`${url}/hook/${kind}`)
			assert.equal(hook.status, 201, kind)
			assert.equal(hook.headers.get('x-a'), 'before', kind)
			assert.equal(hook.headers.get('x-list'), 'before', kind)
		}

		const casing = await fetch(`${url}/casing`)
		assert.equal(casing.headers.get('content-type'), 'text/html')

		await fetch(`${url}/shared-text`)
		const json = await fetch(`${url}/shared-json`)
		assert.equal(json.headers.get('content-type'), 'application/json')

		const cookies = await fetch(`${url}/cookies`)
		assert.equal(cookies.headers.get('content-type'), 'text/plain')
		assert.equal(cookies.headers.getSetCookie().length, 2)
	} finally {
		await app.stop(true)
	}
})
