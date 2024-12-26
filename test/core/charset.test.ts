import Elysia from 'elysia'
import { inject } from 'light-my-request'
import { describe, it, expect } from 'vitest'

import node from '../../src'

const app = new Elysia({ adapter: node() })
	.get('/', () => ({ utf: 'ú' }))
	.compile()

// @ts-expect-error
const handle = app._handle!

describe('Node - Charset', () => {
	it('handle UTF-8 2-byte characters', () => {
		inject(handle, { path: '/' }, (error, res) => {
			expect(error).toBeNull()

			const expected = JSON.stringify({ utf: 'ú' })

			expect(res?.body).toBe(expected)
			expect(res?.headers['content-type']).toBe(
				'application/json;charset=utf8'
			)
			expect(res?.headers['content-length']).toBe(
				new TextEncoder().encode(expected).byteLength.toString()
			)
		})
	})
})
