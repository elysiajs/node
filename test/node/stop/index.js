if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';

const app = new Elysia({ adapter: node() }).get('/', () => 'hi').listen(0);

if (!app.server) {
  throw new Error('❌ app.server is not set after listen');
}

const server = app.server.raw;
await server.ready();

if ((await fetch(server.url).then((response) => response.text())) !== 'hi') {
  throw new Error('❌ The server does not answer');
}

await app.stop();

if (app.server) {
  throw new Error('❌ app.server is not reset after stop');
}

if (await fetch(server.url).then(() => true, () => false)) {
  throw new Error('❌ The server still answers after stop');
}

console.log('✅ app.stop() stops the server');
