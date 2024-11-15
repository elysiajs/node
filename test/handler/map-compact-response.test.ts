import { describe, it, expect } from 'vitest'
import { mockRes, headersToObject } from './utils'

import { mapCompactResponse } from '../../src/handler'
import { form, file, Context } from 'elysia'
import { ElysiaFile } from 'elysia/universal/file'
import { createCookieJar } from 'elysia/cookies'

class Student {
	constructor(public name: string) {}

	toString() {
		return JSON.stringify({
			name: this.name
		})
	}

	toResponse() {
		return Response.json({
			name: this.name
		})
	}
}

class CustomResponse extends Response {}

describe('Node - Map Compact Response', () => {
	it('map string', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse('Shiroko', res)

		expect(response).toBe('Shiroko')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 7
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map number', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(1, res)

		expect(response).toBe('1')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 1
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map boolean', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(true, res)

		expect(response).toBe('true')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 4
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map object', () => {
		const res = mockRes()
		const body = {
			name: 'Shiroko'
		}

		const [response, set] = mapCompactResponse(body, res)

		expect(response).toBe(JSON.stringify(body))
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'application/json;charset=utf8',
			'content-length': 18
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map array', () => {
		const res = mockRes()
		const body = [
			{
				name: 'Shiroko'
			}
		]

		const [response, set] = mapCompactResponse(body, res)

		expect(response).toBe(JSON.stringify(body))
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'application/json;charset=utf8',
			'content-length': 20
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map function', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(() => 1, res)

		expect(response).toBe('1')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 1
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map undefined', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(undefined, res)

		expect(response).toBe('')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 0
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map null', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(null, res)

		expect(response).toBe('')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 0
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map Blob', () => {
		const res = mockRes()
		const image = file('./test/images/aris-yuzu.jpg')

		const [response, set] = mapCompactResponse(image, res)

		expect(response).toBeInstanceOf(ElysiaFile)
		// ? Unable to test because Node use buffer.pipe(res)
		// expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'image/jpeg',
			'accept-range': 'bytes',
			'content-range': `bytes 0-${image.length! - 1}/${image.length}`
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map Response', () => {
		const res = mockRes()
		const mockResponse = new Response('Shiroko')

		const [response, set] = mapCompactResponse(mockResponse, res)

		expect(response).toBe(mockResponse)
		// Unable to test because of an async operation
		// expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		// Unable to determine content type of Response
		// expect(set.headers).toEqual({
		// 	'content-type': 'text/plain;charset=utf8',
		// 	'content-length': 7
		// })
		// expect(set.headers).toEqual(res.headers)
	})

	it('map Error', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(new Error('Hello'), res)

		expect(JSON.parse(response as string)).toEqual({
			name: 'Error',
			message: 'Hello'
		})
		expect(response).toEqual(res.body)

		expect(set.status).toBe(500)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'application/json;charset=utf8',
			'content-length': 34
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map function', () => {
		const res = mockRes()
		const [response, set] = mapCompactResponse(() => 'a', res)

		expect(response).toEqual('a')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 1
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map Promise', async () => {
		const res = mockRes()
		const [response, set] = await mapCompactResponse(
			new Promise((resolve) => {
				resolve('a')
			}),
			res
		)

		expect(response).toEqual('a')
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'text/plain;charset=utf8',
			'content-length': 1
		})
		expect(set.headers).toEqual(res.headers)
	})

	// it('map cookie', () => {
	// 	const res = mockRes()

	// 	const setter: Context['set'] = {
	// 		cookie: {},
	// 		headers: {}
	// 	}

	// 	const name = 'Don Quixote'

	// 	const cookie = createCookieJar(setter, {})
	// 	cookie.name.value = name
	// 	const [response, set] = mapCompactResponse(cookie.name, res)

	// 	expect(response).toBe(name)
	// 	expect(response).toEqual(res.body)

	// 	expect(set.status).toBe(200)
	// 	expect(set.status).toEqual(res.status)

	// 	expect(set.headers).toEqual({
	// 		'content-type': 'text/plain;charset=utf8',
	// 		'content-length': name.length
	// 	})
	// 	expect(set.headers).toEqual(res.headers)
	// })

	it('map FormData', () => {
		const res = mockRes()

		const form = new FormData()
		form.append('name', 'Sancho')
		form.append('alias', 'Don Quixote')

		const [response, set] = mapCompactResponse(form, res)

		expect(response).toEqual(form)
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map custom class', async () => {
		const res = mockRes()

		const name = 'Rikuhachima Aru'
		const student = new Student(name)
		const [response, set] = await mapCompactResponse(student, res)

		expect(response).toEqual(
			JSON.stringify({
				name
			})
		)
		expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	// it('map Response and merge Headers', async () => {
	// 	const res = mockRes()
	// 	const mockResponse = new Response('Shiroko', {
	// 		headers: {
	// 			Name: 'Himari'
	// 		}
	// 	})

	// 	const [response, set] = await mapCompactResponse(
	// 		mockResponse,
	// 		res
	// 	)

	// 	// @ts-ignore
	// 	const headers = headersToObject(response.headers)

	// 	expect(response).toEqual(mockResponse)
	// 	// Unable to test because of an async operation
	// 	// expect(response).toEqual(res.body)

	// 	expect(set.status).toBe(200)
	// 	expect(set.status).toEqual(res.status)

	// 	// Unable to determine content type of Response
	// 	// expect(set.headers).toEqual({
	// 	// 	'content-type': 'text/plain;charset=utf8',
	// 	// 	'content-length': 7
	// 	// })
	// 	// expect(set.headers).toEqual(res.headers)
	// })

	// it('map custom class', async () => {
	// 	const response = mapCompactResponse(new Student('Himari'))

	// 	expect(response).toBeInstanceOf(Response)
	// 	expect(await response.json()).toEqual({
	// 		name: 'Himari'
	// 	})
	// 	expect(response.status).toBe(200)
	// })

	// it('map Response and merge Headers', async () => {
	// 	const response = mapCompactResponse(
	// 		new Response('Shiroko', {
	// 			headers: {
	// 				Name: 'Himari'
	// 			}
	// 		})
	// 	)

	// 	// @ts-ignore
	// 	const headers = response.headers.toJSON()

	// 	expect(response).toBeInstanceOf(Response)
	// 	expect(await response.text()).toEqual('Shiroko')
	// 	// @ts-ignore
	// 	expect(response.headers.toJSON()).toEqual({
	// 		...headers,
	// 		name: 'Himari'
	// 	})
	// })

	// it('map video content-range', async () => {
	// 	const kyuukararin = Bun.file('test/kyuukurarin.mp4')

	// 	const response = mapCompactResponse(kyuukararin)

	// 	expect(response).toBeInstanceOf(Response)
	// 	expect(response.headers.get('accept-ranges')).toEqual('bytes')
	// 	expect(response.headers.get('content-range')).toEqual(
	// 		`bytes 0-${kyuukararin.size - 1}/${kyuukararin.size}`
	// 	)
	// 	expect(response.status).toBe(200)
	// })

	// it('map formdata', async () => {
	// 	const response = mapCompactResponse(
	// 		form({
	// 			a: Bun.file('test/kyuukurarin.mp4')
	// 		})
	// 	)!

	// 	expect(response.headers.get('content-type')).toStartWith(
	// 		'multipart/form-data'
	// 	)
	// 	expect(response.status).toBe(200)
	// 	expect(await response.formData()).toBeInstanceOf(FormData)
	// })
})
