// src/worker.ts
// Worker fronting the better-email-mcp container Durable Object (KV-only).
//
// Two distinct request paths:
//  - INBOUND: requests on the custom domain hit the default export `fetch`,
//    which routes them to the per-user EmailContainer Durable Object (one
//    instance per JWT sub via idFromName).
//  - OUTBOUND: the container calls http://kv.internal/... which is intercepted
//    by the `@cloudflare/containers` proxy and dispatched to the
//    `EmailContainer.outboundByHost` handler below, serviced from the Worker's
//    KV binding. enableInternet=true lets every OTHER host (Microsoft OAuth,
//    IMAP/SMTP) reach the public internet.
//
// better-email is KV-only: it copies the wet template but DROPS d1Outbound +
// vectorizeOutbound (no D1, no Vectorize). All five footguns are preserved.
import { Container, ContainerProxy, type OutboundHandler } from '@cloudflare/containers'

// FOOTGUN 2: ContainerProxy MUST be re-exported from the Worker entrypoint —
// the containers runtime discovers it via `ctx.exports.ContainerProxy` to route
// the container's intercepted outbound traffic (kv.internal) back into the
// Worker. Without this re-export, applyOutboundInterception() throws at start.
export { ContainerProxy }

export interface Env {
  KV: {
    get(k: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
    get(k: string): Promise<string | null>
    put(k: string, v: string | ArrayBuffer): Promise<void>
    delete(k: string): Promise<void>
  }
  EMAIL?: { idFromName(n: string): unknown; get(id: unknown): { fetch(r: Request): Promise<Response> } }
  // Container config (wrangler.jsonc `vars`) + secrets (`wrangler secret put`),
  // forwarded into the container process via EmailContainer.envVars.
  PUBLIC_URL: string
  MCP_STORAGE_BACKEND: string
  MCP_KV_BASE_URL: string
  MCP_TRANSPORT: string
  PORT: string
  // TS-on-CF footgun: mcp-core core-ts binds 127.0.0.1 by default; the
  // @cloudflare/containers proxy reaches the container on 0.0.0.0:8080, so HOST
  // MUST be "0.0.0.0" or the container is unreachable (worker -> 500).
  HOST: string
  CREDENTIAL_SECRET: string
  MCP_RELAY_PASSWORD: string
  MCP_DCR_SERVER_SECRET: string
  OUTLOOK_CLIENT_ID?: string
  OUTLOOK_EMAIL?: string
}

// Keys forwarded from the Worker env (wrangler vars + secrets) into the
// container process. Unset/empty values are dropped so an unused optional secret
// (OUTLOOK_CLIENT_ID / OUTLOOK_EMAIL) never injects a blank.
const CONTAINER_ENV_KEYS = [
  'PUBLIC_URL',
  'MCP_STORAGE_BACKEND',
  'MCP_KV_BASE_URL',
  'MCP_TRANSPORT',
  'PORT',
  'HOST',
  'CREDENTIAL_SECRET',
  'MCP_RELAY_PASSWORD',
  'MCP_DCR_SERVER_SECRET',
  'OUTLOOK_CLIENT_ID',
  'OUTLOOK_EMAIL'
] as const

function pickContainerEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of CONTAINER_ENV_KEYS) {
    const v = (env as unknown as Record<string, unknown>)[k]
    if (typeof v === 'string' && v !== '') out[k] = v
  }
  return out
}

// --- Outbound handler (container -> Worker KV binding) ----------------------
// Runs when the container makes an outbound HTTP request to kv.internal. It is
// registered via `EmailContainer.outboundByHost` (ASSIGNMENT, not a class field)
// so the assignment hits the inherited setter and populates the package's
// module-level handler registry. A `static outboundByHost = {...}` field would
// use define-semantics, bypass the setter, and silently fall through to the
// public internet (kv.internal -> NXDOMAIN).

