# XPS Lead Intelligence — Full Setup Guide

This document answers the question: **"What information do I need to provide to fully set up, test, deploy, launch, and configure the LLM?"**

Everything is grouped by function. Tick each item off as you collect or configure it.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Credentials Checklist](#2-credentials-checklist)
3. [Local Development Setup](#3-local-development-setup)
4. [Railway Deployment Setup](#4-railway-deployment-setup)
5. [GitHub Actions CI/CD Setup](#5-github-actions-cicd-setup)
6. [LLM (Groq) Setup](#6-llm-groq-setup)
7. [Connector Setup](#7-connector-setup)
8. [Running Tests](#8-running-tests)
9. [Quick Reference — All Environment Variables](#9-quick-reference--all-environment-variables)

---

## 1. Prerequisites

Install these tools before starting:

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | bundled with Node |
| Docker Desktop | latest | https://docker.com/products/docker-desktop |
| Railway CLI | latest | `npm install -g @railway/cli` |
| Git | any | https://git-scm.com |

---

## 2. Credentials Checklist

### 🔑 REQUIRED — Platform won't start without these

| # | Credential | Env Var | Where to Get It |
|---|---|---|---|
| 1 | Groq API Key | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) → Create API Key |
| 2 | PostgreSQL URL | `DATABASE_URL` | Railway Postgres plugin (auto-provided) **or** local Docker |
| 3 | Redis URL | `REDIS_URL` | Railway Redis plugin (auto-provided) **or** local Docker |
| 4 | JWT Secret | `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| 5 | Railway Token | `RAILWAY_TOKEN` | [railway.app](https://railway.app) → Account Settings → Tokens → New Token |
| 6 | Backend public URL | `FRONTEND_URL` | Railway backend service URL (e.g. `https://backend-xxx.railway.app`) |
| 7 | Frontend public URL | `NEXT_PUBLIC_API_URL` | Railway frontend service URL (e.g. `https://frontend-xxx.railway.app`) |

### 🔗 OPTIONAL — Required only when using that specific connector

| # | Connector | Credentials Needed | Env Vars | Where to Get |
|---|---|---|---|---|
| 8 | **GitHub** | OAuth Client ID + Secret | `GITHUB_CLIENT_ID` `GITHUB_CLIENT_SECRET` | [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App |
| 9 | **GitHub App** (XPS Orchestrator) | App ID + Private Key (.pem) | `GITHUB_APP_ID` `GITHUB_APP_PRIVATE_KEY` | [github.com/settings/apps](https://github.com/settings/apps) → New GitHub App |
| 10 | **OpenAI / GPT Actions** | API Key | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| 11 | **Google** | OAuth Client ID + Secret | `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID |
| 12 | **XPS Orchestrator** | Service URL + API Key | `XPS_ORCHESTRATOR_URL` `XPS_ORCHESTRATOR_API_KEY` | Your deployed XPS Orchestrator GitHub App settings |

---

## 3. Local Development Setup

### Step 1 — Clone and install dependencies

```bash
git clone https://github.com/InfinityXOneSystems/xps-lead-intelligence
cd xps-lead-intelligence

# Install all dependencies
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
cd e2e      && npm install && cd ..
```

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in **at minimum** items 1–4 from the checklist above. For local dev the database and Redis values are pre-filled to match Docker.

### Step 3 — Start PostgreSQL and Redis

```bash
docker-compose up -d postgres redis
```

Verify they are healthy:

```bash
docker-compose ps
# Both should show "Up" and healthy
```

### Step 4 — Run database migrations

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all tables (`leads`, `scraping_jobs`, `agent_sessions`, `connectors`, `admin_config`).

### Step 5 — Start the backend API

```bash
cd backend
npm run dev
# Running on http://localhost:4000
```

Verify:

```bash
curl http://localhost:4000/api/health
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### Step 6 — Start the frontend

```bash
cd frontend
npm run dev
# Running on http://localhost:3000
```

Open http://localhost:3000 — you should see the 3-column app layout.

### Step 7 — (Optional) Start everything with Docker

```bash
# From repo root — starts postgres, redis, backend, and frontend all at once
docker-compose up
```

---

## 4. Railway Deployment Setup

The Railway project is already created and pre-wired:

| | |
|---|---|
| **Project Name** | Lead Intelligence |
| **Project ID** | `0361239a-54f7-4db8-8350-d7931d2b9260` |
| **Dashboard** | https://railway.app/project/0361239a-54f7-4db8-8350-d7931d2b9260 |

### Step 1 — Log in and link

```bash
railway login
railway link 0361239a-54f7-4db8-8350-d7931d2b9260
```

### Step 2 — Add Postgres plugin

In the Railway dashboard, open the **Lead Intelligence** project:

1. Click **New** → **Database** → **Add PostgreSQL**
2. Railway automatically sets `DATABASE_URL` in all services in the project

### Step 3 — Add Redis plugin

1. Click **New** → **Database** → **Add Redis**
2. Railway automatically sets `REDIS_URL` in all services in the project

### Step 4 — Set environment variables on the backend service

In the Railway dashboard → **backend** service → **Variables** tab, add:

```
GROQ_API_KEY=<your Groq key>
JWT_SECRET=<your generated secret>
FRONTEND_URL=<https://frontend-xxx.railway.app>
NODE_ENV=production
PORT=4000
```

Optional connectors (add the ones you have):

```
OPENAI_API_KEY=<key>
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
GITHUB_APP_ID=<id>
GITHUB_APP_PRIVATE_KEY=<full PEM contents>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
XPS_ORCHESTRATOR_URL=<url>
XPS_ORCHESTRATOR_API_KEY=<key>
```

### Step 5 — Set environment variables on the frontend service

```
NEXT_PUBLIC_API_URL=<https://backend-xxx.railway.app>
NODE_ENV=production
PORT=3000
```

### Step 6 — Run database migrations on Railway

```bash
# From repo root, after linking
railway run --service backend npx prisma migrate deploy
```

### Step 7 — Deploy manually (first time)

```bash
railway up --service backend  --detach --project 0361239a-54f7-4db8-8350-d7931d2b9260
railway up --service frontend --detach --project 0361239a-54f7-4db8-8350-d7931d2b9260
```

After the first deployment, **all future pushes to `main`** trigger automatic re-deployment via GitHub Actions.

---

## 5. GitHub Actions CI/CD Setup

The CI/CD pipeline runs lint → unit tests → E2E tests → build → Railway deploy on every push to `main`.

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** and add each of the following:

### Required Secrets

| Secret Name | Value | Notes |
|---|---|---|
| `RAILWAY_TOKEN` | Your Railway API token | From Railway → Account Settings → Tokens |
| `NEXT_PUBLIC_API_URL` | `https://backend-xxx.railway.app` | The public URL of your Railway backend service |
| `GROQ_API_KEY` | Your Groq API key | Needed for E2E tests that exercise the agent |
| `JWT_SECRET` | 32+ random chars | Same value as your backend |

### Optional Secrets (connector tests)

| Secret Name | Value |
|---|---|
| `OPENAI_API_KEY` | OpenAI key for GPT Actions connector |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `XPS_ORCHESTRATOR_URL` | XPS Orchestrator service URL |
| `XPS_ORCHESTRATOR_API_KEY` | XPS Orchestrator API key |

---

## 6. LLM (Groq) Setup

The platform uses **Groq** as its LLM provider with the **llama3-8b-8192** model.  
Groq is **free** — no credit card required for the free tier.

### Step 1 — Create a Groq account

Go to https://console.groq.com and sign up.

### Step 2 — Generate an API key

1. Log in to https://console.groq.com/keys
2. Click **Create API Key**
3. Give it a name like `xps-lead-intelligence`
4. Copy the key — it starts with `gsk_`

### Step 3 — Set the key

**Local:** Add to `.env`:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Railway:** Add to backend service Variables:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**GitHub Actions:** Add as secret `GROQ_API_KEY`.

### Step 4 — Verify the LLM is working

Once the backend is running:

```bash
curl -X POST http://localhost:4000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you help me with?"}'
```

Expected response:
```json
{
  "sessionId": "...",
  "message": "I can help you with lead intelligence, qualifying leads, analyzing companies..."
}
```

### Available Groq Models

The model can be changed in `backend/src/services/groq.ts`:

| Model | Context | Speed | Notes |
|---|---|---|---|
| `llama3-8b-8192` | 8K | Fastest | **Default** — best for quick agent responses |
| `llama3-70b-8192` | 8K | Medium | Better reasoning, slower |
| `mixtral-8x7b-32768` | 32K | Medium | Larger context window |
| `gemma-7b-it` | 8K | Fast | Good for structured output |

To change the model, update the `processAgentMessage` call in `backend/src/services/orchestrator.ts`:
```ts
const responseText = await chatCompletion(llmMessages, 'llama3-70b-8192');
```

---

## 7. Connector Setup

Each connector in the Admin Settings panel needs its own credentials.

### GitHub OAuth App (for GitHub connector)

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name**: `XPS Lead Intelligence`
   - **Homepage URL**: `https://frontend-xxx.railway.app`
   - **Authorization callback URL**: `https://backend-xxx.railway.app/api/connectors/github/callback`
3. Copy **Client ID** → `GITHUB_CLIENT_ID`
4. Generate a new **Client Secret** → `GITHUB_CLIENT_SECRET`

### GitHub App (XPS Orchestrator integration)

1. Go to https://github.com/settings/apps → **New GitHub App**
2. Fill in the app name, homepage URL, and webhook URL
3. After creation, note the **App ID** → `GITHUB_APP_ID`
4. Generate a **Private Key** (downloads a `.pem` file) → set `GITHUB_APP_PRIVATE_KEY` to the full PEM content

### OpenAI (GPT Actions connector)

1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy → `OPENAI_API_KEY`

### Google OAuth (Google connector)

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add authorized redirect URI: `https://backend-xxx.railway.app/api/connectors/google/callback`
6. Copy **Client ID** → `GOOGLE_CLIENT_ID`
7. Copy **Client Secret** → `GOOGLE_CLIENT_SECRET`

### XPS Orchestrator

1. Deploy your `xps-orchestrator` GitHub App
2. Copy the public URL → `XPS_ORCHESTRATOR_URL`
3. Copy the API key from orchestrator settings → `XPS_ORCHESTRATOR_API_KEY`

---

## 8. Running Tests

### Unit tests (backend)

```bash
cd backend
npm test
```

### Type checking

```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### Linting

```bash
cd backend  && npm run lint
cd frontend && npm run lint
```

### Build verification

```bash
cd backend  && npm run build
cd frontend && npm run build
```

### E2E tests (Playwright)

Requires the frontend running on port 3000 and backend on port 4000.

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd e2e
npx playwright install --with-deps chromium
npx playwright test
npx playwright show-report  # view HTML report
```

### Security audit

```bash
cd frontend && npm audit
cd backend  && npm audit
```

---

## 9. Quick Reference — All Environment Variables

Copy this block into your `.env` file and fill in the values:

```bash
# ── DATABASE ──────────────────────────────────────────────────────────────────
# Local Docker:  postgresql://postgres:password@localhost:5432/xps_leads
# Railway:       auto-provided by Postgres plugin
DATABASE_URL=postgresql://postgres:password@localhost:5432/xps_leads

# ── REDIS ─────────────────────────────────────────────────────────────────────
# Local Docker:  redis://localhost:6379
# Railway:       auto-provided by Redis plugin
REDIS_URL=redis://localhost:6379

# ── LLM ───────────────────────────────────────────────────────────────────────
# Free key from https://console.groq.com/keys  (starts with gsk_)
GROQ_API_KEY=gsk_your_groq_api_key_here

# ── AUTH ──────────────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here

# ── URLS ──────────────────────────────────────────────────────────────────────
# URL of your backend (for CORS allow-list on the backend)
FRONTEND_URL=http://localhost:3000
# URL of your backend (used by the Next.js frontend to call the API)
NEXT_PUBLIC_API_URL=http://localhost:4000

# ── RAILWAY ───────────────────────────────────────────────────────────────────
# Token from: https://railway.app → Account Settings → Tokens
RAILWAY_TOKEN=your_railway_token
# Pre-wired — do not change
RAILWAY_PROJECT_ID=0361239a-54f7-4db8-8350-d7931d2b9260

# ── GITHUB ────────────────────────────────────────────────────────────────────
# OAuth App: https://github.com/settings/developers → OAuth Apps
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
# GitHub App (XPS Orchestrator): https://github.com/settings/apps
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_PRIVATE_KEY=your_github_app_private_key_pem_contents

# ── OPENAI ────────────────────────────────────────────────────────────────────
# https://platform.openai.com/api-keys  (starts with sk-)
OPENAI_API_KEY=sk_your_openai_api_key

# ── GOOGLE ────────────────────────────────────────────────────────────────────
# https://console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ── XPS ORCHESTRATOR ─────────────────────────────────────────────────────────
XPS_ORCHESTRATOR_URL=https://your-orchestrator.example.com
XPS_ORCHESTRATOR_API_KEY=your_xps_orchestrator_api_key

# ── SERVER ────────────────────────────────────────────────────────────────────
PORT=4000
NODE_ENV=development
```

---

## Summary — What to send to Copilot / CI system

To give the system **full capability** to set up, test, deploy, and run the LLM, provide the following values (you can paste them directly into the GitHub Secrets UI or share them to be placed in `.env`):

```
GROQ_API_KEY       ← single most important value (enables the LLM)
DATABASE_URL       ← auto-provided by Railway plugin, or use Docker default
REDIS_URL          ← auto-provided by Railway plugin, or use Docker default
JWT_SECRET         ← generate with: openssl rand -base64 32
RAILWAY_TOKEN      ← from railway.app account settings
FRONTEND_URL       ← deployed frontend URL (for CORS)
NEXT_PUBLIC_API_URL ← deployed backend URL (for frontend API calls)
```

Everything else (GitHub, Google, OpenAI, XPS) is only needed when you want to activate those specific connectors.
