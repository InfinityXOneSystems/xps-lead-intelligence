# Deployment Flow

## Pipeline Architecture

The full CI/CD pipeline executes in the following order:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PULL REQUEST FLOW                            │
│                                                                     │
│  PR opened / updated                                                │
│         │                                                           │
│         ├──── ci.yml ──────────────────────────────────────────┐   │
│         │     ├─ Lint (ESLint backend + frontend)              │   │
│         │     ├─ TypeScript (tsc --noEmit)                     │   │
│         │     ├─ Unit Tests (111 tests, --forceExit)           │   │
│         │     └─ Build (backend dist + Next.js)                │   │
│         │                                                       │   │
│         └──── validator.yml ──────────────────────────────────┤   │
│               ├─ Validate TypeScript                           │   │
│               ├─ Validate Kernel runtime tests                 │   │
│               ├─ Validate Worker system tests                  │   │
│               ├─ Validate full test suite (111 tests)          │   │
│               ├─ Validate Prisma schema                        │   │
│               ├─ Validate required service files               │   │
│               ├─ Validate API route files                      │   │
│               └─ Validate governance documentation             │   │
│                                                                 │   │
│         Both pass ◄─────────────────────────────────────────────┘  │
│              │                                                      │
│              ▼                                                      │
│  deploy-staging.yml                                                 │
│         ├─ gate: Wait for CI + Validator (polls GitHub API)         │
│         ├─ Install Railway CLI                                      │
│         ├─ Authenticate Railway (RAILWAY_TOKEN)                     │
│         ├─ railway up --service backend (staging)                   │
│         ├─ railway up --service frontend (staging)                  │
│         ├─ Wait for staging to become ready                         │
│         ├─ Smoke Test: API health                                   │
│         ├─ Smoke Test: Kernel readiness                             │
│         ├─ Smoke Test: Worker queue (deep check)                    │
│         └─ Smoke Test: LLM connectivity                             │
│                                                                     │
│         Staging passed ──► AUTO-MERGE PR (squash + delete branch)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION FLOW                               │
│                                                                     │
│  Push to main (via auto-merge or direct push)                       │
│         │                                                           │
│         ├──── deploy-production.yml ──────────────────────────┐   │
│         │     ├─ Install Railway CLI                           │   │
│         │     ├─ Authenticate Railway (RAILWAY_TOKEN)          │   │
│         │     ├─ railway up --service backend (production)     │   │
│         │     ├─ railway up --service frontend (production)    │   │
│         │     ├─ Wait for production to become ready           │   │
│         │     ├─ Production health verification                │   │
│         │     └─ Production deep integration check             │   │
│         │                                                       │   │
│         └──── deploy-verification.yml (triggered by workflow_run)  │
│               ├─ API health check (5 retries)                  │   │
│               ├─ Deep integration check                        │   │
│               ├─ Database connectivity check                   │   │
│               └─ Connector status check                        │   │
│                                                                 │   │
│         All pass ◄─────────────────────────────────────────────┘  │
│              │                                                      │
│              ▼                                                      │
│         ✅ DEPLOYMENT COMPLETE                                       │
│                                                                     │
│         Any failure ──► Pipeline halts, deployment marked failed   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Files

| File                              | Trigger              | Environment  | Purpose |
|-----------------------------------|----------------------|--------------|---------|
| `.github/workflows/ci.yml`        | `pull_request`, push | —            | Lint + TypeScript + 111 tests + build |
| `.github/workflows/validator.yml` | `pull_request`       | —            | Runtime layer validation (status: "Validator") |
| `.github/workflows/deploy-staging.yml` | `pull_request`  | `staging`    | Railway staging deploy + smoke tests + auto-merge |
| `.github/workflows/deploy-production.yml` | push `main`  | `production` | Railway production deploy + health check |
| `.github/workflows/deploy-verification.yml` | `workflow_run` | — | Post-deploy deep verification |
| `.github/workflows/deploy.yml`    | push `main`          | —            | Legacy CI/CD pipeline (preserved) |
| `.github/workflows/health-check.yml` | schedule (6h)    | —            | Recurring health monitoring |

---

## CI Status Checks (Branch Protection)

The following checks must pass before a PR can merge to `main`:

