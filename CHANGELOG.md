# 1.2.5 - 1 Feb 2025
- [#18](https://github.com/elysiajs/node/issues/18) reading cookie cause an error
- Unable to set response status when error is thrown

# 1.2.4 - 1 Feb 2025
Change:
- Support Elysia 1.2.11

Bug fix:
- [#23](https://github.com/elysiajs/node/issues/23) Response body object should not be disturbed or locked
- [#15](https://github.com/elysiajs/node/issues/15) Possibly fix `ReadableStream` duplex issue?
- [#14](https://github.com/elysiajs/node/issues/14) ReadableStream has already been used if request is reference multiple time

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
