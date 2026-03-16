# Railway Configuration Guide

## Overview

The XPS Lead Intelligence platform runs on [Railway](https://railway.app) as two services inside a single project:

| Service      | Port | Description               |
|--------------|------|---------------------------|
| `backend`    | 4000 | Express.js + Prisma + Redis |
| `frontend`   | 3000 | Next.js 15 App Router     |

The Railway project ID is `0361239a-54f7-4db8-8350-d7931d2b9260` (Lead Intelligence).

---

## Project Structure

```
Railway Project: Lead Intelligence
├── Service: backend        (Express API, port 4000)
├── Service: frontend       (Next.js, port 3000)
├── Service: Postgres       (managed PostgreSQL)
└── Service: Redis          (managed Redis)
```

Railway auto-provides `DATABASE_URL` and `REDIS_URL` when Postgres/Redis services are linked to the backend service.

---

## Required Environment Variables

### Backend Service (`backend/`)

| Variable                    | Required | Description |
|-----------------------------|----------|-------------|
| `DATABASE_URL`              | ✅ Yes   | Railway Postgres connection string (auto-set) |
| `REDIS_URL`                 | ✅ Yes   | Railway Redis connection string (auto-set) |
| `JWT_SECRET`                | ✅ Yes   | Min 32-char random string: `openssl rand -base64 32` |
| `GROQ_API_KEY`              | ✅ Yes   | Groq API key from [console.groq.com](https://console.groq.com) |
| `NODE_ENV`                  | ✅ Yes   | `production` |
| `BACKEND_URL`               | ✅ Yes   | `https://<backend>.railway.app` |
| `FRONTEND_URL`              | ✅ Yes   | `https://<frontend>.railway.app` |
| `GOOGLE_CLIENT_ID`          | ⚠️ OAuth | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET`      | ⚠️ OAuth | Google OAuth2 client secret |
| `GITHUB_OAUTH_CLIENT_ID`    | ⚠️ OAuth | GitHub OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET`| ⚠️ OAuth | GitHub OAuth App client secret |

### Frontend Service (`frontend/`)

| Variable                | Required | Description |
|-------------------------|----------|-------------|
| `NEXT_PUBLIC_API_URL`   | ✅ Yes   | `https://<backend>.railway.app` |
| `NODE_ENV`              | ✅ Yes   | `production` |

---

## GitHub Secrets Required

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret                  | Description |
|-------------------------|-------------|
| `RAILWAY_TOKEN`         | Railway API token (Settings → Tokens in Railway dashboard) |
| `RAILWAY_PROJECT_ID`    | `0361239a-54f7-4db8-8350-d7931d2b9260` |
| `RAILWAY_SERVICE_ID`    | (Optional) Railway service ID for targeted deploys |
| `BACKEND_URL`           | Production backend URL (e.g., `https://backend.railway.app`) |
| `NEXT_PUBLIC_API_URL`   | Same as `BACKEND_URL` (used during frontend build) |

### GitHub Environment Secrets

Configure environment-scoped secrets in **GitHub → Settings → Environments**:

**`staging` environment:**
| Secret                   | Description |
|--------------------------|-------------|
| `RAILWAY_TOKEN`          | Railway API token |
| `RAILWAY_PROJECT_ID`     | Railway project ID |
| `STAGING_BACKEND_URL`    | Staging backend URL |

**`production` environment:**
| Secret                   | Description |
|--------------------------|-------------|
| `RAILWAY_TOKEN`          | Railway API token |
| `RAILWAY_PROJECT_ID`     | Railway project ID |
| `BACKEND_URL`            | Production backend URL |

---

## Railway CLI Usage

### Installation

```bash
npm install -g @railway/cli
```

### Authentication

```bash
# Authenticate interactively
railway login

# Authenticate with token (CI use)
railway login --token $RAILWAY_TOKEN
```

### Deployment Commands

```bash
# Deploy current directory to a service
railway up --service backend

# Deploy detached (non-blocking, returns immediately)
railway up --service backend --detach

# Deploy with explicit project
railway up --service backend --project 0361239a-54f7-4db8-8350-d7931d2b9260

# Trigger a redeploy without code changes
railway redeploy --service backend
```

### Logs and Status

```bash
# Stream live logs
railway logs --service backend

# View deployment history
railway status

# View environment variables
railway variables
```

### Rollback

```bash
# Redeploy from the previous build
railway rollback --service backend
```

---

## Service Configuration (`railway.toml`)

```toml
[build]
builder = "nixpacks"

[deploy]
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

See `railway.toml` at the repository root for current settings.

---

## First-Time Setup

1. **Create Railway project** (or use existing Lead Intelligence project)
2. **Add Postgres and Redis** services from the Railway template marketplace
3. **Create backend service**: set source root to `backend/`
4. **Create frontend service**: set source root to `frontend/`
5. **Link Postgres and Redis** to the backend service (Railway auto-injects URLs)
6. **Set environment variables** as listed above
7. **Get Railway Token**: Railway dashboard → Account → Settings → Tokens → Create
8. **Add secrets to GitHub** (see table above)
9. **Push to main** to trigger first deployment

---

## Staging vs Production

| Aspect         | Staging                             | Production                           |
|----------------|-------------------------------------|--------------------------------------|
| Trigger        | Pull request open/update            | Push to `main`                       |
| Environment    | `staging` GitHub environment        | `production` GitHub environment      |
| Database       | Staging Railway Postgres instance   | Production Railway Postgres instance |
| Auto-deploy    | Yes (on PR)                         | Yes (on merge)                       |
| Auto-merge     | Yes (after smoke tests pass)        | N/A                                  |

---

## Troubleshooting

### Deployment fails immediately
- Check `RAILWAY_TOKEN` is valid and not expired
- Verify `RAILWAY_PROJECT_ID` is correct
- Check Railway service logs: `railway logs --service backend`

### Backend returns 500 after deploy
- Confirm `DATABASE_URL` is set and Postgres is running
- Run migrations: `railway run npx prisma migrate deploy --service backend`
- Check for TypeScript compilation errors in build output

### Frontend shows "Cannot reach API"
- Verify `NEXT_PUBLIC_API_URL` matches the backend Railway URL
- Confirm backend health: `curl https://<backend>.railway.app/api/health`
