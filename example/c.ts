import { Elysia } from 'elysia'
import node from '../src'

export const elysiaApp = new Elysia({
	adapter: node()
})
	// .onError(({ error }) => {
	// 	console.log(error)
	// })
	.patch('/', () => {
		const form = new FormData()
		form.append('name', 'Sancho')
		form.append('alias', 'Don Quixote')

		return form
	})

export type ElysiaApp = typeof elysiaApp

elysiaApp.listen(3334)
console.log('Server started at http://localhost:3334')

fetch('http://localhost:3334/', { method: 'PATCH' })
	.then((x) => x.formData())
	.then(console.log)
