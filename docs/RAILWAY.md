# Railway Configuration Guide

This document covers how the application integrates with **Railway** for deployments,
environment variables, and CI/CD secrets.

---

## Project

| Field              | Value                                  |
|--------------------|----------------------------------------|
| Project ID         | `0361239a-54f7-4db8-8350-d7931d2b9260` |
| Project Name       | Lead Intelligence                      |

---

## Services

| Service      | Role                         | Notes                                   |
|--------------|------------------------------|-----------------------------------------|
| `backend`    | Node.js API (Express)        | Listens on `process.env.PORT \|\| 8080` |
| `frontend`   | Next.js frontend             | Listens on `process.env.PORT \|\| 3000` |
| `postgres-rf1t` | Managed PostgreSQL        | Private: `*.railway.internal`, Public: `*.proxy.rlwy.net` |
| Redis        | Cache / job queue            | Auto-linked; `REDIS_URL` auto-injected  |

---

## Railway Variable References

Railway supports **reference variables** that pull a value from a linked service.
To wire `DATABASE_URL` from the Postgres service into the backend service:

1. Open Railway → **backend** service → **Variables** tab.
2. Click **New Variable**.
3. Set:
   - **Key:** `DATABASE_URL`
   - **Value:** `${{Postgres-rF1T.DATABASE_URL}}`  ← Railway reference syntax

This is equivalent to copy-pasting the raw DSN, but automatically updates if the
Postgres credentials rotate.

Similarly for Redis:

- **Key:** `REDIS_URL`
- **Value:** `${{Redis.REDIS_URL}}`

---

## Runtime Variables (backend service)

Set these in Railway → backend → Variables:

| Variable           | Value / Source                             |
|--------------------|--------------------------------------------|
| `DATABASE_URL`     | `${{Postgres-rF1T.DATABASE_URL}}`          |
| `REDIS_URL`        | `${{Redis.REDIS_URL}}`                     |
| `JWT_SECRET`       | Strong random string (generate once)       |
| `GROQ_API_KEY`     | From Groq dashboard                        |
| `NODE_ENV`         | `production`                               |
| `BACKEND_URL`      | Public Railway domain, e.g. `https://backend-xyz.up.railway.app` |
| `FRONTEND_URL`     | Public Railway domain of the frontend      |

---

## GitHub Actions Secrets

The following secrets must be set in **GitHub → Settings → Secrets and variables → Actions**:

| Secret                   | Used by                 | Description |
|--------------------------|-------------------------|-------------|
| `RAILWAY_TOKEN`          | deploy workflows        | Railway CLI auth token |
| `RAILWAY_PROJECT_ID`     | deploy workflows        | `0361239a-54f7-4db8-8350-d7931d2b9260` |
| `BACKEND_URL`            | deploy-production.yml   | Production backend public URL |
| `VALIDATOR_DATABASE_URL` | validator.yml           | PostgreSQL DSN for CI validation — see below |
| `VALIDATOR_REDIS_URL`    | validator.yml (optional) | Redis DSN for CI — see below |
| `VALIDATOR_JWT_SECRET`   | validator.yml (optional) | JWT secret for CI tests |

### VALIDATOR_DATABASE_URL and Railway

The **Validator** CI job connects to the real Railway Postgres service to run
`prisma validate` and integration tests.

**Recommended approach:** create a dedicated CI database user on the Railway Postgres
service with limited permissions (no write / no migration rights), and expose it
via the public proxy (`*.proxy.rlwy.net`) so the GitHub-hosted runner can reach it.

```bash
# Get the public Railway Postgres connection string:
# Railway dashboard → postgres-rf1t → Connect → Public Network → Database URL

# Then set the secret (replace placeholder with the real URL):
gh secret set VALIDATOR_DATABASE_URL \
  --repo InfinityXOneSystems/xps-lead-intelligence \
  --body "postgresql://ci_validator:<password>@<host>.proxy.rlwy.net:<port>/railway?sslmode=require"
```

For full setup instructions, networking guidance, and self-hosted runner configuration,
see **[docs/VALIDATOR_SETUP.md](./VALIDATOR_SETUP.md)**.

---

## Networking Notes

- **Private hostname** (`postgres-rf1t.railway.internal`): only reachable from within
  Railway's private network. GitHub-hosted runners **cannot** reach this host.
- **Public proxy** (`*.proxy.rlwy.net`): reachable from anywhere. Use this for CI.
- If you must use the private hostname from CI, register a self-hosted runner inside
  Railway and update `runs-on` in validator.yml. See `docs/VALIDATOR_SETUP.md`.

---

## Deployment Workflow

Deployments are triggered automatically by Railway when commits are pushed to `main`
(if **Wait for CI** is enabled, deployments only start after all GitHub Actions pass).

For manual deploy via Railway CLI:

```bash
railway up --project 0361239a-54f7-4db8-8350-d7931d2b9260 --service backend
railway up --project 0361239a-54f7-4db8-8350-d7931d2b9260 --service frontend
```
