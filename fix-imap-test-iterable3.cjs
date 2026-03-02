const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.test.ts', 'utf8');

content = content.replace(
  "__toAsyncIterable([",
  "toAsyncIterable(["
);
content = content.replace(
  "__toAsyncIterable([",
  "toAsyncIterable(["
);

fs.writeFileSync('src/tools/helpers/imap-client.test.ts', content);
