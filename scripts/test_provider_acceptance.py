from __future__ import annotations

import asyncio
import io
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import provider_acceptance as acceptance


class FakeResult:
    def __init__(
        self, payload: dict[str, Any] | None = None, *, is_error: bool = False
    ) -> None:
        self.structuredContent = payload
        self.content: list[Any] = []
        self.isError = is_error


class FakeSession:
    def __init__(self, responses: list[FakeResult]) -> None:
        self.responses = list(responses)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.initialized = False
        self.listed = False

    async def initialize(self) -> None:
        self.initialized = True

    async def list_tools(self) -> Any:
        self.listed = True
        return SimpleNamespace(
            tools=[
                SimpleNamespace(name="messages"),
                SimpleNamespace(name="folders"),
                SimpleNamespace(name="config"),
            ]
        )

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> FakeResult:
        self.calls.append((name, arguments))
        if not self.responses:
            raise AssertionError("Unexpected extra MCP tool call")
        return self.responses.pop(0)


def session_factory(session: FakeSession, transcript: str = "") -> Any:
    calls: list[str] = []
    environments: list[dict[str, str]] = []
    token_paths: list[Path | None] = []

    @asynccontextmanager
    async def factory(
        scenario: str, environment: dict[str, str], token_path: Path | None
    ) -> Any:
        calls.append(scenario)
        environments.append(dict(environment))
        token_paths.append(token_path)
        stderr = io.StringIO()
        stderr.write(transcript)
        yield session, stderr

    factory.calls = calls
    factory.environments = environments
    factory.token_paths = token_paths
    return factory


def gmail_environment() -> dict[str, str]:
    return {"EMAIL_CREDENTIALS": "gmail.acceptance@gmail.com:app-password"}


def gmail_success() -> FakeResult:
    return FakeResult(
        {
            "action": "search",
            "total": 1,
            "accounts_searched": ["gmail.acceptance@gmail.com"],
            "messages": [{"uid": 42, "account_email": "gmail.acceptance@gmail.com"}],
            "unavailable_accounts": [],
        }
    )


def test_provider_selection_uses_provider_metadata_instead_of_credential_order() -> (
    None
):
    environment = {
        "EMAIL_CREDENTIALS": (
            "first@outlook.com:one,selected@gmail.com:two,last@yahoo.com:three"
        )
    }

    selected = acceptance.select_provider_accounts("gmail", environment)

    assert [account.account for account in selected] == ["selected@gmail.com"]
    assert selected[0].provider == "gmail"
    assert not hasattr(selected[0], "password")


def test_explicit_selector_must_name_an_account_for_the_requested_provider() -> None:
    environment = {
        "EMAIL_CREDENTIALS": "one@gmail.com:one,two@gmail.com:two",
        "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT": "two@gmail.com",
    }

    selected = acceptance.select_provider_accounts("gmail", environment)
    assert [account.account for account in selected] == ["two@gmail.com"]

    environment["PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT"] = "missing@gmail.com"
    assert acceptance.select_provider_accounts("gmail", environment) == []


def test_read_only_guard_rejects_mutating_and_setup_calls() -> None:
    acceptance.validate_read_only_call(
        "messages",
        {"action": "search", "query": "ALL", "limit": 3, "account": "safe@gmail.com"},
        require_account=True,
    )
    acceptance.validate_read_only_call(
        "folders",
        {
            "action": "status",
            "account": "safe@yahoo.test",
            "folder": "INBOX",
        },
        require_account=True,
    )

    for tool, arguments in [
        ("messages", {"action": "send"}),
        ("messages", {"action": "reply"}),
        ("messages", {"action": "move"}),
        ("messages", {"action": "trash"}),
        ("messages", {"action": "delete"}),
        ("messages", {"action": "flag"}),
        ("messages", {"action": "mark"}),
        ("config", {"action": "setup", "mode": "save"}),
        ("config", {"action": "setup", "mode": "reset"}),
        ("folders", {"action": "status", "account": "safe@yahoo.test"}),
        ("folders", {"action": "status", "folder": "INBOX"}),
        ("folders", {"action": "list", "folder": "INBOX"}),
    ]:
        with pytest.raises(acceptance.UnsafeOperation):
            acceptance.validate_read_only_call(tool, arguments)


