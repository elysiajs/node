import { Elysia, t } from 'elysia'
import { ElysiaNodeContext, node } from '../src'

const app = new Elysia({
	adapter: node()
})
	.onError(({ request }) => {
		return
	})
	.post(
		'/',
		({ body }) => {
			console.log({ body })

			return 'OK'
		},
		{
			body: t.Object({
				test: t.String()
			})
		}
	)
	.listen(3000)

// console.log(app._handle.toString())
// console.log(app.routes[0].compile().toString())
// console.log(app.handleError.toString())

const main = async () => {
	const res = await fetch('http://localhost:3000/', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ bad: '' })
	})

	console.log('status', res.status)

	// app.stop(true)
}

main()
