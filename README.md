# XPS Lead Intelligence Platform

A full-stack AI-powered lead intelligence platform with autonomous agent capabilities.

## Architecture

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **LLM**: Groq (llama3-8b-8192)
- **E2E Tests**: Playwright

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Local Development

1. Clone the repository
2. Copy environment variables: `cp .env.example .env`
3. Fill in your API keys in `.env`
4. Start services: `docker-compose up -d postgres redis`
5. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
6. Run migrations: `cd backend && npx prisma migrate dev`
7. Start backend: `cd backend && npm run dev`
8. Start frontend: `cd frontend && npm run dev`

### Docker (Full Stack)
```bash
docker-compose up
```

## Features

- 3-column layout with dark/light mode
- Autonomous AI agent chat interface (powered by Groq)
- Lead management and scraping
- Universal connectors (GitHub, Railway, GPT, Google, XPS)
- Admin configuration panel

## Deployment

Deployed on [Railway](https://railway.app) — push to `main` triggers the full CI/CD pipeline automatically.

| | |
|---|---|
| **Project** | Lead Intelligence |
| **Project ID** | `0361239a-54f7-4db8-8350-d7931d2b9260` |
| **Dashboard** | https://railway.app/project/0361239a-54f7-4db8-8350-d7931d2b9260 |
| **Services** | `backend` (Express API) · `frontend` (Next.js) · `postgres` · `redis` |

### Required GitHub Secrets

Set these in your repository's **Settings → Secrets → Actions**:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token (from Railway dashboard → Account Settings) |
| `NEXT_PUBLIC_API_URL` | Public URL of the deployed backend service |
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Railway Postgres plugin) |
| `REDIS_URL` | Redis connection string (auto-set by Railway Redis plugin) |
| `GROQ_API_KEY` | Groq API key for LLM |
| `JWT_SECRET` | Random secret for JWT signing |

### Manual Deploy via Railway CLI
```bash
npm install -g @railway/cli
railway login
railway link 0361239a-54f7-4db8-8350-d7931d2b9260
railway up --service backend
railway up --service frontend
```
