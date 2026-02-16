"""Verify that GT8004 SDK middleware captures x402 payment data from X-Payment header.

This test creates a minimal FastAPI app with GT8004Middleware (mocked logger)
and sends requests with/without X-Payment headers to verify revenue tracking.

Run:
    cd agents/friend-agent && python -m pytest tests/test_revenue.py -v
    # or standalone:
    cd agents/friend-agent && python tests/test_revenue.py
"""

import json
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from gt8004.middleware.fastapi import GT8004Middleware
from gt8004.types import RequestLogEntry


def _create_app():
    """Create a minimal FastAPI app with GT8004 middleware (mocked logger)."""
    mock_logger = MagicMock()
    mock_logger.protocol = "a2a"
    mock_logger.log = AsyncMock()

    app = FastAPI()
    app.add_middleware(GT8004Middleware, logger=mock_logger)

    @app.post("/a2a/tasks/send")
    async def send_task():
        return {"status": "ok", "id": "task-123"}

    @app.get("/health")
    async def health():
        return {"ok": True}

    return app, mock_logger


class TestRevenueTracking:
    def test_x402_payment_captured(self):
        """X-Payment header should populate x402 fields in log entry."""
        app, logger = _create_app()
        client = TestClient(app)

        payment = {
            "amount": 0.50,
            "tx_hash": "0xabc123def456789",
            "token": "USDC",
            "payer": "0x1234567890abcdef1234567890abcdef12345678",
        }
        client.post(
            "/a2a/tasks/send",
            json={"message": {"parts": [{"text": "hello"}]}},
            headers={"X-Payment": json.dumps(payment)},
        )

        assert logger.log.called
        entry: RequestLogEntry = logger.log.call_args[0][0]
        assert entry.x402_amount == 0.50
        assert entry.x402_tx_hash == "0xabc123def456789"
        assert entry.x402_token == "USDC"
        assert entry.x402_payer == "0x1234567890abcdef1234567890abcdef12345678"

    def test_no_payment_header(self):
        """Without X-Payment header, x402 fields should be None."""
        app, logger = _create_app()
        client = TestClient(app)

        client.get("/health")

        entry: RequestLogEntry = logger.log.call_args[0][0]
        assert entry.x402_amount is None
        assert entry.x402_tx_hash is None
        assert entry.x402_token is None
        assert entry.x402_payer is None

    def test_malformed_payment_header(self):
        """Malformed X-Payment header should be silently ignored."""
        app, logger = _create_app()
        client = TestClient(app)

        client.get("/health", headers={"X-Payment": "invalid{json"})

        entry: RequestLogEntry = logger.log.call_args[0][0]
        assert entry.x402_amount is None
        assert entry.x402_tx_hash is None

    def test_camel_case_serialization(self):
        """x402 fields should serialize to camelCase for ingest API compatibility."""
        app, logger = _create_app()
        client = TestClient(app)

        payment = {"amount": 1.5, "tx_hash": "0xaaa", "token": "USDC", "payer": "0xbbb"}
        client.get("/health", headers={"X-Payment": json.dumps(payment)})

        entry: RequestLogEntry = logger.log.call_args[0][0]
        data = entry.model_dump(by_alias=True, exclude_none=True)
        assert data["x402Amount"] == 1.5
        assert data["x402TxHash"] == "0xaaa"
        assert data["x402Token"] == "USDC"
        assert data["x402Payer"] == "0xbbb"

    def test_a2a_skill_with_payment(self):
        """A2A request with skill_id and payment should capture both tool_name and x402."""
        app, logger = _create_app()
        client = TestClient(app)

        payment = {"amount": 0.25, "tx_hash": "0x999", "token": "USDC", "payer": "0xfoo"}
        client.post(
            "/a2a/tasks/send",
            json={"skill_id": "translate", "message": {"parts": [{"text": "hello"}]}},
            headers={"X-Payment": json.dumps(payment)},
        )

        entry: RequestLogEntry = logger.log.call_args[0][0]
        assert entry.tool_name == "translate"
        assert entry.x402_amount == 0.25
        assert entry.x402_payer == "0xfoo"


if __name__ == "__main__":
    import sys

    app, logger = _create_app()
    client = TestClient(app)

    # Test 1: Valid payment
    payment = {"amount": 0.50, "tx_hash": "0xabc123", "token": "USDC", "payer": "0xdef456"}
    client.post(
        "/a2a/tasks/send",
        json={"message": {"parts": [{"text": "hello"}]}},
        headers={"X-Payment": json.dumps(payment)},
    )
    entry = logger.log.call_args[0][0]
    assert entry.x402_amount == 0.50, f"Expected 0.50, got {entry.x402_amount}"
    data = entry.model_dump(by_alias=True, exclude_none=True)
    assert "x402Amount" in data
    print(f"[PASS] Valid payment: x402Amount={data['x402Amount']}, x402TxHash={data['x402TxHash']}")

    # Test 2: No payment
    logger.log.reset_mock()
    client.get("/health")
    entry2 = logger.log.call_args[0][0]
    assert entry2.x402_amount is None
    print("[PASS] No payment: x402 fields are None")

    # Test 3: Malformed header
    logger.log.reset_mock()
    client.get("/health", headers={"X-Payment": "garbage"})
    entry3 = logger.log.call_args[0][0]
    assert entry3.x402_amount is None
    print("[PASS] Malformed header: gracefully ignored")

    print("\nAll revenue tracking tests passed!")
    sys.exit(0)
