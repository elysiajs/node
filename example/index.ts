import { Elysia, t } from 'elysia'
import { node } from '../src/index'
import { mapCompactResponse } from '../src/handler'
import { mockRes } from '../test/handler/utils'
import { createCookieJar } from 'elysia/cookies'

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

const main = async () => {
	const res = mockRes()
	const [response, set] = await mapCompactResponse(new Student('Aru'), res)

	console.log(response, set)
}

main()

// const app = new Elysia({
// 	// @ts-expect-error
// 	adapter: typeof Bun === 'undefined' ? node() : undefined
// })
// 	.decorate('a', 'a')
// 	.state('b', 'b')
// 	.ws('/', {
// 		resolve: () => ({
// 			random: ~~(Math.random() * 1000000)
// 		}),
// 		message({ send, data: { random, a, store } }) {
// 			send({ random, a, store })
// 		}
// 	})
// 	.listen(3000)
