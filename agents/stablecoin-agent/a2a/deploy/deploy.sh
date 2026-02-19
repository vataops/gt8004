#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="${SCRIPT_DIR}/../.."
ENV_FILE="${AGENT_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
    echo "Loaded env from ${ENV_FILE}"
else
    echo "Warning: ${ENV_FILE} not found, using shell environment"
fi

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-stablecoin-a2a}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

cd "${AGENT_DIR}"

echo "=== Building and pushing image (A2A) ==="
cp a2a/Dockerfile Dockerfile
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}" .
rm -f Dockerfile

echo "=== Deploying to Cloud Run ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60 \
  --set-env-vars "^;;^LLM_MODEL=${LLM_MODEL:-gemini-2.0-flash};;AGENT_NAME=${AGENT_NAME:-Stablecoin Search Agent};;AGENT_VERSION=${AGENT_VERSION:-1.0.0};;GOOGLE_API_KEY=${GOOGLE_API_KEY:?Set GOOGLE_API_KEY};;X402_PAY_TO=${X402_PAY_TO:-};;X402_NETWORK=${X402_NETWORK:-base};;X402_PRICE=${X402_PRICE:-0.01};;CDP_API_KEY_ID=${CDP_API_KEY_ID:-};;CDP_API_KEY_SECRET=${CDP_API_KEY_SECRET:-};;INTERNAL_API_KEY=${INTERNAL_API_KEY:-};;GT8004_AGENT_ID=${GT8004_AGENT_ID:-};;GT8004_API_KEY=${GT8004_API_KEY:-};;GT8004_INGEST_URL=${GT8004_INGEST_URL:-https://ingest.gt8004.xyz/v1/ingest}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo ""
echo "=== A2A Server Deployed ==="
echo "URL:        ${SERVICE_URL}"
echo "Health:     ${SERVICE_URL}/health"
echo "Agent Card: ${SERVICE_URL}/.well-known/agent.json"
