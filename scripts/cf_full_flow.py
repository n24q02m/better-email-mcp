"""CF better-email-mcp live OAuth full-flow self-test harness.

Drives the deployed better-email-mcp Cloudflare Worker (Worker + Container + KV)
end-to-end against a public endpoint. better-email is a LOCAL-FORM server (like
wet/imagine, NOT delegated like notion): the /authorize gate is just the relay
password, so the whole flow is fully autonomous -- no third-party consent.

Flow (authorization_code + PKCE, DCR public client; ported from imagine's harness):
  1. DCR register   -- POST /register (RFC 7591) -> client_id
  2. password-grant -- GET /authorize -> POST /login (relay password gate) -> form
  3. save creds     -- POST /authorize?nonce=... {EMAIL_CREDENTIALS} (retry-on-500
                       for the E.1 outbound-interception race); the server VALIDATES
                       the IMAP login server-side, so a real Gmail app-password is
                       required. -> {ok, redirect_url}
  4. token          -- POST /token (code + verifier) -> bearer JWT
  5. tool call      -- config(status) + folders(list); assert the saved account is
                       resolved (no awaiting_setup / NO_ACCOUNTS / error).

Recreate gate (SUCCESS CRITERION 4 -- the whole point of the migration):
  --save-only  : run 1-4, dump the EXACT JWT (relay-login mints a random sub per
                 /authorize, so the verify half MUST replay this token).
  --auth-only  : replay the dumped JWT WITHOUT re-saving; folders(list) must still
                 resolve the account -> creds survived container delete+recreate in
                 KV (PerSubCredStore, embed in subs/<sub>/config), and the JWT still
                 verifies (EdDSA derived from CREDENTIAL_SECRET, stable across recreate).

Secrets from env (skret): GMAIL_EMAIL + GMAIL_APP_PASSWORD from /better-email-mcp/prod;
relay gate password MCP_RELAY_PASSWORD (or RELAY_PW) from /oci-vm-prod/prod
(infra-shared) -- compose both namespaces.

Examples:
  skret run -e prod --path=/oci-vm-prod/prod -- \
    skret run -e prod --path=/better-email-mcp/prod -- \
      python scripts/cf_full_flow.py
  ... -- python scripts/cf_full_flow.py --save-only
  ... -- python scripts/cf_full_flow.py --auth-only
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json as _json
import os
import re
import secrets
import sys
import time
import urllib.parse
from pathlib import Path

DEFAULT_ENDPOINT = "https://email.n24q02m.com"


def _password() -> str:
    pw = os.environ.get("RELAY_PW") or os.environ.get("MCP_RELAY_PASSWORD")
    if not pw:
        raise SystemExit(
            "MCP_RELAY_PASSWORD (or RELAY_PW) is required for the password-grant login "
            "gate. It lives in skret /oci-vm-prod/prod (infra-shared), NOT "
            "/better-email-mcp/prod -- compose both namespaces."
        )
    return pw


def _email_credentials() -> str:
    """EMAIL_CREDENTIALS = '<gmail>:<app-password>' from the skret e2e identity."""
    email = os.environ.get("GMAIL_EMAIL")
    app_pw = os.environ.get("GMAIL_APP_PASSWORD")
    if not email or not app_pw:
        raise SystemExit(
            "GMAIL_EMAIL + GMAIL_APP_PASSWORD required (skret /better-email-mcp/prod) "
            "to save a credential -- the server validates the IMAP login on save."
        )
    return f"{email}:{app_pw}"


class _SaveRetry(Exception):
    pass


def get_token(endpoint: str, creds: dict[str, str], *, save_retries: int = 8) -> str:
    """Full OAuth flow, retrying on a transient 500 at the credential save step
    (CF Containers outbound-interception race on cold instances; E.1). Each retry
    restarts from DCR so the nonce is fresh. ``creds`` empty => re-mint a token for
    a fresh sub WITHOUT saving (not used by the recreate gate, which replays a dumped
    token instead, since relay-login mints a new sub per /authorize)."""
    import httpx  # lazy: keep --help importable without httpx

    last: Exception | None = None
    for attempt in range(save_retries):
        try:
            return _get_token_once(httpx, endpoint, creds)
        except _SaveRetry as e:
            last = e
            print(f"get_token: save 500 (interception race), retry {attempt + 1}/{save_retries}")
            time.sleep(3)
    raise RuntimeError(f"get_token failed after {save_retries} retries: {last}")


def _get_token_once(httpx, endpoint: str, creds: dict[str, str]) -> str:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    ru = "http://localhost:9999/cb"
    pw = _password()
    with httpx.Client(timeout=120, follow_redirects=False) as c:
        cid = c.post(
            f"{endpoint}/register",
            json={
                "client_name": "cf-verify",
                "redirect_uris": [ru],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "scope": "offline_access",
            },
        ).json()["client_id"]
        az = c.get(
            f"{endpoint}/authorize",
            params={
                "response_type": "code",
                "client_id": cid,
                "redirect_uri": ru,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
                "state": "st",
                "scope": "offline_access",
            },
        )
        nxt = urllib.parse.parse_qs(urllib.parse.urlparse(az.headers["location"]).query)["next"][0]
        lg = c.post(f"{endpoint}/login", data={"next": nxt, "password": pw})
        url = lg.headers["location"]
        url = url if url.startswith("http") else endpoint + url
        form_html = c.get(url).text
        m = re.search(r"/authorize\?nonce=([A-Za-z0-9_\-]+)", form_html)
        assert m, "nonce not found in form"
        nonce = m.group(1)
        sub = c.post(f"{endpoint}/authorize", params={"nonce": nonce}, json=creds, timeout=120)
        if sub.status_code == 500 and "save credentials" in sub.text:
            raise _SaveRetry(sub.text[:120])
        assert sub.status_code == 200, (sub.status_code, sub.text[:400])
        data = sub.json()
        assert data.get("ok"), data
        code = urllib.parse.parse_qs(urllib.parse.urlparse(data["redirect_url"]).query)["code"][0]
        tok = c.post(
            f"{endpoint}/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": ru,
                "client_id": cid,
                "code_verifier": verifier,
            },
        )
        assert tok.status_code == 200, (tok.status_code, tok.text[:300])
        return tok.json()["access_token"]


def _sub_of(token: str) -> str:
    payload = _json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    return payload.get("sub", "?")


# Substrings (case-insensitive) meaning "credentials not resolved yet" — the
# account is still propagating through KV, or was never saved. Each email tool
# phrases this differently: config(status) -> "awaiting_setup"; folders(list) ->
# "Email credentials are not configured yet.  To set up, open this URL...". _call
# retries on ANY of these (E.2 cross-colo propagation window); the assertion
# FAILS HARD on any of them (a not-ready payload is never a PASS).
_NOT_READY_MARKERS = (
    "awaiting_setup",
    "not configured",  # "Email credentials are not configured yet"
    "no_accounts",
    "no accounts",
    "credentials are required",
    "to set up",  # setup-instruction hint text in the not-configured reply
)


def _not_ready(txt: str | None) -> bool:
    if not txt:
        return True
    low = txt.lower()
    return any(m in low for m in _NOT_READY_MARKERS)


async def _call(s, label, tool, args, *, retries=20, delay=8):
    """Call a tool, retrying while creds are still propagating (KV cross-colo
    eventual consistency after the setup write; E.2)."""
    for i in range(retries):
        try:
            res = await s.call_tool(tool, args)
            txt = "".join(getattr(b, "text", "") for b in res.content)
            if _not_ready(txt):
                print(f"{label}: not ready (KV propagating) try {i + 1}/{retries}")
                await asyncio.sleep(delay)
                continue
            print(f"{label} OK:", txt[:320].replace("\n", " "))
            return txt
        except Exception as e:
            print(f"{label} ERR:", repr(e)[:300])
            return None
    print(f"{label}: gave up after {retries} tries (still not ready)")
    return None


def _assert_account_resolved(txt: str | None) -> None:
    assert txt is not None, "folders(list) returned no payload (gave up while still not ready)"
    assert not _not_ready(txt), f"account NOT resolved (creds never propagated): {txt[:300]}"
    # Positive proof the IMAP account actually resolved: Gmail always exposes an
    # INBOX folder, so a real folders(list) response contains it. Its absence
    # means the call returned something other than a folder listing.
    assert "inbox" in txt.lower(), f"folders(list) did not return an INBOX folder: {txt[:300]}"
    print("ASSERT OK: account resolved, INBOX folder listed.")


async def _session(endpoint: str, token: str):
    from mcp import ClientSession  # lazy
    from mcp.client.streamable_http import streamablehttp_client

    return streamablehttp_client(f"{endpoint}/mcp", headers={"Authorization": f"Bearer {token}"}), ClientSession


def _token_file() -> Path:
    return Path(__file__).with_name(".email_cf_token")


async def run_full(endpoint: str) -> None:
    token = get_token(endpoint, {"EMAIL_CREDENTIALS": _email_credentials()})
    print("TOKEN OK len=", len(token), "sub=", _sub_of(token))
    transport, ClientSession = await _session(endpoint, token)
    async with transport as (r, w, _), ClientSession(r, w) as s:
        await s.initialize()
        tools = await s.list_tools()
        print("TOOLS:", [t.name for t in tools.tools])
        await _call(s, "CONFIG_STATUS", "config", {"action": "status"})
        txt = await _call(s, "FOLDERS_LIST", "folders", {"action": "list"})
        _assert_account_resolved(txt)
    print("FULL FLOW PASS.")


async def run_save_only(endpoint: str) -> None:
    token = get_token(endpoint, {"EMAIL_CREDENTIALS": _email_credentials()})
    _token_file().write_text(token)
    print("SAVE-ONLY OK: creds saved for sub=", _sub_of(token), "len(token)=", len(token), "(token dumped)")


async def run_auth_only(endpoint: str) -> None:
    tok_path = _token_file()
    if not tok_path.exists():
        raise SystemExit("No dumped token -- run --save-only first.")
    token = tok_path.read_text().strip()
    print("AUTH-ONLY: replaying saved token for sub=", _sub_of(token), "(no re-save)")
    transport, ClientSession = await _session(endpoint, token)
    async with transport as (r, w, _), ClientSession(r, w) as s:
        await s.initialize()
        await _call(s, "CONFIG_STATUS", "config", {"action": "status"})
        txt = await _call(s, "FOLDERS_LIST", "folders", {"action": "list"})
        _assert_account_resolved(txt)
    print("AUTH-ONLY PASS: state survived recreate (KV creds resolved, no re-save).")


async def run_tools(endpoint: str) -> None:
    """Exercise the read-only tool surface end-to-end on the live deployment
    (beyond folders/config): save creds, then drive messages(search), help, and
    config(status) through the real per-sub IMAP path. send/attachments(download)
    are skipped here -- send is an OUTWARD action and attachments(download) needs a
    real uid; the IMAP read path they share is already exercised by search."""
    token = get_token(endpoint, {"EMAIL_CREDENTIALS": _email_credentials()})
    print("TOKEN OK len=", len(token), "sub=", _sub_of(token))
    transport, ClientSession = await _session(endpoint, token)
    async with transport as (r, w, _), ClientSession(r, w) as s:
        await s.initialize()
        print("TOOLS:", [t.name for t in (await s.list_tools()).tools])
        status = await _call(s, "CONFIG_STATUS", "config", {"action": "status"})
        _assert_account_resolved(await _call(s, "FOLDERS_LIST", "folders", {"action": "list"}))
        # messages(search): exercises an IMAP SELECT + SEARCH + header FETCH over
        # the KV-resolved account -- the real read path the agent uses most.
        search = await _call(s, "MESSAGES_SEARCH", "messages", {"action": "search", "query": "ALL", "limit": 2})
        assert search is not None and "error" not in search.lower(), f"messages(search) failed: {search}"
        # help: docs-resource path, no credentials required.
        helptxt = await _call(s, "HELP", "help", {"tool_name": "messages"})
        assert helptxt is not None and "messages" in helptxt.lower(), f"help failed: {helptxt}"
        assert status is not None and "configured" in status.lower(), f"config(status) not configured: {status}"
    print("TOOLS PASS: config + folders + messages(search) + help all resolved over the per-sub KV path.")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="CF better-email-mcp live OAuth full-flow self-test harness.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help=f"Deployed endpoint (default: {DEFAULT_ENDPOINT})")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--save-only", action="store_true", help="save creds for one sub + dump token (recreate-gate setup).")
    mode.add_argument("--auth-only", action="store_true", help="replay dumped token, no re-save (recreate-gate verify).")
    mode.add_argument("--tools", action="store_true", help="exercise read-only tool surface (messages/help) on the live deploy.")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.save_only:
        asyncio.run(run_save_only(args.endpoint))
    elif args.auth_only:
        asyncio.run(run_auth_only(args.endpoint))
    elif args.tools:
        asyncio.run(run_tools(args.endpoint))
    else:
        asyncio.run(run_full(args.endpoint))
    return 0


if __name__ == "__main__":
    sys.exit(main())
