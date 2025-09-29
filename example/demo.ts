import { serve } from 'crossws/server'

serve({
	fetch: () => new Response("A", {
		status: 404
	}),
	websocket: {
		upgrade(request) {
			console.log(`[ws] upgrading ${request.url}...`)
			return {
				// namespace: new URL(req.url).pathname
				headers: {}
			}
		},

		open(peer) {
			console.log(`[ws] open: ${peer}`)
		},

		message(peer, message) {
			console.log('[ws] message', peer, message)
			if (message.text().includes('ping')) {
				peer.send('pong')
			}
		},

		close(peer, event) {
			console.log('[ws] close', peer, event)
		},

		error(peer, error) {
			console.log('[ws] error', peer, error)
		}
	}
})
