import assert from 'node:assert/strict'
import test from 'node:test'

import { node as http } from '../src'
import { node as websocket } from '../src/websocket'

test('configures websocket support', () => {
	assert.equal(http().websocket, false)
	assert.equal(websocket().websocket, true)
})
