#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  SWAT4 — Build & Push images to a Container Registry
#
#  Usage:
#    ./build-push.sh <registry> [tag]
#
#  Examples:
#    ./build-push.sh registry.example.com/swat4
#    ./build-push.sh registry.example.com/swat4 v1.0.0
#    ./build-push.sh ghcr.io/myorg/swat4 latest
#
#  After pushing, on the target host:
#    1. Adjust the image names in docker-compose.yml (and docker-compose.dc.yml,
#       if the DC is the containerized samba-ad-fs stack) to <registry>-backend /
#       <registry>-frontend, or export REGISTRY-style vars you added
#    2. docker login <registry>
#    3. docker compose pull (ou docker compose -f docker-compose.yml -f docker-compose.dc.yml pull)
#    4. docker compose up -d (ou -f docker-compose.yml -f docker-compose.dc.yml up -d)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REGISTRY="${1:-}"
TAG="${2:-latest}"

if [ -z "$REGISTRY" ]; then
  echo "Usage: $0 <registry> [tag]"
  echo ""
  echo "Examples:"
  echo "  $0 registry.example.com/swat4"
  echo "  $0 registry.example.com/swat4 v1.0.0"
  echo "  $0 ghcr.io/myorg/swat4 latest"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo "  SWAT4 — Build & Push"
echo "  Registry : $REGISTRY"
echo "  Tag      : $TAG"
echo "================================================"

# ── Build images ─────────────────────────────────────────────
echo ""
echo "[1/4] Building backend image..."
docker build \
  -t "${REGISTRY}-backend:${TAG}" \
  -t "${REGISTRY}-backend:latest" \
  -f "${SCRIPT_DIR}/backend/Dockerfile" \
  "${SCRIPT_DIR}/backend"

echo ""
echo "[2/4] Building frontend image..."
docker build \
  -t "${REGISTRY}-frontend:${TAG}" \
  -t "${REGISTRY}-frontend:latest" \
  -f "${SCRIPT_DIR}/frontend/Dockerfile" \
  "${SCRIPT_DIR}/frontend"

# ── Push images ──────────────────────────────────────────────
echo ""
echo "[3/4] Pushing backend image..."
docker push "${REGISTRY}-backend:${TAG}"
docker push "${REGISTRY}-backend:latest"

echo ""
echo "[4/4] Pushing frontend image..."
docker push "${REGISTRY}-frontend:${TAG}"
docker push "${REGISTRY}-frontend:latest"

echo ""
echo "================================================"
echo "  Done! Images pushed:"
echo "    ${REGISTRY}-backend:${TAG}"
echo "    ${REGISTRY}-frontend:${TAG}"
echo ""
echo "  Deploy on the target host:"
echo "    1. Aponte as imagens para ${REGISTRY} no docker-compose.yml (e docker-compose.dc.yml se precisar)"
echo "    2. docker login ${REGISTRY%%/*}"
echo "    3. docker compose pull"
echo "    4. docker compose up -d"
echo "    (DC containerizado: docker compose -f docker-compose.yml -f docker-compose.dc.yml pull/up)"
echo "================================================"