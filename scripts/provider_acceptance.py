from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import tempfile
import time
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from pathlib import Path
from typing import Any, Protocol, TextIO

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

REPO_ROOT = Path(__file__).resolve().parents[1]
SCENARIOS = ("gmail", "yahoo-large", "outlook-expired")
PROVIDERS = ("gmail", "yahoo", "outlook")
RESULT_LIMIT = 3
YAHOO_MAILBOX_THRESHOLD = 10_000
YAHOO_FIXTURE_MESSAGE_COUNT = 10_025
IMAP_FALLBACK_WINDOW_SIZE = 500
YAHOO_FIXTURE_ACCOUNT = "large-mailbox@yahoo.test"
OUTLOOK_FIXTURE_ACCOUNT = "expired-fixture@outlook.com"
FIXTURE_PASSWORD = "provider-acceptance-fixture-password"
SELECTOR_ENV = {
    "gmail": "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT",
    "yahoo": "PROVIDER_ACCEPTANCE_YAHOO_ACCOUNT",
    "outlook": "PROVIDER_ACCEPTANCE_OUTLOOK_ACCOUNT",
}
READ_ONLY_ACTIONS = {
    "config": frozenset({"status"}),
    "folders": frozenset({"list", "status"}),
    "messages": frozenset({"search"}),
}
OUTPUT_FIELDS = (
    "scenario",
    "provider",
    "verdict",
    "operation",
    "code",
    "result_count",
    "mailbox_evidence",
    "skipped_count",
    "healthy_result_count",
)
STRING_OUTPUT_VALUES = {
    "scenario": frozenset(SCENARIOS),
    "provider": frozenset(PROVIDERS),
    "verdict": frozenset({"VERIFIED", "FAILED"}),
    "operation": frozenset({"preflight", "messages.search"}),
}
CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
INTERACTIVE_AUTH_MARKERS = (
    "device code",
    "device_code",
    "devicelogin",
    "verification_uri",
    "user_code",
    "authorization url",
    "open http",
    "login.microsoftonline.com",
    "oauth2 sign-in required",
    "enter code",
)


class UnsafeOperation(ValueError):
    pass


class ProviderCallError(RuntimeError):
    pass


class SessionFactory(Protocol):
    def __call__(
        self,
        scenario: str,
        environment: dict[str, str],
        token_path: Path | None,
    ) -> Any: ...


@dataclass(frozen=True)
class AccountInput:
    account: str
    provider: str


@dataclass
class LocalImapFixture:
    host: str
    port: int
    message_count: int
    connections: int = 0
    status_requests: int = 0
    search_windows: list[tuple[int, int]] = dataclass_field(default_factory=list)
    unbounded_search_attempted: bool = False
    _writers: set[asyncio.StreamWriter] = dataclass_field(
        default_factory=set, repr=False
    )

    def bounded_search_verified(self) -> bool:
        return bool(self.search_windows) and all(
            1 <= high - low + 1 <= IMAP_FALLBACK_WINDOW_SIZE
            for low, high in self.search_windows
        )


@dataclass(frozen=True)
class OutlookReplayFixture:
    root: Path
    original_token_path: Path
    replay_token_path: Path
    environment: dict[str, str]


@dataclass
class StderrCapture:
    stream: TextIO

    def getvalue(self) -> str:
        self.stream.flush()
        self.stream.seek(0)
        text = self.stream.read()
        self.stream.seek(0, os.SEEK_END)
        return text


def _provider_for_account(account: str, environment: Mapping[str, str]) -> str | None:
    _, separator, domain = account.casefold().rpartition("@")
    if not separator:
        return None

    if domain in {"gmail.com", "googlemail.com"}:
        return "gmail"
    if domain.startswith("yahoo.") or domain in {"ymail.com", "rocketmail.com"}:
        return "yahoo"

    outlook_domains = {"outlook.com", "hotmail.com", "live.com", "msn.com"}
    outlook_domains.update(
        value.strip().casefold()
        for value in environment.get("OUTLOOK_EXTRA_DOMAINS", "").split(",")
        if value.strip()
    )
    if domain in outlook_domains:
        return "outlook"
    return None


