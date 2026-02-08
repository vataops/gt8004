#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
AEL_BACKEND="${AEL_BACKEND:-http://localhost:8080}"
AGENT_PORT="${AGENT_PORT:-3100}"

# Agent origin as seen from the Docker container
# On macOS Docker Desktop, host.docker.internal resolves to the host machine.
# On Linux, use the docker bridge gateway (172.17.0.1) or --network=host.
AGENT_ORIGIN="${AGENT_ORIGIN:-http://host.docker.internal:${AGENT_PORT}}"

AGENT_PID=""
COMPOSE_UP=false

cleanup() {
  echo ""
  echo "── Cleanup ──"
  if [ -n "$AGENT_PID" ] && kill -0 "$AGENT_PID" 2>/dev/null; then
    echo "Stopping test agent (PID $AGENT_PID)..."
    kill "$AGENT_PID" 2>/dev/null || true
    wait "$AGENT_PID" 2>/dev/null || true
  fi
  if [ "$COMPOSE_UP" = true ]; then
    echo "Stopping docker compose..."
    docker compose -f "$ROOT/docker-compose.yml" down --timeout 5 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== AEL E2E Test Runner ==="
echo ""

# ── 1. Build SDK ──
echo "── 1. Building SDK ──"
cd "$ROOT/common/sdk"
npm install --silent 2>/dev/null
npm run build
echo "  SDK built."

# ── 2. Start infra ──
echo ""
echo "── 2. Starting infrastructure (postgres + open-backend) ──"
docker compose -f "$ROOT/docker-compose.yml" up -d postgres open-backend
COMPOSE_UP=true

echo "  Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${AEL_BACKEND}/healthz" > /dev/null 2>&1; then
    echo "  Backend ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ERROR: Backend failed to start in 30s."
    docker compose -f "$ROOT/docker-compose.yml" logs open-backend --tail=30
    exit 1
  fi
  sleep 1
done

# ── 3. Install E2E deps ──
echo ""
echo "── 3. Installing E2E dependencies ──"
cd "$ROOT/tests/e2e"
npm install --silent 2>/dev/null
cd "$ROOT/tests/e2e/test-agent"
npm install --silent 2>/dev/null
echo "  Dependencies installed."

# ── 4. Register agent & get API key ──
echo ""
echo "── 4. Registering test agent ──"

# Generate a random wallet for this test run using Node.js + ethers
WALLET_JSON=$(node -e "
  const { ethers } = require('ethers');
  const w = ethers.Wallet.createRandom();
  console.log(JSON.stringify({ address: w.address, privateKey: w.privateKey }));
" 2>/dev/null || npx -y tsx -e "
  import { ethers } from 'ethers';
  const w = ethers.Wallet.createRandom();
  console.log(JSON.stringify({ address: w.address, privateKey: w.privateKey }));
")

AGENT_ID=$(echo "$WALLET_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).address)")
WALLET_KEY=$(echo "$WALLET_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).privateKey)")

echo "  Agent ID (wallet): ${AGENT_ID}"

REGISTER_RESP=$(curl -sf -X POST "${AEL_BACKEND}/v1/agents/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"${AGENT_ID}\",
    \"name\": \"E2E Test Agent (Sepolia)\",
    \"origin_endpoint\": \"${AGENT_ORIGIN}\",
    \"protocols\": [\"erc8004\", \"x402\"],
    \"category\": \"ai-chat\",
    \"pricing\": { \"model\": \"per-request\", \"amount\": \"0.001\", \"currency\": \"ETH\" }
  }")

API_KEY=$(echo "$REGISTER_RESP" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).api_key)")

if [ -z "$API_KEY" ]; then
  echo "  ERROR: Failed to get API key."
  echo "  Response: $REGISTER_RESP"
  exit 1
fi
echo "  API Key: ${API_KEY:0:16}..."

# ── 5. Start test agent ──
echo ""
echo "── 5. Starting test agent ──"
cd "$ROOT/tests/e2e/test-agent"
AGENT_PORT="$AGENT_PORT" \
AGENT_ID="$AGENT_ID" \
AEL_API_KEY="$API_KEY" \
AEL_ENDPOINT="$AEL_BACKEND" \
npx tsx src/server.ts &
AGENT_PID=$!

echo "  Waiting for test agent (PID $AGENT_PID) on port $AGENT_PORT..."
for i in $(seq 1 15); do
  if curl -sf "http://localhost:${AGENT_PORT}/health" > /dev/null 2>&1; then
    echo "  Test agent ready."
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "  ERROR: Test agent failed to start in 15s."
    exit 1
  fi
  sleep 1
done

# ── 6. Run test client ──
echo ""
echo "── 6. Running E2E test client ──"
cd "$ROOT/tests/e2e"
WALLET_PRIVATE_KEY="$WALLET_KEY" \
AEL_API_KEY="$API_KEY" \
AGENT_ID="$AGENT_ID" \
AEL_BACKEND="$AEL_BACKEND" \
AGENT_PORT="$AGENT_PORT" \
AGENT_ORIGIN="$AGENT_ORIGIN" \
npx tsx test-client.ts

echo ""
echo "=== E2E Test Complete ==="
