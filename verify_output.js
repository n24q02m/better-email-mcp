import { renderEmailCredentialForm } from './build/src/credential-form.js';
import fs from 'fs';

const schema = {
  server: 'better-email-mcp',
  displayName: 'Email MCP',
  fields: []
};

const html = renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=abc' });
fs.writeFileSync('rendered_output.html', html);
console.log('HTML written to rendered_output.html');
