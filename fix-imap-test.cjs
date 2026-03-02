const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.test.ts', 'utf8');

const oldStr1 = `mockClient.list.mockResolvedValue([
      { name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' },
      { name: 'SomeArchive', path: 'SomeArchive', flags: ['\\\\Archive'], delimiter: '/' }
    ])`;

const newStr1 = `mockClient.list.mockResolvedValue(
      toAsyncIterable([
        { name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' },
        { name: 'SomeArchive', path: 'SomeArchive', flags: ['\\\\Archive'], delimiter: '/' }
      ])
    )`;

const oldStr2 = `mockClient.list.mockResolvedValue([
      { name: 'INBOX', path: 'INBOX', flags: ['\\\\HasNoChildren'], delimiter: '/' },
      { name: 'Sent', path: 'Sent', flags: ['\\\\Sent'], delimiter: '/' }
    ])`;

const newStr2 = `mockClient.list.mockResolvedValue(
      toAsyncIterable([
        { name: 'INBOX', path: 'INBOX', flags: ['\\\\HasNoChildren'], delimiter: '/' },
        { name: 'Sent', path: 'Sent', flags: ['\\\\Sent'], delimiter: '/' }
      ])
    )`;


content = content.replace(oldStr1, newStr1);
content = content.replace(oldStr2, newStr2);

fs.writeFileSync('src/tools/helpers/imap-client.test.ts', content);
