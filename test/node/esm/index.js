if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

import { node } from '@elysiajs/node';

if (typeof node !== 'function') {
  throw new Error('❌ ESM Node.js failed');
}

console.log('✅ ESM Node.js works!');