def test_source_session_uses_a_subprocess_compatible_redacted_stderr_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    captured: dict[str, Any] = {}
    source_token_path = tmp_path / "source-tokens.json"
    source_token_bytes = b'{"fixture":{"accessToken":"source-only"}}'
    source_token_path.write_bytes(source_token_bytes)

    @asynccontextmanager
    async def fake_stdio_client(parameters: Any, *, errlog: Any) -> Any:
        captured["fileno"] = errlog.fileno()
        profile = Path(parameters.env["USERPROFILE"])
        child_token_path = profile / ".better-email-mcp" / "tokens.json"
        captured["profile"] = profile
        captured["child_token_path"] = child_token_path
        assert child_token_path.read_bytes() == source_token_bytes
        child_token_path.write_text('{"fixture":"child-mutated"}', encoding="utf-8")
        errlog.write("server started without account data")
        errlog.flush()
        yield "read", "write"

    class FakeClientSessionContext:
        def __init__(self, *streams: Any) -> None:
            captured["streams"] = streams

        async def __aenter__(self) -> Any:
            return SimpleNamespace()

        async def __aexit__(self, *args: object) -> None:
            del args

    monkeypatch.setattr(acceptance, "stdio_client", fake_stdio_client)
    monkeypatch.setattr(acceptance, "ClientSession", FakeClientSessionContext)

    async def inspect_session() -> None:
        async with acceptance.source_session(
            "gmail", {}, source_token_path
        ) as (_, stderr):
            assert "server started" in acceptance._stderr_text(stderr)

    asyncio.run(inspect_session())

    assert isinstance(captured["fileno"], int)
    assert captured["streams"] == ("read", "write")
    assert source_token_path.read_bytes() == source_token_bytes
    assert not captured["profile"].exists()


