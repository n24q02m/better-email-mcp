const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.ts', 'utf8');

content = content.replace("for (const mb of mailboxes)", "for await (const mb of mailboxes)");
content = content.replace("for (const mb of mailboxes)", "for await (const mb of mailboxes)");

fs.writeFileSync('src/tools/helpers/imap-client.ts', content);
