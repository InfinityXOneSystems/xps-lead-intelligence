# TAP Protocol: Policy > Authority > Truth
# Railway Setup Guide — single source of truth for provisioning xps-lead-intelligence on Railway.
# Secrets must be supplied via GitHub Secrets — never committed to the repository.

# Railway Infrastructure Setup Guide

This document describes how to provision the full Railway infrastructure for **xps-lead-intelligence** (Postgres, Redis, backend, and frontend services) and how to configure the required GitHub Secrets for CI/CD workflows.

---

## Overview

The provisioning flow creates or verifies the following Railway resources:

| Resource | Type | Railway Name |
|----------|------|-------------|
| Database | PostgreSQL plugin | `Postgres-rF1T` |
| Cache | Redis plugin | `Redis-rF1T` |
| API server | Service (source: `backend/`) | `backend` |
| Web app | Service (source: `frontend/`) | `frontend` |

---

## Required GitHub Secrets

Before running any CI/CD workflow, create these secrets in GitHub:

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Purpose | How to obtain |
|-------------|---------|---------------|
| `RAILWAY_TOKEN` | Railway API authentication | [railway.app/account/tokens](https://railway.app/account/tokens) |
| `RAILWAY_PROJECT_ID` | Railway project UUID | Provisioning script output or Railway dashboard URL |
| `VALIDATOR_DATABASE_URL` | Real Postgres URL for CI Validator job | See [Railway variable mapping](#railway-variable-mapping) below |
| `VALIDATOR_REDIS_URL` | Real Redis URL for CI Validator job | See [Railway variable mapping](#railway-variable-mapping) below |
| `BACKEND_URL` | Public HTTPS URL of deployed backend | Railway dashboard → backend service → Settings → Public URL |
| `FRONTEND_URL` | Public HTTPS URL of deployed frontend | Railway dashboard → frontend service → Settings → Public URL |
| `NEXT_PUBLIC_API_URL` | Frontend env var pointing to backend | Same value as `BACKEND_URL` |
| `JWT_SECRET` | JWT signing secret | `openssl rand -base64 32` |
| `GROQ_API_KEY` | Groq AI inference API key | [console.groq.com](https://console.groq.com) |

> **Security note:** Never commit any of these values to the repository. All secrets must remain in GitHub Secrets or the Railway dashboard.

---

## Railway Variable Mapping

Railway supports internal variable references. When you create a service variable with this syntax, Railway injects the actual value at runtime:

```
${Postgres-rF1T.DATABASE_URL}
```

### How to copy Railway variables to GitHub Secrets

1. Open [Railway dashboard](https://railway.app) → your project
2. Click on the **Postgres-rF1T** service → **Variables** tab
3. Find `DATABASE_URL` — click the copy icon to copy the actual connection string
4. Open GitHub → Settings → Secrets and variables → Actions
5. Create secret `VALIDATOR_DATABASE_URL` and paste the connection string

Repeat for Redis:
- Railway: **Redis-rF1T** service → Variables → `REDIS_URL` → copy value
- GitHub secret name: `VALIDATOR_REDIS_URL`

### Railway backend service variable setup

In the Railway dashboard, set the following variables on the **backend** service:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${Postgres-rF1T.DATABASE_URL}` |
| `REDIS_URL` | `${Redis-rF1T.REDIS_URL}` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | _(paste from your GitHub secret — no Railway reference)_ |
| `GROQ_API_KEY` | _(paste from your Groq dashboard)_ |
| `BACKEND_URL` | `https://<your-backend>.up.railway.app` |
| `FRONTEND_URL` | `https://<your-frontend>.up.railway.app` |

---

## Flow A: Manual Provisioning (local operator)

Use this flow when you have `RAILWAY_TOKEN` available in your shell and want to provision Railway locally.

### Prerequisites

- Node.js 18+ installed
- `npm install -g @railway/cli` (or the script installs it)
- `RAILWAY_TOKEN` set in your environment:
  ```bash
  export RAILWAY_TOKEN="<your-railway-api-token>"
  ```

### Steps

```bash
# 1. Clone the repository (if not already cloned)
git clone https://github.com/InfinityXOneSystems/xps-lead-intelligence.git
cd xps-lead-intelligence

# 2. Set required environment variables
export RAILWAY_TOKEN="<your-railway-api-token>"
export RAILWAY_PROJECT_ID="<your-project-id>"   # optional: set if project already exists

# 3. Optional overrides (defaults shown)
export BACKEND_SERVICE_NAME="backend"
export FRONTEND_SERVICE_NAME="frontend"
export POSTGRES_SERVICE_NAME="Postgres-rF1T"
export REDIS_SERVICE_NAME="Redis-rF1T"

# 4. Make the script executable and run it
chmod +x scripts/railway_provision.sh
./scripts/railway_provision.sh
```

The script will:
1. Ensure the Railway CLI is installed
2. Connect to or create the Railway project
3. Create the Postgres plugin service (if missing)
4. Create the Redis plugin service (if missing)
5. Create the backend and frontend services (if missing)
6. Set backend service variables (DATABASE_URL, REDIS_URL, NODE_ENV)
7. Print the exact GitHub Secrets you need to create

### Creating GitHub Secrets after provisioning

Use the helper script to interactively set all required GitHub Secrets:

```bash
# Requires: gh CLI authenticated
chmod +x scripts/export_github_secret_commands.sh
./scripts/export_github_secret_commands.sh
```

Or set secrets manually with `gh`:

```bash
gh secret set RAILWAY_TOKEN        --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set RAILWAY_PROJECT_ID   --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set VALIDATOR_DATABASE_URL --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set VALIDATOR_REDIS_URL  --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set BACKEND_URL          --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set FRONTEND_URL         --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set NEXT_PUBLIC_API_URL  --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set JWT_SECRET           --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
gh secret set GROQ_API_KEY         --repo InfinityXOneSystems/xps-lead-intelligence --body '<value>'
```

---

## Flow B: GitHub Actions workflow_dispatch

Use this flow to provision Railway from GitHub Actions using the manual trigger.

### Prerequisites

1. `RAILWAY_TOKEN` must be set as a GitHub Secret **before** triggering the workflow:
   - GitHub → repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `RAILWAY_TOKEN`, Value: your Railway API token

### Steps

1. Open **GitHub → Actions → Railway Provisioning** workflow
2. Click **Run workflow**
3. Fill in the inputs:
   - **project_name**: `Lead Intelligence` (or your project name)
   - **backend_service_name**: `backend`
   - **frontend_service_name**: `frontend`
   - **postgres_service_name**: `Postgres-rF1T`
   - **redis_service_name**: `Redis-rF1T`
4. Click **Run workflow**
5. After the workflow completes, open the job summary for the list of GitHub Secrets to create
6. Create those secrets (see [Required GitHub Secrets](#required-github-secrets) table above)

---

## Networking: Internal vs Public Hostnames

Railway services communicate with each other using **private network hostnames** (ending in `.railway.internal`). These are only reachable within Railway's private network.

### Implications for CI/CD

| Runner type | Can reach `*.railway.internal` | Notes |
|-------------|-------------------------------|-------|
| GitHub-hosted (`ubuntu-latest`) | ❌ No | Use Railway **public** hostname for `VALIDATOR_DATABASE_URL` |
| Self-hosted runner inside Railway network | ✅ Yes | Can use internal hostname |

### Option 1: Use Railway public hostname for CI (recommended for GitHub-hosted runners)

In the Railway dashboard:
1. Open the **Postgres-rF1T** service → Settings → **Public networking** → Enable
2. Copy the public hostname (e.g., `postgres-rf1t.railway.app`)
3. Set `VALIDATOR_DATABASE_URL` to the public connection string

### Option 2: Self-hosted runner (for internal hostname access)

To use `postgres-rf1t.railway.internal` from CI:

1. Provision a self-hosted GitHub Actions runner inside Railway's private network (or a VM with Railway VPN access)
2. Register the runner with a label, e.g., `railway-runner`:
   ```bash
   ./config.sh --url https://github.com/InfinityXOneSystems/xps-lead-intelligence \
               --token <runner-registration-token> \
               --labels railway-runner
   ```
3. Update the Validator workflow to use the self-hosted runner:
   ```yaml
   jobs:
     validate:
       runs-on: [self-hosted, railway-runner]
   ```

---

## Testing Connectivity Locally

After obtaining connection strings from Railway, verify connectivity:

```bash
# Test Postgres (use PGPASSWORD env var to avoid password in shell history)
PGPASSWORD="<your-db-password>" psql "postgresql://postgres@<host>:<port>/railway" -c '\l'

# Or using a .pgpass file (recommended — see: https://www.postgresql.org/docs/current/libpq-pgpass.html)
# ~/.pgpass entry: <host>:<port>:railway:postgres:<password>
psql "postgresql://postgres@<host>:<port>/railway" -c '\l'

# Test Redis
redis-cli -u "redis://:<password>@<host>:<port>" ping
```

Expected output:
- Postgres: list of databases
- Redis: `PONG`

---

## Security Notes

- **Never commit secrets.** All credentials must be stored in GitHub Secrets or Railway environment variables.
- **Use a limited-permission CI database user.** Create a dedicated `ci_user` with read/write-only permissions on the CI schema:
  ```sql
  CREATE USER ci_user WITH PASSWORD '<password>';
  GRANT CONNECT ON DATABASE railway TO ci_user;
  GRANT USAGE ON SCHEMA public TO ci_user;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ci_user;
  ```
- **Rotate credentials regularly.** Update GitHub Secrets and Railway variables when rotating.
- **Separate staging and production DB instances.** Do not point CI at the production database.

---

## Pre-merge Checklist

Before merging any deployment-related PR:

- [ ] `RAILWAY_TOKEN` secret is set in GitHub
- [ ] `RAILWAY_PROJECT_ID` secret is set in GitHub
- [ ] `VALIDATOR_DATABASE_URL` secret is set and points to a real DB (not a dummy/mock)
- [ ] `VALIDATOR_REDIS_URL` secret is set and points to a real Redis
- [ ] `JWT_SECRET`, `GROQ_API_KEY` secrets are set
- [ ] `BACKEND_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` are set
- [ ] Provisioning script has been run (Flow A or B) and all services confirmed in Railway dashboard
- [ ] If using GitHub-hosted runners: Railway public hostname is used in `VALIDATOR_DATABASE_URL`
- [ ] If using self-hosted runner: runner is registered and healthy