| Check Name    | Workflow          | Blocks merge if failing |
|---------------|-------------------|------------------------|
| `Lint`        | `ci.yml`          | ✅ Yes |
| `TypeScript`  | `ci.yml`          | ✅ Yes |
| `Unit Tests`  | `ci.yml`          | ✅ Yes |
| `Build`       | `ci.yml`          | ✅ Yes |
| `Validator`   | `validator.yml`   | ✅ Yes |

---

## Validator Details

The `Validator` status check (`validator.yml`) validates the platform runtime before any deployment:

1. **TypeScript compilation** — `npx tsc --noEmit` — zero errors required
2. **ESLint** — `npm run lint` — zero errors required (warnings OK)
3. **Kernel runtime tests** — runs kernel test suite (37 tests)
4. **Worker system tests** — runs worker test suite (24 tests)
5. **Full test suite** — all 111 tests must pass
6. **Database schema** — `npx prisma validate`
7. **Required service files** — checks kernel.ts, worker.ts, ccp.ts, orchestrator.ts, etc.
8. **API route files** — verifies all 10 route files exist
9. **Governance documentation** — checks required doc files exist

---

## Auto-Merge Logic

Auto-merge is triggered by `deploy-staging.yml` after:

1. The `gate` job confirms CI checks (`Lint`, `TypeScript`, `Unit Tests`, `Build`, `Validator`) all have `success` conclusion
2. Railway staging deployment completes successfully
3. All smoke tests pass

Merge command:
```bash
gh pr merge <number> --squash --delete-branch
```

Falls back to `--auto` if branch protection prevents immediate merge.

> **Requirement**: Repository Settings → General → "Allow auto-merge" must be enabled.

---

## Railway Service Configuration

### Backend

```toml
[build]
builder = "nixpacks"
buildCommand = "npm ci && npx prisma generate && npm run build"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
healthcheckPath = "/api/health"
healthcheckTimeout = 30
```

### Frontend

```toml
[build]
builder = "nixpacks"
buildCommand = "npm ci && npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

---

## Rollback Procedures

### Immediate Rollback (Railway CLI)

```bash
# Install CLI
npm install -g @railway/cli
railway login --token $RAILWAY_TOKEN

# Rollback backend to previous deployment
railway rollback --service backend --project 0361239a-54f7-4db8-8350-d7931d2b9260

# Rollback frontend
railway rollback --service frontend --project 0361239a-54f7-4db8-8350-d7931d2b9260
```

### Git Revert Rollback

```bash
git revert HEAD --no-edit
git push origin main
# deploy-production.yml will automatically deploy the reverted code
```

### Manual Re-deploy Previous Version

```bash
git checkout <previous-good-sha>
git checkout -b hotfix/rollback
git push origin hotfix/rollback
# Open a PR — it will go through the full pipeline before merging
```

---

## Environment Variables Quick Reference

See [RAILWAY.md](RAILWAY.md) for the complete environment variable reference.

### Minimum Required for Deployment

```bash
# GitHub Secrets (repository level)
RAILWAY_TOKEN=<token>
RAILWAY_PROJECT_ID=0361239a-54f7-4db8-8350-d7931d2b9260
BACKEND_URL=https://<backend>.railway.app
NEXT_PUBLIC_API_URL=https://<backend>.railway.app

# GitHub Environment: staging
STAGING_BACKEND_URL=https://<backend-staging>.railway.app

# Railway backend service
DATABASE_URL=<postgres connection string>
REDIS_URL=<redis connection string>
JWT_SECRET=<min 32 char random string>
GROQ_API_KEY=<groq api key>
NODE_ENV=production
BACKEND_URL=https://<backend>.railway.app
FRONTEND_URL=https://<frontend>.railway.app
```

---

## Failure Handling

| Failure Point                 | Result                                   | Recovery |
|-------------------------------|------------------------------------------|----------|
| CI (lint/test) fails          | PR blocked — no staging deploy           | Fix code + push |
| Validator fails               | PR blocked — no staging deploy           | Fix validation issues + push |
| Staging deploy fails          | PR not merged — staging halted           | Check Railway logs + fix |
| Staging smoke test fails      | PR not merged                            | Check staging URL + logs |
| Production deploy fails       | deploy-production.yml exits with error   | Manual Railway rollback |
| Production health check fails | deploy-production.yml fails              | `railway rollback` or git revert |
| Deploy verification fails     | Separate workflow fails (non-blocking)   | Check BACKEND_URL secret + Railway logs |
