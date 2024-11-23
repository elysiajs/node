import type { IncomingMessage, ServerResponse } from 'http'

type HttpResponse = ServerResponse<IncomingMessage> & {
	req: IncomingMessage
}

export const headersToObject = (headers: Headers) => {
	const h: Record<string, unknown> = {}

	// @ts-expect-error
	for (const [k, v] of headers.entries()) h[k] = v

	return h
}

export const mockRes = (): HttpResponse & {
	body: unknown
	status: number
	headers: Record<string, any>
} => {
	let status = 200
	let headers: Record<string, unknown> = {}
	let body: any

	return {
		writeHead(_status: number, _headers: Record<string, unknown>) {
			status = _status
			headers = _headers
		},
		setHeader(key: string, value: unknown) {
			headers[key] = value
		},
		end(_body: any) {
			body = _body
		},
		pipe(_: HttpResponse) {},
		get statusCode() {
			return status
		},
		set statusCode(_status: number) {
			status = _status
		},
		get status() {
			return status
		},
		get headers() {
			return headers
		},
		get body() {
			return body
		},
		on() {},
		once() {},
		emit() {},
		write() {}
	} as any
}
