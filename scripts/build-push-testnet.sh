#!/bin/bash
set -euo pipefail

# GT8004 Testnet — Build & Push Docker images to Artifact Registry
# Usage: bash scripts/build-push-testnet.sh [TAG]
# Requires: gcloud auth configure-docker ${REGION}-docker.pkg.dev

PROJECT_ID="${GCP_PROJECT_ID:-vataops}"
REGION="${GCP_REGION:-us-central1}"
REPO="gt8004-testnet"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
TAG="${1:-latest}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== GT8004 Testnet Image Build ==="
echo "Registry: ${REGISTRY}"
echo "Tag:      ${TAG}"
echo ""

# Ensure docker auth is configured
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet 2>/dev/null || true

build_and_push() {
  local svc="$1"
  local dockerfile="$2"
  local image="${REGISTRY}/${svc}:${TAG}"

  echo "── Building ${svc} ──"
  echo "  Dockerfile: ${dockerfile}"
  echo "  Image:      ${image}"

  docker build -f "${dockerfile}" -t "${image}" .
  docker push "${image}"

  echo "  ✓ ${svc} pushed"
  echo ""
}

build_and_push "apigateway" "services/apigateway/Dockerfile"
build_and_push "registry"   "services/registry/backend/Dockerfile"
build_and_push "analytics"  "services/analytics/Dockerfile"
build_and_push "discovery"  "services/discovery/Dockerfile"
build_and_push "ingest"     "services/ingest/Dockerfile"

# Dashboard — Next.js needs API URLs baked in at build time
APIGATEWAY_URL="${APIGATEWAY_URL:-https://testnet.api.gt8004.xyz}"
echo "── Building dashboard ──"
echo "  Dockerfile: dashboard/Dockerfile"
echo "  Image:      ${REGISTRY}/dashboard:${TAG}"
echo "  NEXT_PUBLIC_OPEN_API_URL: ${APIGATEWAY_URL}"
docker build \
  --build-arg "NEXT_PUBLIC_OPEN_API_URL=${APIGATEWAY_URL}" \
  --build-arg "NEXT_PUBLIC_NETWORK_MODE=testnet" \
  -t "${REGISTRY}/dashboard:${TAG}" \
  ./dashboard
docker push "${REGISTRY}/dashboard:${TAG}"
echo "  ✓ dashboard pushed"
echo ""

echo "=== All images built and pushed ==="
echo ""
echo "Images:"
echo "  ${REGISTRY}/apigateway:${TAG}"
echo "  ${REGISTRY}/registry:${TAG}"
echo "  ${REGISTRY}/analytics:${TAG}"
echo "  ${REGISTRY}/discovery:${TAG}"
echo "  ${REGISTRY}/ingest:${TAG}"
echo "  ${REGISTRY}/dashboard:${TAG}"
echo ""
echo "Next:"
echo "  1. cd infra/testnet && terraform apply"
echo "  2. firebase deploy --only hosting"
