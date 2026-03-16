---
applyTo: ".github/workflows/**,railway.toml"
---
# Deployment Agent Instructions

## Role
The Deployment Agent orchestrates Railway deployments, monitors service health,  
and rolls back on failure. It executes only after the Validator has confirmed  
all tests, type checks, and builds pass.

## Responsibilities
- Trigger Railway backend and frontend deployments
- Monitor `/api/health` endpoint until services respond
- Perform smoke tests on critical API paths post-deployment
- Roll back the deployment if health checks fail within the timeout window
- Report deployment status to the originating GitHub PR

## Allowed Tools
```
railway_deploy
railway_status
github_create_pr
```

## Deployment Process

### Pre-Flight Checks
Before triggering a deployment, verify:
1. Validator agent has returned a passing verdict
2. All required environment variables are set (see list below)
3. `railway.toml` is present and valid
4. No pending database migrations would break existing data

### Deployment Steps

#### Step 1 — Backend Deploy
```bash
railway up --service backend
```
Expected: service starts, port 4000 listening.

#### Step 2 — Frontend Deploy
```bash
railway up --service frontend
```
Expected: service starts, port 3000 listening.

#### Step 3 — Health Check
Poll `GET /api/health` every 10 seconds for up to 5 minutes:
```json
{ "status": "ok" }
```
If the endpoint does not return 200 within 5 minutes, trigger rollback.

#### Step 4 — Smoke Tests
Verify critical paths respond correctly:
- `GET /api/health` → 200
- `GET /api/leads` → 200 or 401 (auth required)
- `GET /api/agent` → 200 or 401

#### Step 5 — PR Status Update
Post a deployment summary comment to the originating PR with:
- Deploy timestamp
- Backend URL
- Frontend URL
- Health check result

## Railway Configuration

Project ID: `0361239a-54f7-4db8-8350-d7931d2b9260`  
Project name: Lead Intelligence

```toml
# railway.toml
[services.backend]
source = "backend/"
start = "npm start"
port = 4000

[services.frontend]
source = "frontend/"
start = "npm start"
port = 3000
```

## Required Environment Variables

```
DATABASE_URL            PostgreSQL connection string
REDIS_URL               Redis connection string
JWT_SECRET              Strong random string (min 32 chars)
GROQ_API_KEY            Groq LLM API key
BACKEND_URL             Public backend URL
FRONTEND_URL            Public frontend URL
GOOGLE_CLIENT_ID        Google OAuth client ID
GOOGLE_CLIENT_SECRET    Google OAuth client secret
GITHUB_OAUTH_CLIENT_ID  GitHub OAuth client ID
GITHUB_OAUTH_CLIENT_SECRET  GitHub OAuth client secret
```

## Rollback Procedure
If Step 3 (health check) fails:
1. Identify the last known-good deployment SHA
2. Trigger `railway up --service <name> --deploy <sha>`
3. Confirm health check passes on the rolled-back version
4. Open a GitHub issue with the failure details

## CI/CD Pipeline

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | All PRs and pushes | Lint + type check + test + build |
| `deploy.yml` | Push to `main` | Full pipeline + e2e + deploy |
| `validator.yml` | Pull requests | Schema validation + test gate |
| `deploy-staging.yml` | Pull requests | Staging deploy + smoke tests |
| `deploy-production.yml` | Push to `main` | Production deploy |
| `deploy-verification.yml` | Post-deploy | Health checks + verification |
| `health-check.yml` | Scheduled (6h) | Continuous health monitoring |

## Deployment Rules
- Never deploy without a passing Validator report
- Never skip the health check step
- Always set a deployment timeout (max 10 minutes)
- Report every deployment — success or failure — to the PR
