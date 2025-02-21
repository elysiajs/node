import { describe, it, expect } from 'vitest'
import { mockRes } from '../utils'

import { form, file, redirect } from 'elysia'

import { ElysiaFile } from 'elysia/universal/file'
import { mapEarlyResponse } from '../../src/handler'
import { openAsBlob } from 'node:fs'

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

const createContext = () =>
	({
		cookie: {},
		headers: {},
		status: 200
	}) satisfies Context['set']

describe('Node - Map Response', () => {
	it('map string', () => {
		const res = mockRes()
		const [response, set] = mapEarlyResponse(
			'Shiroko',
			createContext(),
			res
		)

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
		const [response, set] = mapEarlyResponse(1, createContext(), res)

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
		const [response, set] = mapEarlyResponse(true, createContext(), res)

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

		const [response, set] = mapEarlyResponse(body, createContext(), res)

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

		const [response, set] = mapEarlyResponse(body, createContext(), res)

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
		const [response, set] = mapEarlyResponse(() => 1, createContext(), res)

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
		expect(
			mapEarlyResponse(undefined, createContext(), mockRes())
		).toBeUndefined()
	})

	it('map null', () => {
		expect(
			mapEarlyResponse(undefined, createContext(), mockRes())
		).toBeUndefined()
	})

	it('map Blob', async () => {
		const res = mockRes()
		const image = file('./test/images/aris-yuzu.jpg')

		const [response, set] = await mapEarlyResponse(
			image,
			createContext(),
			res
		)

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

		const [response, set] = mapEarlyResponse(
			mockResponse.clone(),
			createContext(),
			res
		)

		expect(Buffer.from(await response).toString()).toBe(
			await mockResponse.text()
		)
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
		const [response, set] = mapEarlyResponse(
			new Error('Hello'),
			createContext(),
			res
		)

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
		const [response, set] = mapEarlyResponse(
			() => 'a',
			createContext(),
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

	it('map Promise', async () => {
		const res = mockRes()
		const [response, set] = await mapEarlyResponse(
			new Promise((resolve) => {
				resolve('a')
			}),
			createContext(),
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

		const [response, set] = mapEarlyResponse(form, createContext(), res)

		expect(response).toEqual(form)

		expect(set.status).toBe(200)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map custom class', async () => {
		const res = mockRes()

		const student = new Student('Rikuhachima Aru')
		const [response, set] = await mapEarlyResponse(student, res)

		// @ts-ignore
		expect(Buffer.from(await response).toString()).toEqual(
			await student.toResponse().text()
		)

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

		const [response, set] = mapEarlyResponse(formData, createContext(), res)

		expect(response).toEqual(formData)

		expect(set.status).toBe(200)

		// ? Unable to determine FormData headers (require checksum stuff)
		// expect(set.headers).toEqual({})
		// expect(set.headers).toEqual(res.headers)
	})

	it('map redirect', () => {
		const res = mockRes()

		const [response, set] = mapEarlyResponse(
			redirect('https://unwelcome.school/'),
			createContext(),
			res
		)

		expect(set.status).toBe(302)
		expect(set.status).toEqual(res.status)

		expect(set.headers).toEqual({
			location: 'https://unwelcome.school/'
		})
		expect(set.headers).toEqual(res.headers)
	})

	it('set response headers', () => {
		const res = mockRes()

		const [response, set] = mapEarlyResponse(
			'Shiroko',
			{
				status: 200,
				headers: {
					alias: 'Abydos'
				}
			},
			res
		)

		expect(set.headers).toEqual({
			alias: 'Abydos',
			'content-length': 7,
			'content-type': 'text/plain;charset=utf8'
		})
		expect(res.headers).toEqual(set.headers)
	})

	it('map Response and merge Headers', async () => {
		const res = mockRes()

		const [response, set] = mapEarlyResponse(
			new Response('Shiroko', {
				headers: {
					Name: 'Himari'
				}
			}),
			{
				headers: {
					club: 'Paranormal Affairs Department'
				}
			},
			res
		)

		expect(set.headers).toEqual({
			name: 'Himari',
			club: 'Paranormal Affairs Department',
			'content-type': 'text/plain;charset=UTF-8'
		})
		expect(res.headers).toEqual(set.headers)
	})

	it('map named status', async () => {
		const res = mockRes()

		const [response, set] = mapEarlyResponse(
			'Shiroko',
			{
				status: "I'm a teapot",
				headers: {},
				cookie: {}
			},
			res
		)

		expect(set.status).toBe(418)
		expect(set.status).toEqual(res.status)
	})

	it('map file', async () => {
		const res = mockRes()

		const [response, set] = await mapEarlyResponse(
			new File(
				[await openAsBlob('./test/images/midori.png')],
				'midori.png',
				{
					type: 'image/jpeg'
				}
			),
			createContext(),
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
