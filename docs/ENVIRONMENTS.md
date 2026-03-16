# Environment Architecture

## Overview

The platform uses two GitHub environments to gate deployments and separate secrets between non-production and production contexts.

```
pull_request ──→ staging   (automatically deployed, auto-merged on pass)
push to main ──→ production (automatically deployed after merge)
```

---

## Environments

### `staging`

| Property            | Value |
|---------------------|-------|
| **Trigger**         | Pull request opened, updated, or reopened |
| **Auto-deploy**     | Yes — runs `deploy-staging.yml` workflow |
| **Auto-merge**      | Yes — merges PR after CI + Validator + smoke tests pass |
| **Required checks** | CI, Validator, Deploy Staging |
| **Database**        | Staging Railway Postgres instance |
| **URL pattern**     | `https://<project>-staging.railway.app` |

#### Staging Environment Secrets

Configure at **GitHub → Settings → Environments → staging**:

| Secret                   | Purpose |
|--------------------------|---------|
| `RAILWAY_TOKEN`          | Railway API token for staging deploys |
| `RAILWAY_PROJECT_ID`     | Railway project ID |
| `STAGING_BACKEND_URL`    | Base URL for staging smoke tests |

#### Staging Deployment Rules

- Deploys ONLY when CI and Validator have passed (enforced by the `gate` job in `deploy-staging.yml`)
- Smoke tests run against `STAGING_BACKEND_URL` after every deploy
- PR is auto-merged only when ALL checks pass (CI + Validator + Deploy Staging)
- Auto-merge is squash-merge with branch deletion

---

### `production`

| Property            | Value |
|---------------------|-------|
| **Trigger**         | Push to `main` (typically via auto-merge from staging) |
| **Auto-deploy**     | Yes — runs `deploy-production.yml` workflow |
| **Post-deploy**     | `deploy-verification.yml` runs automatically |
| **Database**        | Production Railway Postgres instance |
| **URL pattern**     | `https://<project>.railway.app` |

#### Production Environment Secrets

Configure at **GitHub → Settings → Environments → production**:

| Secret                   | Purpose |
|--------------------------|---------|
| `RAILWAY_TOKEN`          | Railway API token for production deploys |
| `RAILWAY_PROJECT_ID`     | Railway project ID |
| `BACKEND_URL`            | Production backend URL (used for health checks) |

#### Production Deployment Rules

- No manual approval gate — fully autonomous
- Deployment stops immediately if health check fails
- `deploy-verification.yml` runs as a separate verification pass
- Rollback available via Railway CLI: `railway rollback --service backend`

---

## Workflow Routing

```
Event                    Workflow                    Environment
─────────────────────────────────────────────────────────────────
pull_request (any)    →  ci.yml                   →  (none)
pull_request (any)    →  validator.yml             →  (none)
pull_request (any)    →  deploy-staging.yml        →  staging
push to main          →  deploy-production.yml     →  production
push to main          →  deploy-verification.yml   →  (none / URL-based)
push to main          →  deploy.yml (legacy)       →  (legacy Railway deploy)
schedule (6h)         →  health-check.yml          →  (none)
```

---

## Branch Protection Ruleset

The `main` branch requires the following status checks before merge:

| Check Name              | Workflow             | Purpose |
|-------------------------|----------------------|---------|
| `Lint`                  | `ci.yml`             | ESLint must pass |
| `TypeScript`            | `ci.yml`             | tsc --noEmit must pass |
| `Unit Tests`            | `ci.yml`             | All 111 tests must pass |
| `Build`                 | `ci.yml`             | Backend + frontend build |
| `Validator`             | `validator.yml`      | Runtime component validation |

> **Note**: Branch protection requires "Allow auto-merge" to be enabled in repository Settings → General for the `deploy-staging.yml` auto-merge step to work.

---

## GitHub Environments Setup

### Creating Environments

1. Go to **GitHub → Settings → Environments**
2. Click **New environment**
3. Name it `staging`, click **Configure environment**
4. Add the required secrets (see above)
5. Repeat for `production`

### Environment Protection Rules

For `production`, consider adding:
- **Required reviewers**: (optional — leave empty for autonomous operation)
- **Wait timer**: `0` minutes (immediate deploy on passing checks)
- **Deployment branches**: restrict to `main` only

For `staging`:
- No protection rules — deploy automatically for all PRs

---

## Secret Inheritance

GitHub does not inherit environment secrets from repository secrets. You must set secrets separately in each environment.

For convenience, Railway token and project ID can be set at both the repository level (for `deploy.yml` legacy) AND inside each environment (for `deploy-staging.yml` and `deploy-production.yml`).

| Secret                | Repo level | staging env | production env |
|-----------------------|:----------:|:-----------:|:--------------:|
| `RAILWAY_TOKEN`       | ✅          | ✅           | ✅              |
| `RAILWAY_PROJECT_ID`  | ✅          | ✅           | ✅              |
| `BACKEND_URL`         | ✅          | ❌           | ✅              |
| `STAGING_BACKEND_URL` | ❌          | ✅           | ❌              |
| `NEXT_PUBLIC_API_URL` | ✅          | ❌           | ❌              |

---

## Rollback Strategy

### Staging
Staging is automatically redeployed on the next push to the PR branch. No manual rollback needed.

### Production

**Option 1 — Railway CLI (fastest)**
```bash
railway rollback --service backend --project 0361239a-54f7-4db8-8350-d7931d2b9260
railway rollback --service frontend --project 0361239a-54f7-4db8-8350-d7931d2b9260
```

**Option 2 — Revert commit + push**
```bash
git revert HEAD
git push origin main
# deploy-production.yml will redeploy automatically
```

**Option 3 — Railway Dashboard**
- Go to Railway project → Service → Deployments
- Click the previous successful deployment → Redeploy
