#!/bin/bash
set -e

cd "$(dirname "$0")/dashboard"

# Default API URLs (override with env vars)
export NEXT_PUBLIC_OPEN_API_URL="${NEXT_PUBLIC_OPEN_API_URL:-http://localhost:8080}"
export NEXT_PUBLIC_LITE_API_URL="${NEXT_PUBLIC_LITE_API_URL:-http://localhost:8082}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "  AEL Dashboard"
echo "  Open API: $NEXT_PUBLIC_OPEN_API_URL"
echo "  Lite API: $NEXT_PUBLIC_LITE_API_URL"
echo ""

npm run dev