def test_outlook_source_session_preloads_only_the_refresh_rejection_fixture(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    @asynccontextmanager
    async def fake_stdio_client(parameters: Any, *, errlog: Any) -> Any:
        del errlog
        captured["args"] = parameters.args
        _, separator, preload_value = parameters.args[0].partition("=")
        assert separator == "="
        preload_path = Path(preload_value)
        assert preload_path.is_file()
        preload_text = preload_path.read_text(encoding="utf-8")
        assert "invalid_grant" in preload_text
        assert "devicecode" not in preload_text.casefold()
        yield "read", "write"

    class FakeClientSessionContext:
        def __init__(self, *streams: Any) -> None:
            del streams

        async def __aenter__(self) -> Any:
            return SimpleNamespace()

        async def __aexit__(self, *args: object) -> None:
            del args

    monkeypatch.setattr(acceptance, "stdio_client", fake_stdio_client)
    monkeypatch.setattr(acceptance, "ClientSession", FakeClientSessionContext)

    async def inspect_session() -> None:
        async with acceptance.source_session("outlook-expired", {}, None):
            pass

    asyncio.run(inspect_session())

    assert captured["args"][0].startswith("--preload=")
    assert captured["args"][1:] == ["run", "scripts/start-server.ts"]


def test_redacted_jsonl_has_a_strict_field_allowlist() -> None:
    line = acceptance.serialize_record(
        {
            "scenario": "gmail",
            "provider": "gmail",
            "verdict": "FAILED",
            "operation": "messages.search",
            "code": "PROVIDER_CALL_FAILED",
            "result_count": 0,
            "account": "private@gmail.com",
            "detail": "Bearer secret-token https://login.example.test",
            "subject": "private subject",
        }
    )
    payload = json.loads(line)

    assert payload == {
        "scenario": "gmail",
        "provider": "gmail",
        "verdict": "FAILED",
        "operation": "messages.search",
        "code": "PROVIDER_CALL_FAILED",
        "result_count": 0,
    }
    assert "@" not in line
    assert "secret-token" not in line
    assert "https://" not in line


def test_gmail_missing_input_and_provider_failure_are_failed_never_user_gate() -> None:
    def forbidden_factory(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("Missing Gmail input must fail before spawning the server")

    records, exit_code = acceptance.run_acceptance(
        "gmail", env={}, session_factory=forbidden_factory, token_metadata={}
    )
    assert exit_code != 0
    assert records[0]["verdict"] == "FAILED"

    session = FakeSession([FakeResult(is_error=True)])
    records, exit_code = acceptance.run_acceptance(
        "gmail",
        env=gmail_environment(),
        session_factory=session_factory(session),
        token_metadata={},
    )
    assert exit_code != 0
    assert records[0]["verdict"] == "FAILED"
    assert records[0]["verdict"] != "USER_GATE"


def test_gmail_runs_real_protocol_shape_with_explicit_bounded_account_call() -> None:
    session = FakeSession([gmail_success()])
    factory = session_factory(session)

    records, exit_code = acceptance.run_acceptance(
        "gmail",
        env=gmail_environment(),
        session_factory=factory,
        token_metadata={},
    )

    assert exit_code == 0
    assert records == [
        {
            "scenario": "gmail",
            "provider": "gmail",
            "verdict": "VERIFIED",
            "operation": "messages.search",
            "code": "OK",
            "result_count": 1,
        }
    ]
    assert session.initialized is True
    assert session.listed is True
    assert factory.calls == ["gmail"]
    assert session.calls == [
        (
            "messages",
            {
                "action": "search",
                "query": "ALL",
                "limit": 3,
                "account": "gmail.acceptance@gmail.com",
            },
        )
    ]


def test_gmail_child_process_receives_only_the_selected_credential() -> None:
    selected_account = "selected.acceptance@gmail.com"
    selected_credential = f"{selected_account}:selected-app-password"
    environment = {
        "EMAIL_CREDENTIALS": (
            "other@gmail.com:other-app-password,"
            f"{selected_credential},"
            "unrelated@outlook.com"
        ),
        "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT": selected_account,
        "UNRELATED_SECRET": "must-not-reach-the-child",
    }
    session = FakeSession(
        [
            FakeResult(
                {
                    "action": "search",
                    "messages": [{"uid": 42, "account_email": selected_account}],
                    "unavailable_accounts": [],
                }
            )
        ]
    )
    factory = session_factory(session)

    records, exit_code = acceptance.run_acceptance(
        "gmail",
        env=environment,
        session_factory=factory,
    )

    assert exit_code == 0
    assert records[0]["verdict"] == "VERIFIED"
    child_environment = factory.environments[0]
    assert child_environment["EMAIL_CREDENTIALS"] == selected_credential
    assert "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT" not in child_environment
    assert "UNRELATED_SECRET" not in child_environment
    assert set(child_environment) <= {
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
        "EMAIL_CREDENTIALS",
        "NODE_ENV",
        "NO_COLOR",
    }


def test_yahoo_large_uses_targeted_status_before_bounded_search() -> None:
    session = FakeSession(
        [
            FakeResult(
                {
                    "action": "status",
                    "account_email": acceptance.YAHOO_FIXTURE_ACCOUNT,
                    "folder": "INBOX",
                    "messages": 10_025,
                    "unseen": 17,
                    "uid_next": 10_026,
                }
            ),
            FakeResult(
                {
                    "action": "search",
                    "total": 1,
                    "messages": [
                        {
                            "uid": 10_025,
                            "account_email": acceptance.YAHOO_FIXTURE_ACCOUNT,
                        }
                    ],
                    "unavailable_accounts": [],
                }
            ),
        ]
    )
    records, exit_code = acceptance.run_acceptance(
        "yahoo-large",
        env={},
        session_factory=session_factory(session),
    )

    assert exit_code == 0
    assert records[0]["verdict"] == "VERIFIED"
    assert records[0]["mailbox_evidence"] == 10_025
    assert session.calls == [
        (
            "folders",
            {
                "action": "status",
                "account": acceptance.YAHOO_FIXTURE_ACCOUNT,
                "folder": "INBOX",
            },
        ),
        (
            "messages",
            {
                "action": "search",
                "query": "ALL",
                "folder": "INBOX",
                "limit": 3,
                "account": acceptance.YAHOO_FIXTURE_ACCOUNT,
            },
        ),
    ]


def test_yahoo_count_evidence_accepts_only_folders_status_messages() -> None:
    assert acceptance._status_message_count(
        {"action": "status", "folder": "INBOX", "messages": 10_025}
    ) == 10_025
    with pytest.raises(acceptance.ProviderCallError):
        acceptance._status_message_count(
            {
                "action": "list",
                "folders": [{"path": "INBOX"}],
            }
        )


def outlook_success(healthy_account: str) -> FakeResult:
    return FakeResult(
        {
            "action": "search",
            "messages": [
                {"uid": 7, "account_email": healthy_account}
            ],
            "unavailable_accounts": [
                {
                    "account_email": acceptance.OUTLOOK_FIXTURE_ACCOUNT,
                    "code": "OAUTH_REFRESH_FAILED",
                }
            ],
        }
    )


def test_outlook_expired_selects_and_isolates_one_real_gmail_credential(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    selected_account = "selected.acceptance@gmail.com"
    selected_raw_credential = f"{selected_account}:selected:app-password"
    environment = {
        "EMAIL_CREDENTIALS": (
            "unrelated@outlook.com,"
            "other@gmail.com:other-app-password,"
            f"{selected_raw_credential},"
            "last@yahoo.com:yahoo-app-password"
        ),
        "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT": selected_account,
    }
    session = FakeSession([outlook_success(selected_account)])
    factory = session_factory(session)

    @asynccontextmanager
    async def forbidden_local_imap_fixture(*args: Any, **kwargs: Any) -> Any:
        del args, kwargs
        raise AssertionError("Outlook replay must retain a real Gmail credential")
        yield

    monkeypatch.setattr(
        acceptance, "local_imap_fixture", forbidden_local_imap_fixture
    )

    records, exit_code = acceptance.run_acceptance(
        "outlook-expired",
        env=environment,
        session_factory=factory,
    )

    assert exit_code == 0
    assert records == [
        {
            "scenario": "outlook-expired",
            "provider": "outlook",
            "verdict": "VERIFIED",
            "operation": "messages.search",
            "code": "OK",
            "result_count": 1,
            "skipped_count": 1,
            "healthy_result_count": 1,
        }
    ]
    assert session.calls == [
        (
            "messages",
            {"action": "search", "query": "ALL", "folder": "INBOX", "limit": 3},
        )
    ]
    assert factory.token_paths[0] is not None
    assert not factory.token_paths[0].exists()
    child_credentials = factory.environments[0]["EMAIL_CREDENTIALS"].split(",")
    assert child_credentials == [
        selected_raw_credential,
        acceptance.OUTLOOK_FIXTURE_ACCOUNT,
    ]
    assert "other@gmail.com:other-app-password" not in child_credentials
    assert "unrelated@outlook.com" not in child_credentials
    serialized = acceptance.serialize_record(records[0])
    assert selected_account not in serialized
    assert "selected:app-password" not in serialized


def test_outlook_missing_or_unmatched_gmail_is_failed_before_server_spawn() -> None:
    def forbidden_factory(*args: Any, **kwargs: Any) -> Any:
        del args, kwargs
        raise AssertionError("Missing Gmail input must fail before spawning the server")

    for environment in (
        {},
        {"EMAIL_CREDENTIALS": "only@outlook.com"},
        {
            "EMAIL_CREDENTIALS": "available@gmail.com:app-password",
            "PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT": "missing@gmail.com",
        },
    ):
        records, exit_code = acceptance.run_acceptance(
            "outlook-expired",
            env=environment,
            session_factory=forbidden_factory,
        )

        assert exit_code != 0
        assert records == [
            {
                "scenario": "outlook-expired",
                "provider": "outlook",
                "verdict": "FAILED",
                "operation": "preflight",
                "code": "GMAIL_INPUT_MISSING",
            }
        ]
        assert "USER_GATE" not in acceptance.serialize_record(records[0])


def test_outlook_interactive_auth_output_is_failed() -> None:
    healthy_account = "healthy.acceptance@gmail.com"
    session = FakeSession([outlook_success(healthy_account)])

    records, exit_code = acceptance.run_acceptance(
        "outlook-expired",
        env={"EMAIL_CREDENTIALS": f"{healthy_account}:app-password"},
        session_factory=session_factory(
            session,
            transcript="Open https://microsoft.com/devicelogin and enter device code ABCD",
        ),
    )

    assert exit_code != 0
    assert records[0]["verdict"] == "FAILED"
    assert records[0]["code"] == "INTERACTIVE_AUTH_ATTEMPT"


def test_outlook_fixture_expires_only_a_copy_and_cleans_every_temp_file() -> None:
    captured: dict[str, Path] = {}
    environment = gmail_environment()
    gmail_account = acceptance.select_provider_accounts("gmail", environment)[0]

    async def inspect_fixture() -> None:
        async with acceptance.outlook_replay_fixture(
            environment, gmail_account
        ) as fixture:
            captured["root"] = fixture.root
            captured["original"] = fixture.original_token_path
            captured["copy"] = fixture.replay_token_path
            original = json.loads(fixture.original_token_path.read_text(encoding="utf-8"))
            replay = json.loads(fixture.replay_token_path.read_text(encoding="utf-8"))
            original_token = original[acceptance.OUTLOOK_FIXTURE_ACCOUNT]
            replay_token = replay[acceptance.OUTLOOK_FIXTURE_ACCOUNT]
            assert original_token["expiresAt"] > replay_token["expiresAt"]
            assert original_token["refreshToken"] != replay_token["refreshToken"]
            assert original_token["accessToken"] == replay_token["accessToken"]

    asyncio.run(inspect_fixture())

    assert not captured["root"].exists()
    assert not captured["original"].exists()
    assert not captured["copy"].exists()


def test_exact_yahoo_fixture_replay_runs_current_source_without_user_gate() -> None:
    yahoo_records, yahoo_exit = acceptance.run_acceptance("yahoo-large", env={})

    assert yahoo_exit == 0
    assert yahoo_records[0]["verdict"] == "VERIFIED"
    assert yahoo_records[0]["mailbox_evidence"] >= 10_000
    assert 0 < yahoo_records[0]["result_count"] <= 3
    serialized = "\n".join(
        acceptance.serialize_record(record) for record in yahoo_records
    )
    assert "USER_GATE" not in serialized
    assert "@" not in serialized
    assert "http://" not in serialized
    assert "https://" not in serialized


@pytest.mark.skipif(
    not os.environ.get("PROVIDER_ACCEPTANCE_GMAIL_ACCOUNT"),
    reason="Exact Outlook source replay requires an explicitly selected real Gmail input",
)
def test_exact_outlook_replay_runs_current_source_without_user_gate() -> None:
    records, exit_code = acceptance.run_acceptance(
        "outlook-expired", env=dict(os.environ)
    )

    assert exit_code == 0
    assert records[0]["verdict"] == "VERIFIED"
    assert records[0]["skipped_count"] == 1
    assert records[0]["healthy_result_count"] > 0
    serialized = acceptance.serialize_record(records[0])
    assert "USER_GATE" not in serialized
    assert "@" not in serialized
    assert "http://" not in serialized
    assert "https://" not in serialized


def test_all_is_nonzero_when_gmail_input_is_missing() -> None:
    session = FakeSession(
        [
            FakeResult(
                {
                    "action": "status",
                    "folder": "INBOX",
                    "messages": 10_025,
                    "unseen": 17,
                    "uid_next": 10_026,
                }
            ),
            FakeResult(
                {
                    "action": "search",
                    "messages": [
                        {
                            "uid": 10_025,
                            "account_email": acceptance.YAHOO_FIXTURE_ACCOUNT,
                        }
                    ],
                    "unavailable_accounts": [],
                }
            ),
        ]
    )
    factory = session_factory(session)

    records, exit_code = acceptance.run_acceptance(
        "all",
        env={},
        session_factory=factory,
    )

    assert [record["verdict"] for record in records] == [
        "FAILED",
        "VERIFIED",
        "FAILED",
    ]
    assert exit_code != 0
    assert records[2]["code"] == "GMAIL_INPUT_MISSING"
    assert factory.calls == ["yahoo-large"]
