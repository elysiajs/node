if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

const { node } = require('@elysiajs/node');

if (typeof node !== 'function') {
  throw new Error('❌ CommonJS Node.js failed');
}

console.log('✅ CommonJS Node.js works!');
