# @elysiajs/node

A high-performance, fully-featured adapter for [Elysia](https://github.com/elysiajs/elysia) to run on the Node.js environment using `uWebSockets.js`.

This adapter brings the raw performance of `uWebSockets.js` to Node.js, providing a server environment that is architecturally consistent with Elysia's native Bun runtime.

## Features

-   🚀 High-performance HTTP server
-   🔌 **Full WebSocket Support**: Includes the powerful `publish/subscribe` API.
-   streamed bodies: generator support
-   🦊 Near 1:1 API compatibility with the Bun adapter.

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
