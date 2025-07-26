import type uWS from 'uWebSockets.js'

export const createWebRequest = (
	res: uWS.HttpResponse,
	req: uWS.HttpRequest
): Request => {
	const host = req.getHeader('host') || 'localhost'
	const url = `http://${host}${req.getUrl()}${
		req.getQuery() ? '?' + req.getQuery() : ''
	}`

	const headers = new Headers()
	req.forEach((key, value) => {
		headers.append(key, value)
	})

	let body: BodyInit | null = null
	const contentLength = headers.get('content-length')

	if (contentLength && contentLength !== '0') {
		body = new ReadableStream({
			start(controller) {
				res.onData((chunk, isLast) => {
					controller.enqueue(new Uint8Array(chunk))
					if (isLast) controller.close()
				})

				res.onAborted(() => {
					controller.error(new Error('Request aborted'))
				})
			}
		})
	}

	return new Request(url, {
		method: req.getMethod().toUpperCase(),
		headers,
		body
	})
}

export const applyResponse = async (
	res: uWS.HttpResponse,
	response: Response
) => {
	if (res.aborted) return

	res.writeStatus(`${response.status} ${response.statusText || ''}`)

	response.headers.forEach((value, key) => {
		res.writeHeader(key, value)
	})

	if (response.body) {
		try {
			const reader = response.body.getReader()

			while (true) {
				if (res.aborted) break

				const { done, value } = await reader.read()
				if (done) break

				// Write the chunk
				res.write(value)
			}

			reader.releaseLock()
		} catch (error) {
			console.error('Streaming error:', error)
			if (!res.aborted) {
				res.writeStatus('500 Internal Server Error')
				res.end('Streaming error')
			}
			return
		}
	}

	if (!res.aborted) {
		res.end()
	}
}
