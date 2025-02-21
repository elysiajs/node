import { describe, it, expect } from 'vitest'
import { mockRes } from '../utils'

import { form, file, redirect } from 'elysia'

import { ElysiaFile } from 'elysia/universal/file'
import { mapCompactResponse } from '../../src/handler'
import { readFileToWebStandardFile } from '../../src/utils'
import { openAsBlob } from 'fs'

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
	it('map string', async () => {
		const res = mockRes()
		const [response, set] = await mapCompactResponse('Shiroko', res)

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

	it('map Blob', async () => {
		const res = mockRes()
		const image = file('./test/images/aris-yuzu.jpg')

		const [response, set] = await mapCompactResponse(image, res)

		expect(response).toBeInstanceOf(ElysiaFile)
		// ? Unable to test because Node use buffer.pipe(res)
		// expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			'content-type': 'image/jpeg',
			'accept-range': 'bytes',
			'content-range': `bytes 0-${(await (image.length as number)!) - 1}/${await image.length}`
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map Response', async () => {
		const res = mockRes()
		const mockResponse = new Response('Shiroko')

		const [response, set] = mapCompactResponse(mockResponse.clone(), res)

		// @ts-expect-error
		expect(Buffer.from(await response).toString()).toBe(
			await mockResponse.text()
		)

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

		expect(set.status).toBe(200)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map custom class', async () => {
		const res = mockRes()

		const student = new Student('Rikuhachima Aru')
		const [response, set] = await mapCompactResponse(student, res)

		// @ts-ignore
		expect(Buffer.from(await response).toString()).toEqual(
			await student.toResponse().text()
		)
		// expect(response).toEqual(res.body)

		expect(set.status).toBe(200)
		expect(set.status).toEqual(res.status)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map formdata function', () => {
		const res = mockRes()

		const formData = form({
			name: 'Sancho',
			alias: 'Don Quixote'
		})

		const [response, set] = mapCompactResponse(formData, res)

		expect(response).toEqual(formData)

		expect(set.status).toBe(200)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map redirect', () => {
		const res = mockRes()

		const [response, set] = mapCompactResponse(
			redirect('https://unwelcome.school/'),
			res
		)

		expect(set.status).toBe(302)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			location: 'https://unwelcome.school/'
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('map file', async () => {
		const res = mockRes()

		const [response, set] = await mapCompactResponse(
			new File(
				[await openAsBlob('./test/images/midori.png')],
				'midori.png',
				{
					type: 'image/jpeg'
				}
			),
			res
		)

		expect(res.body).toBeInstanceOf(Buffer)
		expect((res.body as Buffer).byteLength).toBe(70943)

		expect(set.headers).toEqual({
			'content-type': 'image/jpeg',
			'content-range': 'bytes 0-70942/70943'
		})
		expect(set.headers).toEqual(res.headers)
	})
})