const kvOutbound: OutboundHandler<Env> = async (request, env) => {
  const url = new URL(request.url)
  const key = decodeURIComponent(url.pathname.replace(/^\//, ''))
  // Readiness probe (E.1): once this handler answers, outbound interception is
  // wired, so the container's first credential PUT is safe. Reserved key,
  // checked before the normal lookup so it never shadows a real KV key. The
  // server's PerSubCredStore.ready() hits this at startup.
  if (request.method === 'GET' && key === '__ready') {
    return Response.json({ ready: true })
  }
  if (request.method === 'GET') {
    // FOOTGUN 3: credential blobs are binary (nonce + AES-GCM ciphertext);
    // read/write as ArrayBuffer so bytes round-trip without UTF-8 corruption.
    const v = await env.KV.get(key, 'arrayBuffer')
    return v === null ? new Response('', { status: 404 }) : new Response(v, { status: 200 })
  }
  if (request.method === 'PUT') {
    await env.KV.put(key, await request.arrayBuffer())
    return new Response('', { status: 200 })
  }
  if (request.method === 'DELETE') {
    await env.KV.delete(key)
    return new Response('', { status: 200 })
  }
  return new Response('method not allowed', { status: 405 })
}

// Outbound handler registry, keyed by internal hostname. KV-only: no d1/vectorize
// (dropped from the wet template). Production container outbound (kv.internal)
// reaches this via @cloudflare/containers' ContainerProxy + the
// EmailContainer.outboundByHost assignment below — NOT via the public `fetch`
// export. Exported so unit tests can invoke the handler directly instead of
// routing an internal-host request through the public entrypoint.
export const OUTBOUND_BY_HOST: Record<string, OutboundHandler<Env>> = {
  'kv.internal': kvOutbound
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Public entrypoint: ONLY routes inbound requests to the per-user container
    // DO. The kv.internal outbound handler is deliberately NOT dispatched here —
    // exposing it on the public fetch surface would let an external caller
    // (request hostname spoofed to kv.internal) read/write/delete the credential
    // KV namespace unauthenticated. Production container outbound reaches it via
    // @cloudflare/containers' ContainerProxy + the EmailContainer.outboundByHost
    // registry below; unit tests call the handler directly via OUTBOUND_BY_HOST.
    if (env.EMAIL) {
      const userId = extractUserId(request)
      const stub = env.EMAIL.get(env.EMAIL.idFromName(userId))
      return stub.fetch(request)
    }
    return new Response('not found', { status: 404 })
  }
}

function extractUserId(request: Request): string {
  // JWT sub from the Bearer token (verified by mcp-core OAuth middleware in the
  // container). SINGLE-USER CONTRACT (E.2): no token or no `sub` -> the reserved
  // id "default", so setup and serving collapse onto ONE Durable Object id and
  // the credential write+read avoid a cross-colo KV hop. Per-`sub` tokens get
  // their own isolated DO (multi-user).
  const auth = request.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/)
  if (!m) return 'default'
  try {
    const payload = JSON.parse(atob(m[1].split('.')[1] ?? ''))
    return typeof payload.sub === 'string' ? payload.sub : 'default'
  } catch {
    return 'default'
  }
}

// Per-user container Durable Object. wrangler.jsonc binds EMAIL to this class and
// runs the better-email-mcp:beta image; one instance per JWT sub. The container's
// HTTP server listens on 8080 (PORT=8080 forwarded via envVars; the http Docker
// target also sets MCP_PORT=8080 + EXPOSE 8080).
export class EmailContainer extends Container<Env> {
  defaultPort = 8080
  // FOOTGUN / RISK R1: sleepAfter MUST be >= the Outlook device-code window
  // (~15m). The device-code background poll writes the refresh token to KV up to
  // ~15 minutes after the form submit; if the DO sleeps first, the write-target
  // instance is gone and Outlook auth silently never completes. 20m = window +
  // slack (Microsoft device codes default expires_in ~= 900s).
  sleepAfter = '20m'
  // IMAP/SMTP + Microsoft OAuth reach the public internet; kv.internal stays
  // intercepted (see outboundByHost).
  enableInternet = true
  // Forward Worker config (vars) + secrets into the container process. Without
  // this the server defaults to MCP_STORAGE_BACKEND=local on the ephemeral
  // container FS and credentials would not survive recreate. `this.env` is the
  // DurableObject env set by super(); cast because @cloudflare/containers does
  // not re-expose it publicly under this repo's tsconfig (types: ["node"]).
  envVars = pickContainerEnv((this as unknown as { env: Env }).env)
}

// Register outbound interception. MUST be an assignment (invokes the inherited
// `static set outboundByHost`) — a class field would bypass the setter. Reuses
// OUTBOUND_BY_HOST so the proxy registry and the direct test dispatch are one
// source of truth (footgun #1: assignment, never a static field). KV-only.
EmailContainer.outboundByHost = OUTBOUND_BY_HOST as Record<string, OutboundHandler>
