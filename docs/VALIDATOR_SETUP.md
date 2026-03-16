# Validator Workflow — Setup Guide

This document explains how to configure the **Validator** GitHub Actions workflow
(`.github/workflows/validator.yml`) to connect to the real Railway Postgres
service (**postgres-rf1t**) and optionally Redis.

---

## Table of Contents

1. [Required GitHub Secrets](#1-required-github-secrets)
2. [Setting Secrets with the GitHub CLI](#2-setting-secrets-with-the-github-cli)
3. [Networking & Self-Hosted Runner](#3-networking--self-hosted-runner)
4. [Migration Guidance](#4-migration-guidance)
5. [Local Test Instructions](#5-local-test-instructions)

---

## 1. Required GitHub Secrets

Go to **GitHub → repository → Settings → Secrets and variables → Actions → Secrets** and add:

| Secret name               | Required | Description |
|---------------------------|----------|-------------|
| `VALIDATOR_DATABASE_URL`  | **Yes**  | PostgreSQL DSN for the Railway Postgres service |
| `VALIDATOR_REDIS_URL`     | No       | Redis DSN (only if your tests require Redis) |
| `VALIDATOR_JWT_SECRET`    | No       | JWT secret for tests that require authentication |

### Connection string formats (examples — replace placeholders with real values)

```
# PostgreSQL
postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?sslmode=require

# Example (Railway public host):
postgresql://postgres:<secure-random-password>@roundhouse.proxy.rlwy.net:12345/railway?sslmode=require

# Redis
redis://:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>
```

> ⚠️  **Never commit credentials.** Only reference `${{ secrets.VALIDATOR_DATABASE_URL }}` in YAML.

### How to find the Railway connection string

1. Open your Railway project → select the **Postgres** service (postgres-rf1t).
2. Click the **Connect** tab → **Public network**.
3. Copy the **Database URL** shown there.  It looks like:
   ```
   postgresql://postgres:<password>@<public-host>.proxy.rlwy.net:<port>/railway
   ```
4. Use that value when setting the `VALIDATOR_DATABASE_URL` secret below.

---

## 2. Setting Secrets with the GitHub CLI

Install the [GitHub CLI](https://cli.github.com/) and authenticate (`gh auth login`), then:

```bash
# Set VALIDATOR_DATABASE_URL
# Replace the placeholder with the real Railway-provided connection string.
gh secret set VALIDATOR_DATABASE_URL \
  --repo InfinityXOneSystems/xps-lead-intelligence \
  --body "postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?sslmode=require"

# Set VALIDATOR_REDIS_URL  (optional)
gh secret set VALIDATOR_REDIS_URL \
  --repo InfinityXOneSystems/xps-lead-intelligence \
  --body "redis://:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>"

# Set VALIDATOR_JWT_SECRET  (optional)
gh secret set VALIDATOR_JWT_SECRET \
  --repo InfinityXOneSystems/xps-lead-intelligence \
  --body "<your-jwt-secret>"
```

> 💡  You can also set secrets interactively (omit `--body`) — the CLI will prompt
>     you to paste the value without it appearing in your shell history.

---

## 3. Networking & Self-Hosted Runner

### Public host (simplest)

If you use the **public proxy URL** from Railway (e.g. `*.proxy.rlwy.net`), the
standard `runs-on: ubuntu-latest` GitHub-hosted runner can reach it directly.
No extra configuration is needed.

### Private network host (railway.internal)

The hostname `postgres-rf1t.railway.internal` (and any `*.railway.internal` address)
is **only resolvable inside Railway's private network**.  The GitHub-hosted runner
cannot reach it.

You have two options:

#### Option A — Use the public Railway proxy URL (recommended for CI)

In the Railway dashboard → Postgres service → **Connect** → toggle to **Public Network**,
copy the proxy URL, and use that as `VALIDATOR_DATABASE_URL`.

#### Option B — Register a self-hosted runner inside Railway

1. In GitHub → **Settings → Actions → Runners → New self-hosted runner**, follow the
   setup instructions to register a runner with the label `railway-internal`.
2. Deploy the runner inside your Railway project (e.g. as a separate Railway service)
   so it shares the private network.
3. Update the workflow `runs-on` line:

```yaml
# .github/workflows/validator.yml — self-hosted runner snippet
jobs:
  validate:
    name: Validate PR
    runs-on: [self-hosted, railway-internal]   # ← change this line
    steps:
      # ... rest of steps unchanged ...
```

> See [GitHub Docs — Self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners)
> for full registration and security guidance.

---

## 4. Migration Guidance

> ⚠️  **Caution:** Running `prisma migrate deploy` against a **shared production
>     database** from CI can cause data loss or downtime.  The Validator workflow
>     only runs `prisma validate` (schema check, no migrations) and read-only
>     connectivity tests.

### Recommendations

- **Create a CI-dedicated database user** with read-only or schema-validate-only
  permissions on the Railway Postgres service. Grant it `CONNECT` and `SELECT`
  privileges only.

  ```sql
  -- Run once on the Railway Postgres instance (psql or Railway console)
  CREATE USER ci_validator WITH PASSWORD '<strong-random-password>';
  GRANT CONNECT ON DATABASE railway TO ci_validator;
  GRANT USAGE ON SCHEMA public TO ci_validator;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO ci_validator;
  -- Allow future tables to also be readable:
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ci_validator;
  ```

  Then set `VALIDATOR_DATABASE_URL` to use `ci_validator`'s credentials.

- **Alternatively**, provision an **ephemeral CI database** (a separate Railway
  Postgres service used only by CI) and set `VALIDATOR_DATABASE_URL` to that service's
  public URL.

- Do **not** use the same `DATABASE_URL` that your production backend uses.

---

## 5. Local Test Instructions

You can reproduce the exact same checks the Validator job runs on your local machine:

```bash
# 1. Export the Railway Postgres DSN (replace with your actual values)
export VALIDATOR_DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?sslmode=require"
export VALIDATOR_REDIS_URL="redis://:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>"  # optional
export VALIDATOR_JWT_SECRET="<your-jwt-secret>"                                   # optional

# 2. Connectivity checks
DB_HOST=$(echo "$VALIDATOR_DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$VALIDATOR_DATABASE_URL" | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+).*|\1|')
pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -t 15
psql "$VALIDATOR_DATABASE_URL" -c "SELECT 1;"

# 3. Install deps
cd backend && npm ci

# 4. TypeScript
npx tsc --noEmit

# 5. Lint
npm run lint

# 6. Prisma validate
DATABASE_URL="$VALIDATOR_DATABASE_URL" npx prisma validate

# 7. Tests
NODE_ENV=test \
  DATABASE_URL="$VALIDATOR_DATABASE_URL" \
  REDIS_URL="$VALIDATOR_REDIS_URL" \
  JWT_SECRET="$VALIDATOR_JWT_SECRET" \
  npm test -- --coverage --coverageDirectory=coverage
```

All these commands map 1-to-1 to the steps in `.github/workflows/validator.yml`.