def discover_accounts(environment: Mapping[str, str]) -> list[AccountInput]:
    discovered: list[AccountInput] = []
    seen: set[str] = set()

    credentials = environment.get("EMAIL_CREDENTIALS", "")
    for credential in credentials.split(","):
        account = credential.strip().partition(":")[0].strip()
        provider = _provider_for_account(account, environment)
        key = account.casefold()
        if account and provider and key not in seen:
            discovered.append(AccountInput(account=account, provider=provider))
            seen.add(key)

    single_account = environment.get("EMAIL_USER", "").strip()
    if single_account and single_account.casefold() not in seen:
        explicit_provider = environment.get("EMAIL_PROVIDER", "").strip().casefold()
        provider = explicit_provider if explicit_provider in PROVIDERS else None
        provider = provider or _provider_for_account(single_account, environment)
        if provider:
            discovered.append(AccountInput(account=single_account, provider=provider))

    return discovered


def select_provider_accounts(
    provider: str, environment: Mapping[str, str]
) -> list[AccountInput]:
    candidates = sorted(
        (
            account
            for account in discover_accounts(environment)
            if account.provider == provider
        ),
        key=lambda account: account.account.casefold(),
    )
    selector_name = SELECTOR_ENV[provider]
    selector = environment.get(selector_name, "").strip()
    if provider == "outlook" and not selector:
        selector = environment.get(
            "PROVIDER_ACCEPTANCE_OUTLOOK_EXPIRED_ACCOUNT", ""
        ).strip()
    if not selector:
        return candidates
    return [
        account
        for account in candidates
        if account.account.casefold() == selector.casefold()
    ]


def _raw_credential_for_account(
    account: AccountInput, environment: Mapping[str, str]
) -> str:
    if account.provider != "gmail":
        raise ProviderCallError("Selected healthy account is not Gmail")

    for entry in environment.get("EMAIL_CREDENTIALS", "").split(","):
        raw_credential = entry.strip()
        candidate = raw_credential.partition(":")[0].strip()
        if candidate.casefold() == account.account.casefold():
            return raw_credential
    raise ProviderCallError("Selected Gmail account has no raw credential input")


def validate_read_only_call(
    tool: str,
    arguments: Mapping[str, Any],
    *,
    require_account: bool = False,
) -> None:
    action = arguments.get("action")
    if tool not in READ_ONLY_ACTIONS or action not in READ_ONLY_ACTIONS[tool]:
        raise UnsafeOperation(f"Rejected non-read-only MCP call: {tool}.{action}")

    allowed_keys = {
        "config": {"action"},
        "folders": {"action", "account", "folder"},
        "messages": {"action", "query", "folder", "limit", "account"},
    }[tool]
    if set(arguments) - allowed_keys:
        raise UnsafeOperation("Rejected unexpected MCP arguments")

    account = arguments.get("account")
    if require_account and (not isinstance(account, str) or not account.strip()):
        raise UnsafeOperation("An explicit account is required for this call")
    if account is not None and (not isinstance(account, str) or not account.strip()):
        raise UnsafeOperation("Invalid account selector")

    if tool == "folders":
        folder = arguments.get("folder")
        if action == "status" and (
            not isinstance(account, str) or not account.strip()
        ):
            raise UnsafeOperation("Folder status requires one explicit account")
        if action == "status" and (
            not isinstance(folder, str) or not folder.strip()
        ):
            raise UnsafeOperation("Folder status requires one explicit folder")
        if action == "list" and folder is not None:
            raise UnsafeOperation("Folder list does not accept a folder selector")

    if tool == "messages":
        limit = arguments.get("limit")
        if (
            not isinstance(limit, int)
            or isinstance(limit, bool)
            or not 1 <= limit <= RESULT_LIMIT
        ):
            raise UnsafeOperation(
                "Message searches must use the bounded acceptance limit"
            )
        if not isinstance(arguments.get("query"), str):
            raise UnsafeOperation("Message searches require an explicit query")


