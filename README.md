# Sistema RH

Backend em FastAPI (`backend/`) e frontend em Next.js (`frontend/`), com Supabase como banco, autenticação e storage.

## Rodar localmente (macOS)

Pré-requisitos: Python 3.11+ e Node 18.18+ (`brew install python node`).

```bash
./scripts/setup.sh   # instala dependências e cria os arquivos .env (uma vez)
./scripts/dev.sh     # sobe backend e frontend
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (documentação em `/docs`, health em `/api/health`)

Ctrl+C encerra os dois.

## Sem banco de dados

O `setup.sh` cria `frontend/.env.local` com valores de exemplo para o app abrir sem Supabase. Nesse modo a tela de login aparece, mas não é possível entrar nem salvar dados.

## Conectando ao Supabase

1. Aplique as migrations de `supabase/migrations/` (`001` a `013`, em ordem).
2. Crie os buckets públicos `documents` e `contracts` em Storage.
3. Crie um usuário (email e senha) em Authentication.
4. Edite `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role) e, para os recursos de IA, `ANTHROPIC_API_KEY`.
5. Edite `frontend/.env.local`: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

A `service_role key` só vai no backend; nunca no frontend nem no git.
