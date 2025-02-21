import { Elysia } from 'elysia'
import node from '../src'

new Elysia({ adapter: node() })
	.onError(({ error }) => {
		return error
	})
	.derive(({ body }) => {
		return {
			operation: {
				a: 'test',
				body
			}
		}
	})
	.post(`/bug`, ({ operation }) => {
		return operation
	})
	.listen(3777)

fetch('http://localhost:3777/bug', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({ operation: 'test' })
})
	.then((x) => x.text())
	.then(console.log)
