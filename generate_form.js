import { renderEmailCredentialForm } from './src/credential-form.ts'
const schema = { server: 'better-email-mcp', displayName: 'Email MCP', fields: [] }
console.log(renderEmailCredentialForm(schema, { submitUrl: '/authorize?nonce=abc' }))
