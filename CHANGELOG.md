# 1.4.0 - 27 July 2025

### Added
- Full WebSocket support with publish/subscribe API
- WebSocket lifecycle events (open, message, close)
- `UwsWebSocketWrapper` class for Elysia WebSocket compatibility

### Changed
- **BREAKING**: Upgraded to uWebSockets.js for high performance
- Refactored server architecture for Bun runtime compatibility
- Enhanced streaming request/response handling

### Improved
- Near 1:1 API compatibility with Bun adapter
- Better error handling for WebSocket upgrades
- Streamlined server setup and route registration

### Technical
- Added `createWebRequest` and `applyResponse` utilities
- Integrated with Elysia's WebSocket validation system
- Support for binary/text WebSocket messages

# 1.3.0 - 27 May 2025
Change:
- use WebStandard Compatibility via `@hono/node-server`

# 1.2.6 - 21 Feb 2025
Bug fix:
- [#34](https://github.com/elysiajs/node/issues/34) ERR_HTTP_HEADERS_SENT when sending FormData
- [#29](https://github.com/elysiajs/node/issues/29), [#30](https://github.com/elysiajs/node/pull/30) server.reload() causes Uncaught AddrInUse: Address already in use

# 1.2.5 - 1 Feb 2025
Bug fix:
- [#23](https://github.com/elysiajs/node/issues/23) Response body object should not be disturbed or locked

# 1.2.4 - 1 Feb 2025
Change:
- Support Elysia 1.2.11

Bug fix:
- [#23](https://github.com/elysiajs/node/issues/23) Response body object should not be disturbed or locked
- [#15](https://github.com/elysiajs/node/issues/15) Possibly fix `ReadableStream` duplex issue?
- [#14](https://github.com/elysiajs/node/issues/14) ReadableStream has already been used if request is reference multiple time
- [#18](https://github.com/elysiajs/node/issues/18) reading cookie cause an error
- Unable to set response status when error is thrown

# 1.2.3 - 27 Dec 2024
Bug fix:
- async module doesn't load (eg. @elysiajs/swagger)

# 1.2.2 - 27 Dec 2024
Bug fix:
- Set minimum Elysia version to 1.2.7
- Response doesn't reconcile when handler return `Response` is used with `mapResponse`
- [#11](https://github.com/elysiajs/node/pull/11) `Content-Length` with `UTF-8` 2-byte characters
- Ponyfill for `fs.openAsBlob` and `Promise.withResolve`

# 1.2.1 - 25 Dec 2024
Change:
- Set minimum Elysia version to 1.2.3

Bug fix:
- decorator name with space is not working

# 1.2.0 - 24 Dec 2024
Feature:
- init
