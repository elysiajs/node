# @elysiajs/node
Adapter for [elysia](https://github.com/elysiajs/elysia) to use Elysia in Nodejs environment.

## Installation
```bash
bun add @elysiajs/node
```

## Example
```typescript
import { Elysia } from 'elysia'
import { node } from '@elysiajs/node'

const app = new Elysia({ adapter: node() })
    .get('/', () => 'Hello Node!')
    .listen(3000)
```
