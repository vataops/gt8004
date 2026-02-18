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
SERVICE_NAME="${SERVICE_NAME:-gt8004-mcp}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

cd "${AGENT_DIR}"

echo "=== Building and pushing image (MCP) ==="
cp mcp/Dockerfile Dockerfile
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
  --timeout 120 \
  --set-env-vars "^;;^AGENT_NAME=${AGENT_NAME:-GT8004 Platform Agent};;AGENT_VERSION=${AGENT_VERSION:-1.0.0};;GT8004_API_URL=${GT8004_API_URL:-https://api.gt8004.xyz};;A2A_BASE_URL=${A2A_BASE_URL:-};;INTERNAL_API_KEY=${INTERNAL_API_KEY:-};;GT8004_AGENT_ID=${GT8004_AGENT_ID:-};;GT8004_API_KEY=${GT8004_API_KEY:-};;GT8004_INGEST_URL=${GT8004_INGEST_URL:-https://ingest.gt8004.xyz/v1/ingest}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo ""
echo "=== MCP Server Deployed ==="
echo "URL:        ${SERVICE_URL}"
echo "Health:     ${SERVICE_URL}/health"
echo "MCP:        ${SERVICE_URL}/mcp"
