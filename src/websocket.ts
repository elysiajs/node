import { serve } from 'crossws/server'
import { websocket } from 'elysia/websocket'

import { createNodeAdapter } from './adapter'
import { createWebSocketAdapter } from './ws'

export const node = () =>
	createNodeAdapter(serve, createWebSocketAdapter(), {
		setup: (app) => app.use(websocket())
	})

export default node
