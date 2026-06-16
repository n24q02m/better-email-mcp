import { describe, expect, test } from 'vitest'

// Live self-test for the deployed Cloudflare worker (success criterion 3):
// login -> save a Gmail app-password credential (retry-on-500 for the E.1
// outbound-interception race) -> authenticated MCP tool call. Gated on CF_LIVE
// so it never runs in CI / the default T0 unit suite — only against the deployed
// endpoint. Credentials come from skret /better-email-mcp/prod (CF_GMAIL_CRED)
// + the OAuth password grant Bearer (CF_BEARER); never inline secrets.
//
// Run:
//   skret run -e prod --path=/better-email-mcp/prod -- env CF_LIVE=1 CF_BEARER=... bun vitest run tests/cf_full_flow.test.ts

const BASE = process.env.CF_EMAIL_BASE ?? 'https://email.n24q02m.com'

/** POST with retry-on-500: the first KV write on a cold instance can race the
 * outbound-interception wiring (E.1). Retries a few times with backoff. */
async function postWithRetry(url: string, init: RequestInit, tries = 5): Promise<Response> {
  let last: Response | undefined
  for (let i = 0; i < tries; i++) {
    last = await fetch(url, init)
    if (last.status !== 500) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last as Response
}

describe.skipIf(!process.env.CF_LIVE)('CF full OAuth password flow', () => {
  test('login -> save Gmail credential (retry-on-500) -> authenticated tool call', async () => {
    // 1. Confirm the OAuth protected-resource metadata is served.
    const metaResp = await fetch(`${BASE}/.well-known/oauth-protected-resource`)
    expect(metaResp.status).toBe(200)

    // 2. Bearer minted by the harness preamble (mcp-core OAuth password grant
    //    against the relay password + Gmail app-password from skret).
    const token = process.env.CF_BEARER
    expect(token, 'set CF_BEARER from the OAuth password grant preamble').toBeTruthy()

    // 3. Save the Gmail credential via the authorize callback (retry-on-500).
    const saveResp = await postWithRetry(`${BASE}/authorize/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ EMAIL_CREDENTIALS: process.env.CF_GMAIL_CRED })
    })
    expect(saveResp.status).toBeLessThan(400)

    // 4. Authenticated MCP tool call: list folders for the saved account.
    const toolResp = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'folders', arguments: { action: 'list' } }
      })
    })
    expect(toolResp.status).toBe(200)
    const body = await toolResp.text()
    expect(body).not.toContain('NO_ACCOUNTS')
  })
})
