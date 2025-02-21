import { Elysia } from 'elysia'
import node from '../src'
import { mockRes } from '../test/utils'
import { mapCompactResponse } from '../src/handler'

const res = mockRes()

const form = new FormData()
form.append('name', 'Sancho')
form.append('alias', 'Don Quixote')

const [response, set] = mapCompactResponse(form, res)

console.log(response)

// expect(response).toEqual(form)
// expect(response).toEqual(res.body)

// expect(set.status).toBe(200)
// expect(set.status).toEqual(res.status)
