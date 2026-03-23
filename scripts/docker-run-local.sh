#!/usr/bin/env bash
# Sobe a imagem localmente (SQLite se DATABASE_URL não estiver definida).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
IMAGE="${IMAGE:-obra-controle:local}"
PORT_HOST="${PORT_HOST:-8080}"
docker build -t "$IMAGE" .
exec docker run --rm --name obra-controle-local \
  -p "${PORT_HOST}:8000" \
  -e SECRET_KEY="${SECRET_KEY:-dev-local-change-me}" \
  ${DATABASE_URL:+-e DATABASE_URL="$DATABASE_URL"} \
  "$IMAGE"
