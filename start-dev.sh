#!/usr/bin/env bash
# Sobe API + interface com um comando (use Ctrl+C para encerrar os dois).
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"
if ! python3 -c "import uvicorn" 2>/dev/null; then
  echo "Instale dependências: cd backend && python3 -m pip install -r requirements.txt"
  exit 1
fi
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
UV_PID=$!
cleanup() { kill "$UV_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
sleep 1
if ! kill -0 "$UV_PID" 2>/dev/null; then
  echo "Falha ao iniciar a API na porta 8000 (porta em uso?)."
  exit 1
fi
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo "Instale o frontend: cd frontend && npm install"
  exit 1
fi
exec npm run dev
