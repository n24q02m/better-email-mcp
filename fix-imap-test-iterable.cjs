const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.test.ts', 'utf8');

// I need to add toAsyncIterable inside the test file if it's missing, or find where it is defined.
// Wait, looking closely at src/tools/helpers/imap-client.test.ts
// I see it was already defined on line 61:
// function toAsyncIterable<T>(items: T[]): AsyncIterable<T> { ... }
// Let's check if my patch missed it.
