---
applyTo: ".github/**,railway.toml,docker-compose.yml,Dockerfile*"
---
# Infrastructure Instructions

## Deployment Architecture
- **GitHub** is the source of truth
- **Railway** is the runtime (two services: `backend` and `frontend`)
- CI/CD is defined in `.github/workflows/deploy.yml`
- Deploy only triggers on push to `main` AND if `RAILWAY_TOKEN` secret is set

## CI/CD Pipeline
Stages run in order:
1. `lint` — ESLint for backend + frontend (0 errors required)
2. `typecheck` — `tsc --noEmit` for backend
3. `test` — Jest unit tests (50/50 must pass)
4. `build` — Production build of backend + frontend
5. `e2e` — Playwright E2E (only on push to main)
6. `deploy` — Railway deployment (only on push to main, only if RAILWAY_TOKEN is set)

## Required GitHub Secrets
```
RAILWAY_TOKEN         Railway API token for deployment
NEXT_PUBLIC_API_URL   Backend URL (e.g. https://backend.railway.app)
```

## Railway Configuration (`railway.toml`)
- Backend: source `backend/`, start `npm start`, port 4000
- Frontend: source `frontend/`, start `npm start`, port 3000
- Both use nixpacks builder
- Both restart on failure (max 3 retries)

## Required Railway Environment Variables
```
DATABASE_URL            PostgreSQL connection string (Railway provides this)
REDIS_URL               Redis connection string (Railway provides this)
JWT_SECRET              Strong random string (min 32 chars)
GROQ_API_KEY            Groq LLM API key
BACKEND_URL             Public backend URL (set after first deploy)
FRONTEND_URL            Public frontend URL (set after first deploy)
GOOGLE_CLIENT_ID        Google OAuth app client ID
GOOGLE_CLIENT_SECRET    Google OAuth app client secret
GITHUB_OAUTH_CLIENT_ID  GitHub OAuth app client ID
GITHUB_OAUTH_CLIENT_SECRET  GitHub OAuth app client secret
```

## Local Development
```bash
# Start services
docker-compose up -d   # Postgres + Redis

# Backend
cd backend && cp ../.env.example .env
# Edit .env with your values
npm run dev

# Frontend
cd frontend && npm run dev
```

## Prisma Migrations
- Schema: `backend/prisma/schema.prisma`
- Create migration: `cd backend && npx prisma migrate dev --name <name>`
- Deploy migration: `cd backend && npx prisma migrate deploy` (runs in CI)
- Regenerate client: `cd backend && npx prisma generate`

## Health Checks
- Backend: `GET /api/health` → `{ status: 'ok', ... }`
- Scheduled health check: `.github/workflows/health-check.yml` (every 6 hours)
