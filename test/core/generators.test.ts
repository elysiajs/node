import Elysia from 'elysia'
import { inject } from 'light-my-request'
import { describe, it, expect } from 'vitest'

import node from '../../src'

function delay(n: number) {
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve(null)
        }, n)
    })
}

const app =  new Elysia({ adapter: node() })
    .get("/what", ()=>"feafe")
    .get('/', function* gen({set}) {
        set.headers["content-type"] = "application/json"
        set.headers["content-disposition"] = 'attachment; filename="test.json"'
        yield JSON.stringify({x: "hi"})
    })
    .get('/async-simple', async function* gen({set}) {
        set.headers["content-type"] = "application/json"
        set.headers["content-disposition"] = 'attachment; filename="test.json"'
        await delay(100)
        yield JSON.stringify({x: "hi"})
    })
    .get('/async-hard', async function* gen({set}) {
        await delay(100)
        set.headers["content-type"] = "application/json"
        set.headers["content-disposition"] = 'attachment; filename="test.json"'
        await delay(100)
        yield JSON.stringify({x: "hi"})
    })
    .compile()


// @ts-expect-error
const handle = app._handle!

describe("Async generators", ()=>{

    it("handle /", async ()=>{
        await inject(handle, { path: "/"}, (error, res)=>{
            console.log(res)
            expect(res?.headers["content-type"]).toBe("application/json")
            expect(res?.headers["content-disposition"]).toBe('attachment; filename="test.json"')
        })
    })

    it("handle /async-simple", async ()=>{
        await inject(handle, { path: "/async-simple"}, (error, res)=>{
            expect(true).toBe(false)
            expect(res?.headers["content-type"]).toBe("application/json")
            expect(res?.headers["content-disposition"]).toBe('attachment; filename="test.json"')
        })
    })

    it("handle /async-hard", async ()=>{
        await inject(handle, { path: "/async-hard"}, (error, res)=>{
            expect(res?.headers["content-type"]).toBe("application/json")
            expect(res?.headers["content-disposition"]).toBe('attachment; filename="test.json"')
        })
    })
})
