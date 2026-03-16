# Validator CI Setup Guide

This document describes how to configure GitHub repository secrets and runner
networking so the **Validator** workflow
(`.github/workflows/validator.yml`) can connect to the real Railway PostgreSQL
database instead of a dummy DSN.

---

## Overview

The Validator workflow now uses **real Railway Postgres** for:

- `npx prisma validate` — validates the schema against a live database
- `npm test` — integration/unit tests that may need `DATABASE_URL`

No dummy DSNs are committed to the repository. All credentials are injected
exclusively through GitHub Actions secrets at runtime.

---

## Required GitHub Secrets

Create the following secrets in
**GitHub → Repository Settings → Secrets and variables → Actions → New repository secret**.

### `VALIDATOR_DATABASE_URL` *(required)*

The full PostgreSQL connection string for the CI database.

**Format:**

```
postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require
```

**Example (with placeholders — do NOT use real credentials):**

```
postgresql://ci_user:REPLACE_WITH_PASSWORD@postgres-XXXX.railway.app:5432/railway?sslmode=require
```

> **Important:** Use a publicly-reachable hostname (e.g. `*.railway.app`) when
> running on GitHub-hosted runners. See [Networking](#networking) below.

---

### `VALIDATOR_REDIS_URL` *(optional)*

If your tests or the connectivity check should also verify Redis, set this
secret. If omitted, the Redis check is skipped.

**Format:**

```
redis://<user>:<password>@<host>:<port>
```

**Example (placeholders):**

```
redis://default:REPLACE_WITH_PASSWORD@redis-host.railway.app:6379
```

---

### `VALIDATOR_JWT_SECRET` *(optional)*

Used by the test suite for JWT signing. If not set, a placeholder value
(`ci-test-jwt-secret-placeholder`) is used automatically — sufficient for
unit tests that do not hit a live auth endpoint.

**Example (placeholder):**

```
a-long-random-string-at-least-32-chars
```

---

## Setting Secrets with the `gh` CLI

```bash
# Required
gh secret set VALIDATOR_DATABASE_URL \
  --repo YOUR_ORG/YOUR_REPO \
  --body "postgresql://ci_user:REPLACE_WITH_PASSWORD@postgres-XXXX.railway.app:5432/railway?sslmode=require"

# Optional
gh secret set VALIDATOR_REDIS_URL \
  --repo YOUR_ORG/YOUR_REPO \
  --body "redis://default:REPLACE_WITH_PASSWORD@redis-XXXX.railway.app:6379"

gh secret set VALIDATOR_JWT_SECRET \
  --repo YOUR_ORG/YOUR_REPO \
  --body "REPLACE_WITH_LONG_RANDOM_SECRET"
```

> Replace every `REPLACE_WITH_*` placeholder with the actual value. Never
> commit real credentials to source control.

---

## Networking

### Public hostname (recommended for GitHub-hosted runners)

Railway exposes a **public TCP endpoint** for each Postgres service. In the
Railway dashboard, open your Postgres service → **Connect** tab and copy the
**Public URL** (format: `postgres-xxxx.railway.app:PORT`).

Use this public URL as `VALIDATOR_DATABASE_URL` when running on
`runs-on: ubuntu-latest`.

### Internal hostname (Railway-private network only)

Railway also provides a **private hostname** such as
`postgres-rf1t.railway.internal`. This hostname is **only reachable from
within the Railway private network** and is NOT accessible from
GitHub-hosted runners.

If you need to use the internal hostname (e.g., for security reasons), you
must register a **self-hosted runner inside Railway** — see the section below.

---

## Self-Hosted Runner (Railway-internal network)

If your DB host is internal-only (e.g. `postgres-rf1t.railway.internal`),
replace the `runs-on` line in `.github/workflows/validator.yml`:

```yaml
# Replace this:
runs-on: ubuntu-latest

# With this:
runs-on: [self-hosted, linux, railway-internal]
```

### Registering a self-hosted runner in Railway

1. In GitHub, go to **Repository Settings → Actions → Runners → New
   self-hosted runner**.
2. Follow the instructions to download and configure the runner binary.
3. Deploy the runner as a Railway service (e.g. a Docker container running the
   runner agent) inside the same Railway project as Postgres.
4. Label the runner `railway-internal` when prompted for labels.
5. Ensure the runner service has a healthy start command and can reach
   `postgres-rf1t.railway.internal`.

---

## Migration Guidance

> **Caution:** The Validator workflow runs `prisma validate` (schema check only,
> no migrations). It does **not** run `prisma migrate deploy` automatically.
>
> To avoid breaking your production data:
>
> - Use a **dedicated CI database** or a **CI-specific database user** with
>   limited privileges (e.g., `SELECT` + schema introspection only).
> - Do NOT point `VALIDATOR_DATABASE_URL` at your production database unless
>   you fully understand the risks.
> - If you want the CI user to run migrations in staging, create a separate
>   staging secret and a separate workflow step gated on the target branch.

**Recommended Railway setup:**

```sql
-- Run in your Railway Postgres console
CREATE USER ci_user
  WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
  NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE railway TO ci_user;
GRANT USAGE ON SCHEMA public TO ci_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ci_user;
-- Allow schema introspection (needed by prisma validate)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ci_user;
```

---

## Running the Same Steps Locally

```bash
# Export the same env vars
export DATABASE_URL="postgresql://ci_user:PASSWORD@localhost:5432/mydb"
export JWT_SECRET="local-test-secret"

# Type-check
cd backend && npx tsc --noEmit

# Lint
npm run lint

# Prisma schema validate
npx prisma validate

# Tests with coverage
npm test -- --coverage --coverageReporters=lcov,text
```

---

## Security Notes

- **Never** commit database credentials, passwords, or connection strings to
  the repository. Use GitHub Actions secrets exclusively.
- If a credential is accidentally committed, revoke and rotate it immediately,
  then purge it from git history (e.g. with `git filter-repo`).
- Rotate `VALIDATOR_DATABASE_URL` regularly, especially after team-member
  offboarding.
- Use a **separate CI database user** with minimal privileges rather than an
  admin or application user.
- Enable **SSL** (`?sslmode=require`) in the connection string to encrypt
  data in transit between the runner and Railway Postgres.
- Review Railway's [security documentation](https://docs.railway.app/reference/security)
  for additional hardening options.
