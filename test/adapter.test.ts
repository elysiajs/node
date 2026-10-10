import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { Elysia, file } from 'elysia'

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
