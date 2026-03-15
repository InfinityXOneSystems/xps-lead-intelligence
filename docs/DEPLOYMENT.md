# Deployment Guide

## Overview

The system deploys as two services on Railway:
- **Backend**: Express.js API on port 4000
- **Frontend**: Next.js app on port 3000

GitHub is the source of truth. Push to `main` triggers CI, then deploys to Railway.

## Quick Deploy (First Time)

### 1. Fork or Clone the Repository
```bash
git clone https://github.com/InfinityXOneSystems/xps-lead-intelligence
cd xps-lead-intelligence
```

### 2. Set Up Railway Project
1. Log into [railway.app](https://railway.app)
2. Create a new project
3. Add two services: **backend** and **frontend**
4. Add a **PostgreSQL** database service
5. Add a **Redis** service

### 3. Configure Railway Environment Variables

For the **backend** service, add:
```
DATABASE_URL=<from Railway postgres service>
REDIS_URL=<from Railway redis service>
JWT_SECRET=<generate: openssl rand -base64 32>
GROQ_API_KEY=<from console.groq.com (free tier)>
BACKEND_URL=https://<backend-service>.railway.app
FRONTEND_URL=https://<frontend-service>.railway.app
NODE_ENV=production

# OAuth (configure AFTER getting callback URLs)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GITHUB_OAUTH_CLIENT_ID=<from GitHub OAuth App>
GITHUB_OAUTH_CLIENT_SECRET=<from GitHub OAuth App>
```

For the **frontend** service, add:
```
NEXT_PUBLIC_API_URL=https://<backend-service>.railway.app
NODE_ENV=production
```

### 4. Set Up GitHub Secrets
In your GitHub repository → Settings → Secrets:
```
RAILWAY_TOKEN=<from railway.app/account/tokens>
NEXT_PUBLIC_API_URL=https://<backend-service>.railway.app
```

### 5. Deploy
Push to `main`:
```bash
git push origin main
```

CI will run and deploy automatically if all checks pass.

## Setting Up OAuth

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project
3. Enable **Google OAuth2 API**, **Gmail API**, **Google Sheets API**, **Google Calendar API**
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://<backend>.railway.app/api/auth/google/callback`
6. Copy **Client ID** and **Client Secret** to Railway env vars

### GitHub OAuth App
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set callback URL: `https://<backend>.railway.app/api/auth/github/callback`
4. Copy **Client ID** and generate **Client Secret**
5. Add to Railway env vars

### Railway Account
1. Go to [railway.app/account/tokens](https://railway.app/account/tokens)
2. Create a new token
3. In the app Settings → Accounts → Railway, paste the token

## Local Development

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL + Redis)

### Start Services
```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Install dependencies
cd backend && npm ci
cd frontend && npm ci

# Set up backend env
cp .env.example backend/.env
# Edit backend/.env with your values

# Run migrations
cd backend && npx prisma migrate dev

# Start backend (port 4000)
cd backend && npm run dev

# Start frontend (port 3000)
cd frontend && npm run dev
```

Visit `http://localhost:3000`.

## Database Migrations

```bash
# Create new migration after schema change
cd backend
npx prisma migrate dev --name <descriptive-name>

# Deploy migrations (production, CI)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Health Checks

- Backend health: `GET /api/health`
- Deep integration check: `GET /api/outreach/health/deep`
- Scheduled checks: GitHub Actions runs every 6 hours

## Rollback

```bash
# Roll back last deployment on Railway
railway rollback --service backend
railway rollback --service frontend
```

## Environment Variable Reference

See `.env.example` for all variables with descriptions.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `GROQ_API_KEY` | ✅ | Groq LLM API key |
| `REDIS_URL` | Optional | Redis URL (graceful degradation if missing) |
| `BACKEND_URL` | ✅ | Public backend URL (for OAuth callbacks) |
| `FRONTEND_URL` | ✅ | Public frontend URL (for OAuth redirects) |
| `GOOGLE_CLIENT_ID` | Optional | Enable Google login + Gmail/Sheets |
| `GOOGLE_CLIENT_SECRET` | Optional | Enable Google login + Gmail/Sheets |
| `GITHUB_OAUTH_CLIENT_ID` | Optional | Enable GitHub login |
| `GITHUB_OAUTH_CLIENT_SECRET` | Optional | Enable GitHub login |
