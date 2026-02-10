#!/bin/bash
set -euo pipefail

# Load shared .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
    echo "Loaded env from ${ENV_FILE}"
else
    echo "Warning: ${ENV_FILE} not found, using shell environment"
fi

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-ael-friend-agent}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

cd "${SCRIPT_DIR}/.."

echo "=== Building and pushing image ==="
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}" .

echo "=== Deploying to Cloud Run ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 128Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60 \
  --set-env-vars "^;;^LLM_MODEL=${LLM_MODEL:-gpt-4o};;AGENT_NAME=${AGENT_NAME:-Friend-Agent};;AGENT_DESCRIPTION=${AGENT_DESCRIPTION:-General-purpose LLM agent};;AGENT_VERSION=${AGENT_VERSION:-1.0.0};;OPENAI_API_KEY=${OPENAI_API_KEY:?Set OPENAI_API_KEY}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format 'value(status.url)')

echo ""
echo "=== Deployed ==="
echo "URL:        ${SERVICE_URL}"
echo "Health:     ${SERVICE_URL}/health"
echo "Agent Card: ${SERVICE_URL}/.well-known/agent.json"
echo ""
echo "Next steps:"
echo "  1. Set AGENT_URL in .env:"
echo "     AGENT_URL=${SERVICE_URL}"
echo "  2. Update Cloud Run env:"
echo "     gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars AGENT_URL=${SERVICE_URL}"
echo "  3. Mint ERC-8004 token:"
echo "     python erc8004/mint.py"