def sanitize_record(record: Mapping[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for field in OUTPUT_FIELDS:
        if field not in record:
            continue
        value = record[field]
        if field in STRING_OUTPUT_VALUES:
            if value in STRING_OUTPUT_VALUES[field]:
                sanitized[field] = value
            continue
        if field == "code":
            if isinstance(value, str) and CODE_PATTERN.fullmatch(value):
                sanitized[field] = value
            continue
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            sanitized[field] = value
    return sanitized


def serialize_record(record: Mapping[str, Any]) -> str:
    return json.dumps(
        sanitize_record(record), ensure_ascii=False, separators=(",", ":")
    )


def _record(
    scenario: str,
    verdict: str,
    code: str,
    *,
    operation: str = "preflight",
    **metrics: int,
) -> dict[str, Any]:
    provider = {
        "gmail": "gmail",
        "yahoo-large": "yahoo",
        "outlook-expired": "outlook",
    }[scenario]
    return {
        "scenario": scenario,
        "provider": provider,
        "verdict": verdict,
        "operation": operation,
        "code": code,
        **metrics,
    }


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _fixture_environment(
    environment: Mapping[str, str], credentials: str
) -> dict[str, str]:
    """Build a child environment without forwarding unrelated credentials."""
    process_keys = (
        "PATH",
        "PATHEXT",
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "TEMP",
        "TMP",
        "TMPDIR",
        "BUN_INSTALL",
        "CI",
        "LANG",
        "LC_ALL",
    )
    child: dict[str, str] = {}
    for key in process_keys:
        value = environment.get(key) or os.environ.get(key)
        if value:
            child[key] = value
    child.update(
        {
            "EMAIL_CREDENTIALS": credentials,
            "NODE_ENV": "test",
            "NO_COLOR": "1",
        }
    )
    return child


async def _send_imap(writer: asyncio.StreamWriter, *lines: str) -> None:
    writer.write("".join(lines).encode("utf-8"))
    await writer.drain()


def _search_window(command: str) -> tuple[int, int] | None:
    matches = re.findall(r"\bUID\s+(\d+):(\d+)\b", command, flags=re.IGNORECASE)
    if not matches:
        return None
    first, second = (int(value) for value in matches[-1])
    return min(first, second), max(first, second)


def _expand_uid_set(sequence_set: str) -> list[int]:
    result: list[int] = []
    for part in sequence_set.split(","):
        if ":" in part:
            first_text, second_text = part.split(":", 1)
            if not first_text.isdigit() or not second_text.isdigit():
                continue
            first, second = int(first_text), int(second_text)
            step = 1 if first <= second else -1
            result.extend(range(first, second + step, step))
        elif part.isdigit():
            result.append(int(part))
    return result


def _fixture_message(uid: int, recipient: str) -> bytes:
    return (
        "From: Fixture Sender <fixture@example.test>\r\n"
        f"To: {recipient}\r\n"
        f"Subject: Fixture message {uid}\r\n"
        f"Message-ID: <fixture-{uid}@example.test>\r\n"
        "Date: Thu, 13 Aug 2026 00:00:00 +0000\r\n"
        "\r\n"
        f"Read-only provider acceptance fixture message {uid}.\r\n"
    ).encode()


async def _send_fetch_response(
    writer: asyncio.StreamWriter, uid: int, recipient: str
) -> None:
    source = _fixture_message(uid, recipient)
    envelope = (
        '("Thu, 13 Aug 2026 00:00:00 +0000" '
        f'"Fixture message {uid}" '
        '(("Fixture Sender" NIL "fixture" "example.test")) '
        '(("Fixture Sender" NIL "fixture" "example.test")) '
        '(("Fixture Sender" NIL "fixture" "example.test")) '
        f'((NIL NIL "{recipient.partition("@")[0]}" '
        f'"{recipient.partition("@")[2]}")) NIL NIL NIL '
        f'"<fixture-{uid}@example.test>")'
    )
    prefix = (
        f"* {uid} FETCH (UID {uid} FLAGS () ENVELOPE {envelope} "
        f"BODY[]<0> {{{len(source)}}}\r\n"
    ).encode()
    writer.write(prefix)
    writer.write(source)
    writer.write(b")\r\n")
    await writer.drain()


async def _serve_fixture_connection(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    fixture: LocalImapFixture,
    recipient: str,
) -> None:
    fixture.connections += 1
    fixture._writers.add(writer)
    await _send_imap(
        writer,
        "* OK [CAPABILITY IMAP4rev1 NAMESPACE UIDPLUS] "
        "Provider acceptance fixture ready\r\n",
    )
    try:
        while line_bytes := await reader.readline():
            if len(line_bytes) > 16_384:
                break
            line = line_bytes.decode("utf-8", errors="replace").strip()
            parts = line.split()
            if len(parts) < 2:
                continue
            tag, command = parts[0], parts[1].upper()

            if command == "CAPABILITY":
                await _send_imap(
                    writer,
                    "* CAPABILITY IMAP4rev1 NAMESPACE UIDPLUS\r\n",
                    f"{tag} OK CAPABILITY completed\r\n",
                )
            elif command == "LOGIN":
                await _send_imap(
                    writer,
                    f"{tag} OK [CAPABILITY IMAP4rev1 NAMESPACE UIDPLUS] "
                    "LOGIN completed\r\n",
                )
            elif command == "AUTHENTICATE":
                if len(parts) < 4:
                    await _send_imap(writer, "+ \r\n")
                    await reader.readline()
                await _send_imap(writer, f"{tag} OK AUTHENTICATE completed\r\n")
            elif command == "NAMESPACE":
                await _send_imap(
                    writer,
                    '* NAMESPACE (("" "/")) NIL NIL\r\n',
                    f"{tag} OK NAMESPACE completed\r\n",
                )
            elif command in {"LIST", "LSUB"}:
                await _send_imap(
                    writer,
                    '* LIST (\\HasNoChildren) "/" "INBOX"\r\n',
                    f"{tag} OK {command} completed\r\n",
                )
            elif command == "STATUS":
                fixture.status_requests += 1
                await _send_imap(
                    writer,
                    '* STATUS "INBOX" '
                    f"(MESSAGES {fixture.message_count} UNSEEN 17 "
                    f"UIDNEXT {fixture.message_count + 1})\r\n",
                    f"{tag} OK STATUS completed\r\n",
                )
            elif command in {"SELECT", "EXAMINE"}:
                access = "READ-ONLY" if command == "EXAMINE" else "READ-WRITE"
                await _send_imap(
                    writer,
                    "* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\r\n",
                    f"* {fixture.message_count} EXISTS\r\n",
                    "* 0 RECENT\r\n",
                    "* OK [UIDVALIDITY 1] UIDs valid\r\n",
                    f"* OK [UIDNEXT {fixture.message_count + 1}] Predicted next UID\r\n",
                    f"{tag} OK [{access}] {command} completed\r\n",
                )
            elif command == "UID" and len(parts) >= 3:
                subcommand = parts[2].upper()
                if subcommand == "SEARCH":
                    window = _search_window(line)
                    if window is None:
                        fixture.unbounded_search_attempted = True
                        await _send_imap(
                            writer, f"{tag} BAD Bounded UID range required\r\n"
                        )
                        continue
                    low, high = window
                    fixture.search_windows.append(window)
                    upper = min(high, fixture.message_count)
                    lower = max(low, upper - RESULT_LIMIT + 1)
                    matches = list(range(lower, upper + 1)) if upper >= low else []
                    suffix = " " + " ".join(str(uid) for uid in matches) if matches else ""
                    await _send_imap(
                        writer,
                        f"* SEARCH{suffix}\r\n",
                        f"{tag} OK UID SEARCH completed\r\n",
                    )
                elif subcommand == "FETCH" and len(parts) >= 4:
                    uids = [
                        uid
                        for uid in _expand_uid_set(parts[3])
                        if 1 <= uid <= fixture.message_count
                    ]
                    for uid in uids[:RESULT_LIMIT]:
                        await _send_fetch_response(writer, uid, recipient)
                    await _send_imap(writer, f"{tag} OK UID FETCH completed\r\n")
                else:
                    await _send_imap(writer, f"{tag} BAD Unsupported UID command\r\n")
            elif command in {"NOOP", "CLOSE", "UNSELECT"}:
                await _send_imap(writer, f"{tag} OK {command} completed\r\n")
            elif command == "LOGOUT":
                await _send_imap(
                    writer,
                    "* BYE Provider acceptance fixture closing\r\n",
                    f"{tag} OK LOGOUT completed\r\n",
                )
                break
            else:
                await _send_imap(writer, f"{tag} BAD Unsupported command\r\n")
    finally:
        fixture._writers.discard(writer)
        writer.close()
        with suppress(Exception):
            await writer.wait_closed()


@asynccontextmanager
async def local_imap_fixture(
    recipient: str, message_count: int
) -> AsyncIterator[LocalImapFixture]:
    fixture = LocalImapFixture("127.0.0.1", 0, message_count)
    server = await asyncio.start_server(
        lambda reader, writer: _serve_fixture_connection(
            reader, writer, fixture, recipient
        ),
        fixture.host,
        0,
    )
    sockets = server.sockets or []
    if len(sockets) != 1:
        server.close()
        await server.wait_closed()
        raise ProviderCallError("Local IMAP fixture did not bind exactly one socket")
    fixture.port = int(sockets[0].getsockname()[1])
    try:
        yield fixture
    finally:
        server.close()
        await server.wait_closed()
        writers = tuple(fixture._writers)
        for writer in writers:
            writer.close()
        for writer in writers:
            with suppress(Exception):
                await writer.wait_closed()


@asynccontextmanager
async def outlook_replay_fixture(
    environment: Mapping[str, str],
    gmail_account: AccountInput,
) -> AsyncIterator[OutlookReplayFixture]:
    with tempfile.TemporaryDirectory(
        prefix="better-email-outlook-acceptance-"
    ) as temporary_root:
        root = Path(temporary_root)
        original_token_path = root / "original-tokens.json"
        replay_token_path = root / "replay-tokens.json"
        now = int(time.time())
        original_store = {
            OUTLOOK_FIXTURE_ACCOUNT: {
                "accessToken": "provider-acceptance-access-token",
                "refreshToken": "provider-acceptance-valid-refresh-token",
                "expiresAt": now + 3_600,
                "clientId": "provider-acceptance-client-id",
            }
        }
        original_token_path.write_text(
            json.dumps(original_store, sort_keys=True), encoding="utf-8"
        )
        original_digest = _sha256(original_token_path)
        shutil.copy2(original_token_path, replay_token_path)

        replay_store = json.loads(replay_token_path.read_text(encoding="utf-8"))
        replay_token = replay_store[OUTLOOK_FIXTURE_ACCOUNT]
        replay_token["expiresAt"] = now - 3_600
        replay_token["refreshToken"] = (
            "provider-acceptance-intentionally-unrefreshable-token"
        )
        replay_token_path.write_text(
            json.dumps(replay_store, sort_keys=True), encoding="utf-8"
        )
        if _sha256(replay_token_path) == original_digest:
            raise ProviderCallError("Outlook replay token copy was not changed")

        gmail_credential = _raw_credential_for_account(gmail_account, environment)
        credentials = f"{gmail_credential},{OUTLOOK_FIXTURE_ACCOUNT}"
        fixture = OutlookReplayFixture(
            root=root,
            original_token_path=original_token_path,
            replay_token_path=replay_token_path,
            environment=_fixture_environment(environment, credentials),
        )
        try:
            yield fixture
        finally:
            if _sha256(original_token_path) != original_digest:
                raise ProviderCallError("Original Outlook token fixture was mutated")


@asynccontextmanager
async def source_session(
    scenario: str,
    environment: dict[str, str],
    token_path: Path | None,
) -> AsyncIterator[tuple[ClientSession, StderrCapture]]:
    source_token_digest = (
        _sha256(token_path) if token_path is not None and token_path.is_file() else None
    )
    with tempfile.TemporaryDirectory(
        prefix="better-email-provider-acceptance-"
    ) as temporary_home:
        profile = Path(temporary_home)
        token_directory = profile / ".better-email-mcp"
        token_directory.mkdir(parents=True, exist_ok=True)
        if token_path is not None and token_path.is_file():
            shutil.copy2(token_path, token_directory / "tokens.json")

        child_environment = dict(environment)
        child_environment["HOME"] = str(profile)
        child_environment["USERPROFILE"] = str(profile)
        server_args = ["run", "scripts/start-server.ts"]
        if scenario == "outlook-expired":
            preload_path = profile / "reject-outlook-refresh.mjs"
            preload_path.write_text(
                """
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, init) => {
  const value = typeof input === 'string' ? input : input.url
  const url = new URL(value)
  if (
    url.hostname === 'login.microsoftonline.com' &&
    url.pathname.endsWith('/oauth2/v2.0/token')
  ) {
    return new Response(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'provider acceptance fixture rejected refresh'
      }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }
  return nativeFetch(input, init)
}
""".strip()
                + "\n",
                encoding="utf-8",
            )
            server_args = [
                f"--preload={preload_path}",
                "run",
                "scripts/start-server.ts",
            ]
        parameters = StdioServerParameters(
            command=shutil.which("bun") or "bun",
            args=server_args,
            env=child_environment,
            cwd=str(REPO_ROOT),
        )
        stderr_path = profile / "server.stderr.log"
        with stderr_path.open("w+", encoding="utf-8") as stderr_stream:
            stderr = StderrCapture(stderr_stream)
            try:
                async with (
                    stdio_client(parameters, errlog=stderr_stream) as streams,
                    ClientSession(*streams) as session,
                ):
                    yield session, stderr
            finally:
                if (
                    source_token_digest is not None
                    and token_path is not None
                    and _sha256(token_path) != source_token_digest
                ):
                    raise ProviderCallError("Source token store was mutated")


async def _initialize_and_check_tools(session: Any) -> None:
    await session.initialize()
    response = await session.list_tools()
    tool_names = {
        getattr(tool, "name", None) for tool in getattr(response, "tools", [])
    }
    if not {"messages", "folders"}.issubset(tool_names):
        raise ProviderCallError("Required public tool is missing")


async def _call_read_only(
    session: Any,
    tool: str,
    arguments: dict[str, Any],
    *,
    require_account: bool = False,
) -> dict[str, Any]:
    validate_read_only_call(tool, arguments, require_account=require_account)
    result = await session.call_tool(tool, arguments)
    if bool(getattr(result, "isError", False)):
        raise ProviderCallError("MCP tool returned an error")

    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, Mapping):
        return dict(structured)

    decoder = json.JSONDecoder()
    for block in getattr(result, "content", []):
        text = getattr(block, "text", None)
        if not isinstance(text, str):
            continue
        for offset, character in enumerate(text):
            if character != "{":
                continue
            try:
                payload, _ = decoder.raw_decode(text[offset:])
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                return payload
    raise ProviderCallError("MCP tool did not return a structured payload")


def _stderr_text(stderr: Any) -> str:
    if isinstance(stderr, str):
        return stderr
    getvalue = getattr(stderr, "getvalue", None)
    return getvalue() if callable(getvalue) else ""


def _attempted_interactive_auth(stderr: Any) -> bool:
    lowered = _stderr_text(stderr).casefold()
    return any(marker in lowered for marker in INTERACTIVE_AUTH_MARKERS)


def _messages(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    messages = payload.get("messages", [])
    if not isinstance(messages, list):
        raise ProviderCallError("Invalid messages payload")
    return [message for message in messages if isinstance(message, Mapping)]


def _unavailable_accounts(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    unavailable = payload.get(
        "unavailable_accounts", payload.get("skippedAccounts", [])
    )
    if not isinstance(unavailable, list):
        raise ProviderCallError("Invalid unavailable-account payload")
    return [account for account in unavailable if isinstance(account, Mapping)]


def _status_message_count(payload: Mapping[str, Any]) -> int:
    messages = payload.get("messages")
    if (
        payload.get("action") != "status"
        or payload.get("folder") != "INBOX"
        or not isinstance(messages, int)
        or isinstance(messages, bool)
        or messages < 0
    ):
        raise ProviderCallError("Invalid folders.status mailbox evidence")
    return messages


def _account_identifiers(item: Mapping[str, Any]) -> set[str]:
    fields = ("account", "account_email", "accountEmail", "email")
    return {
        value.casefold()
        for field in fields
        if isinstance((value := item.get(field)), str) and value.strip()
    }


async def _run_gmail(
    environment: dict[str, str],
    token_path: Path | None,
    factory: SessionFactory,
) -> dict[str, Any]:
    accounts = select_provider_accounts("gmail", environment)
    if not accounts:
        return _record("gmail", "FAILED", "GMAIL_INPUT_MISSING")
    account = accounts[0]
    try:
        gmail_credential = _raw_credential_for_account(account, environment)
    except ProviderCallError:
        return _record("gmail", "FAILED", "GMAIL_INPUT_MISSING")
    child_environment = _fixture_environment(environment, gmail_credential)

    try:
        async with factory("gmail", child_environment, token_path) as (session, stderr):
            await _initialize_and_check_tools(session)
            payload = await _call_read_only(
                session,
                "messages",
                {
                    "action": "search",
                    "query": "ALL",
                    "limit": RESULT_LIMIT,
                    "account": account.account,
                },
                require_account=True,
            )
            messages = _messages(payload)
            unavailable = _unavailable_accounts(payload)
            interactive_auth = _attempted_interactive_auth(stderr)
    except Exception:  # noqa: BLE001 - redact all protocol/provider failures at the scenario boundary
        return _record(
            "gmail", "FAILED", "PROVIDER_CALL_FAILED", operation="messages.search"
        )

    if interactive_auth or unavailable:
        code = (
            "INTERACTIVE_AUTH_ATTEMPT" if interactive_auth else "PROVIDER_AUTH_FAILED"
        )
        return _record("gmail", "FAILED", code, operation="messages.search")
    return _record(
        "gmail",
        "VERIFIED",
        "OK",
        operation="messages.search",
        result_count=len(messages),
    )


async def _run_yahoo(
    environment: dict[str, str],
    factory: SessionFactory,
) -> dict[str, Any]:
    try:
        async with local_imap_fixture(
            YAHOO_FIXTURE_ACCOUNT, YAHOO_FIXTURE_MESSAGE_COUNT
        ) as imap:
            credentials = (
                f"{YAHOO_FIXTURE_ACCOUNT}:{FIXTURE_PASSWORD}:"
                f"{imap.host}:{imap.port}"
            )
            fixture_environment = _fixture_environment(environment, credentials)
            async with factory(
                "yahoo-large", fixture_environment, None
            ) as (session, stderr):
                await _initialize_and_check_tools(session)
                status_payload = await _call_read_only(
                    session,
                    "folders",
                    {
                        "action": "status",
                        "account": YAHOO_FIXTURE_ACCOUNT,
                        "folder": "INBOX",
                    },
                    require_account=True,
                )
                mailbox_evidence = _status_message_count(status_payload)
                payload = await _call_read_only(
                    session,
                    "messages",
                    {
                        "action": "search",
                        "query": "ALL",
                        "folder": "INBOX",
                        "limit": RESULT_LIMIT,
                        "account": YAHOO_FIXTURE_ACCOUNT,
                    },
                    require_account=True,
                )
                messages = _messages(payload)
                unavailable = _unavailable_accounts(payload)
                interactive_auth = _attempted_interactive_auth(stderr)

            if imap.connections and (
                imap.status_requests != 1
                or imap.unbounded_search_attempted
                or not imap.bounded_search_verified()
            ):
                raise ProviderCallError("Yahoo IMAP replay was not bounded")
    except Exception:  # noqa: BLE001 - redact all protocol/provider failures at the scenario boundary
        return _record(
            "yahoo-large", "FAILED", "PROVIDER_CALL_FAILED", operation="messages.search"
        )

    if interactive_auth:
        return _record(
            "yahoo-large",
            "FAILED",
            "INTERACTIVE_AUTH_ATTEMPT",
            operation="messages.search",
        )
    if unavailable:
        return _record(
            "yahoo-large",
            "FAILED",
            "PROVIDER_AUTH_FAILED",
            operation="messages.search",
        )
    if mailbox_evidence < YAHOO_MAILBOX_THRESHOLD:
        return _record(
            "yahoo-large",
            "FAILED",
            "MAILBOX_THRESHOLD_UNPROVEN",
            operation="messages.search",
            mailbox_evidence=mailbox_evidence,
        )
    if not messages or len(messages) > RESULT_LIMIT:
        return _record(
            "yahoo-large",
            "FAILED",
            "BOUNDED_RESULTS_UNPROVEN",
            operation="messages.search",
            mailbox_evidence=mailbox_evidence,
        )
    return _record(
        "yahoo-large",
        "VERIFIED",
        "OK",
        operation="messages.search",
        result_count=len(messages),
        mailbox_evidence=mailbox_evidence,
    )


async def _run_outlook(
    environment: dict[str, str],
    factory: SessionFactory,
) -> dict[str, Any]:
    gmail_accounts = select_provider_accounts("gmail", environment)
    if not gmail_accounts:
        return _record("outlook-expired", "FAILED", "GMAIL_INPUT_MISSING")
    gmail_account = gmail_accounts[0]
    try:
        _raw_credential_for_account(gmail_account, environment)
    except ProviderCallError:
        return _record("outlook-expired", "FAILED", "GMAIL_INPUT_MISSING")

    try:
        async with (
            outlook_replay_fixture(environment, gmail_account) as fixture,
            factory(
                "outlook-expired",
                fixture.environment,
                fixture.replay_token_path,
            ) as (session, stderr),
        ):
            await _initialize_and_check_tools(session)
            payload = await _call_read_only(
                session,
                "messages",
                {
                    "action": "search",
                    "query": "ALL",
                    "folder": "INBOX",
                    "limit": RESULT_LIMIT,
                },
            )
            messages = _messages(payload)
            unavailable = _unavailable_accounts(payload)
            auth_evidence = _stderr_text(stderr) + json.dumps(
                payload, ensure_ascii=False, default=str
            )
            interactive_auth = _attempted_interactive_auth(auth_evidence)
    except Exception:  # noqa: BLE001 - redact all protocol/provider failures at the scenario boundary
        return _record(
            "outlook-expired",
            "FAILED",
            "PROVIDER_CALL_FAILED",
            operation="messages.search",
        )

    if interactive_auth:
        return _record(
            "outlook-expired",
            "FAILED",
            "INTERACTIVE_AUTH_ATTEMPT",
            operation="messages.search",
        )

    target_key = OUTLOOK_FIXTURE_ACCOUNT.casefold()
    target_skipped = [
        account
        for account in unavailable
        if target_key in _account_identifiers(account)
        and account.get("code") == "OAUTH_REFRESH_FAILED"
    ]
    healthy_results = [
        message
        for message in messages
        if gmail_account.account.casefold() in _account_identifiers(message)
    ]
    if len(target_skipped) != 1:
        return _record(
            "outlook-expired",
            "FAILED",
            "EXPIRED_TARGET_NOT_SKIPPED",
            operation="messages.search",
            result_count=len(messages),
        )
    if not healthy_results:
        return _record(
            "outlook-expired",
            "FAILED",
            "HEALTHY_RESULTS_MISSING",
            operation="messages.search",
            result_count=len(messages),
            skipped_count=len(target_skipped),
        )
    return _record(
        "outlook-expired",
        "VERIFIED",
        "OK",
        operation="messages.search",
        result_count=len(messages),
        skipped_count=len(target_skipped),
        healthy_result_count=len(healthy_results),
    )


async def run_acceptance_async(
    requested_scenario: str,
    *,
    environment: dict[str, str],
    token_path: Path | None,
    factory: SessionFactory,
) -> tuple[list[dict[str, Any]], int]:
    scenarios = SCENARIOS if requested_scenario == "all" else (requested_scenario,)
    records: list[dict[str, Any]] = []
    for scenario in scenarios:
        if scenario == "gmail":
            record = await _run_gmail(environment, token_path, factory)
        elif scenario == "yahoo-large":
            record = await _run_yahoo(environment, factory)
        else:
            record = await _run_outlook(environment, factory)
        records.append(record)
    exit_code = 0 if all(record["verdict"] == "VERIFIED" for record in records) else 1
    return records, exit_code


def run_acceptance(
    requested_scenario: str,
    *,
    env: Mapping[str, str] | None = None,
    session_factory: SessionFactory = source_session,
    token_metadata: Mapping[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if requested_scenario not in (*SCENARIOS, "all"):
        raise ValueError(f"Unsupported scenario: {requested_scenario}")

    environment = dict(os.environ if env is None else env)
    # Kept as a compatibility-only keyword for callers from the earlier harness.
    # Exact provider replays never read caller-supplied or machine token metadata.
    del token_metadata

    return asyncio.run(
        run_acceptance_async(
            requested_scenario,
            environment=environment,
            token_path=None,
            factory=session_factory,
        )
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run read-only provider acceptance scenarios"
    )
    parser.add_argument("--scenario", required=True, choices=(*SCENARIOS, "all"))
    arguments = parser.parse_args(argv)
    records, exit_code = run_acceptance(arguments.scenario)
    for record in records:
        print(serialize_record(record), flush=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
