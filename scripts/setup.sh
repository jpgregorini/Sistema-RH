#!/usr/bin/env bash
# Instala tudo o que o Sistema RH precisa para rodar localmente (macOS/Linux).
# Uso: ./scripts/setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "ERRO: $*" >&2; exit 1; }

# --- Pré-requisitos ---------------------------------------------------------
PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
      PYTHON="$candidate"
      break
    fi
  fi
done
[ -n "$PYTHON" ] || die "Python 3.11+ não encontrado. No Mac: brew install python"

command -v node >/dev/null 2>&1 || die "Node.js não encontrado. No Mac: brew install node"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>18||(a===18&&b>=18)?0:1)' \
  || die "Node 18.18+ é necessário (encontrado $(node --version)). No Mac: brew upgrade node"
command -v npm >/dev/null 2>&1 || die "npm não encontrado."

echo "Usando $($PYTHON --version) e Node $(node --version)"

# --- Backend ----------------------------------------------------------------
echo
echo "==> Backend: criando venv e instalando dependências"
cd "$ROOT/backend"
[ -d venv ] || "$PYTHON" -m venv venv
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo "    backend/.env criado a partir de .env.example"
else
  echo "    backend/.env já existe, mantido"
fi

# --- Frontend ---------------------------------------------------------------
echo
echo "==> Frontend: instalando dependências (npm install)"
cd "$ROOT/frontend"
npm install --no-audit --no-fund

if [ ! -f .env.local ]; then
  # Valores de exemplo só para o app abrir sem banco. Troque pelos reais
  # quando for usar o Supabase (login e dados não funcionam com estes).
  cat > .env.local <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
ENVEOF
  echo "    frontend/.env.local criado com valores de exemplo (sem banco)"
else
  echo "    frontend/.env.local já existe, mantido"
fi

echo
echo "Pronto! Para iniciar o sistema: ./scripts/dev.sh"
