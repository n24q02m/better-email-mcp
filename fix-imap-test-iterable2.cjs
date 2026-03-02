const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.test.ts', 'utf8');

content = content.replace(
  "toAsyncIterable([",
  "_toAsyncIterable(["
);
content = content.replace(
  "toAsyncIterable([",
  "_toAsyncIterable(["
);

fs.writeFileSync('src/tools/helpers/imap-client.test.ts', content);
