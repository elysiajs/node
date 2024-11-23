// import { Readable } from 'stream'
// import { randomUUID } from 'crypto'

// let textEncoder: TextEncoder

// function isFormDataLike(payload: any) {
// 	return (
// 		payload &&
// 		typeof payload === 'object' &&
// 		typeof payload.append === 'function' &&
// 		typeof payload.delete === 'function' &&
// 		typeof payload.get === 'function' &&
// 		typeof payload.getAll === 'function' &&
// 		typeof payload.has === 'function' &&
// 		typeof payload.set === 'function' &&
// 		payload[Symbol.toStringTag] === 'FormData'
// 	)
// }

// /*! formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
// const escape = (str: string) =>
// 	str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22')

// const normalizeLinefeeds = (value: string) => value.replace(/\r?\n|\r/g, '\r\n')

// /*
//   partial code extraction and refactoring of `undici`.
//   MIT License. https://github.com/nodejs/undici/blob/043d8f1a89f606b1db259fc71f4c9bc8eb2aa1e6/lib/web/fetch/LICENSE
//   Reference https://github.com/nodejs/undici/blob/043d8f1a89f606b1db259fc71f4c9bc8eb2aa1e6/lib/web/fetch/body.js#L102-L168
// */
// function formDataToStream(formdata: FormData) {
// 	// lazy creation of TextEncoder
// 	textEncoder = textEncoder ?? new TextEncoder()

// 	// we expect the function argument must be FormData
// 	const boundary = `----formdata-${randomUUID()}`
// 	const prefix = `--${boundary}\r\nContent-Disposition: form-data`

// 	const linebreak = new Uint8Array([13, 10]) // '\r\n'

// 	async function* asyncIterator() {
// 		// @ts-expect-error FormData is iterable
// 		for (const [name, value] of formdata) {
// 			if (typeof value === 'string') {
// 				// header
// 				yield textEncoder.encode(
// 					`${prefix}; name="${escape(normalizeLinefeeds(name))}"\r\n\r\n`
// 				)
// 				// body
// 				yield textEncoder.encode(`${normalizeLinefeeds(value)}\r\n`)
// 			} else {
// 				let header = `${prefix}; name="${escape(normalizeLinefeeds(name))}"`
// 				value.name && (header += `; filename="${escape(value.name)}"`)
// 				header += `\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`
// 				// header
// 				yield textEncoder.encode(header)
// 				// body
// 				if (value.stream) {
// 					yield* value.stream()
// 				} /* c8 ignore start */ else {
// 					// shouldn't be here since Blob / File should provide .stream
// 					// and FormData always convert to USVString
// 					yield value
// 				} /* c8 ignore stop */
// 				yield linebreak
// 			}
// 		}
// 		// end
// 		yield textEncoder.encode(`--${boundary}--`)
// 	}

// 	const stream = Readable.from(asyncIterator())

// 	return {
// 		stream,
// 		contentType: `multipart/form-data; boundary=${boundary}`
// 	}
// }

// module.exports.isFormDataLike = isFormDataLike
// module.exports.formDataToStream = formDataToStream

// /**
//  * Get hostname:port
//  *
//  * @param {URL} parsedURL
//  * @return {String}
//  */
// function hostHeaderFromURL(parsedURL: URL) {
// 	return parsedURL.port
// 		? parsedURL.host
// 		: parsedURL.hostname +
// 				(parsedURL.protocol === 'https:' ? ':443' : ':80')
// }

// export class NodeRequest extends Readable {
// 	url: string
// 	method: string
// 	headers: Record<string, unknown>
// 	signal?: AbortSignal

// 	body?: any
// 	private payloadResume: boolean

// 	aborted = false
// 	httpVersionMajor = 1
// 	httpVersionMinor = 1
// 	httpVersion = '1.1'

// 	constructor(options: {
// 		url: string | URL
// 		method: string
// 		remoteAddress?: string
// 		headers?: Record<string, unknown>
// 		query?: Record<string, string>
// 		body?: ReadableStream
// 		signal?: AbortSignal
// 	}) {
// 		super()

// 		const headers: Record<string, unknown> = {}
// 		for (const field in options.headers) headers[field] = headers[field]

// 		let body = options.body
// 		let payloadResume = false

// 		if (isFormDataLike(body)) {
// 			const stream = formDataToStream(body)
// 			body = stream.stream
// 			payloadResume = true

// 			headers['content-type'] = stream.contentType
// 		}

// 		if (
// 			body &&
// 			typeof body !== 'string' &&
// 			!payloadResume &&
// 			!Buffer.isBuffer(body)
// 		) {
// 			body = JSON.stringify(body)

// 			if ('content-type' in headers === false)
// 				headers['content-type'] = 'application/json;charset=utf8'
// 		}

// 		// Set the content-length for the corresponding payload if none set
// 		if (body && !payloadResume && !Object.hasOwn(headers, 'content-length'))
// 			headers['content-length'] = (
// 				Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body)
// 			).toString()

// 		if (typeof options.url === 'string') this.url = options.url
// 		else this.url = options.url.pathname + options.url.search

// 		this.body = body
// 		this.payloadResume = payloadResume
// 		this.method = options.method ? options.method.toUpperCase() : 'GET'
// 		this.headers = headers
// 		this.signal = options.signal
// 	}

// 	private _rawHeaders: string[] = []
// 	get rawHeaders() {
// 		if (this._rawHeaders) return this._rawHeaders

// 		const raw: string[] = []

// 		for (const header of Object.keys(this.headers))
// 			raw.push(header, this.headers[header] as any)

// 		return (this._rawHeaders = raw)
// 	}
// }
