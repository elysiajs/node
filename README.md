# @elysiajs/bearer
Plugin for [elysia](https://github.com/elysiajs/elysia) for retrieving Bearer token.

This plugin is for retrieving a Bearer token specified in [RFC6750](https://www.rfc-editor.org/rfc/rfc6750#section-2).

This plugin **DOES NOT** handle authentication validation for your server, rather the plugin leaves the decision for developers to apply logic for handle validation check themself.

## Installation
```bash
bun add @elysiajs/bearer
```

## Example
```typescript
import { Elysia } from 'elysia'
import { bearer } from '@elysiajs/bearer'

const app = new Elysia()
    .use(bearer())
    .get('/sign', ({ bearer }) => bearer, {
        beforeHandle({ bearer, set }) {
            if (!bearer) {
                set.status = 400
                set.headers[
                    'WWW-Authenticate'
                ] = `Bearer realm='sign', error="invalid_request"`

                return 'Unauthorized'
            }
        }
    })
    .listen(8080)
```

## API
This plugin decorates `bearer` into `Context`.

### bearer
Extracted bearer token according to RFC6750, is either `string` or `undefined`,

If is undefined, means that there's no token provided.

## Config
Below is the configurable property for customizing the Bearer plugin.

### Extract
Custom extractor for retrieving tokens when the API doesn't compliant with RFC6750.

```typescript
/**
 * If the API doesn't compliant with RFC6750
 * The key for extracting the token is configurable
 */
extract: {
    /**
     * Determined which fields to be identified as Bearer token
     *
     * @default access_token
     */
    body?: string
    /**
     * Determined which fields to be identified as Bearer token
     *
     * @default access_token
     */
    query?: string
    /**
     * Determined which type of Authentication should be Bearer token
     *
     * @default Bearer
     */
    header?: string
}
```