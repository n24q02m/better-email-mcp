"""Regression tests for the live Cloudflare flow harness."""

from __future__ import annotations

import asyncio
import importlib.util
import unittest
from pathlib import Path


_SCRIPT = Path(__file__).with_name("cf_full_flow.py")
_SPEC = importlib.util.spec_from_file_location("cf_full_flow", _SCRIPT)
assert _SPEC is not None and _SPEC.loader is not None
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)


class CfFullFlowMcpSdkTest(unittest.TestCase):
    def test_session_loads_supported_streamable_http_client(self) -> None:
        transport, client_session = asyncio.run(
            _MODULE._session("https://example.invalid", "token")
        )

        self.assertTrue(hasattr(transport, "__aenter__"))
        self.assertEqual(client_session.__name__, "ClientSession")

    def test_client_streams_accepts_current_and_legacy_transport_shapes(self) -> None:
        self.assertEqual(
            _MODULE._client_streams(("read", "write")), ("read", "write")
        )
        self.assertEqual(
            _MODULE._client_streams(("read", "write", "legacy")),
            ("read", "write"),
        )


if __name__ == "__main__":
    unittest.main()
