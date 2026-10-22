#!/usr/bin/env bash
# Sobe backend (porta 8000) e frontend (porta 3000) juntos. Ctrl+C encerra os dois.
# Uso: ./scripts/dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -x "$ROOT/backend/venv/bin/uvicorn" ] && [ -d "$ROOT/frontend/node_modules" ] \
  || { echo "Dependências não instaladas. Rode antes: ./scripts/setup.sh" >&2; exit 1; }

BACKEND_PID=""
cleanup() {
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend:  http://localhost:8000  (docs: http://localhost:8000/docs)"
echo "Frontend: http://localhost:3000"
echo

(cd "$ROOT/backend" && exec ./venv/bin/uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

cd "$ROOT/frontend"
npm run dev
