# Railway Deployment Guide

This document covers deploying the **XPS Lead Intelligence** application on
[Railway](https://railway.app), project **Lead Intelligence**
(`0361239a-54f7-4db8-8350-d7931d2b9260`).

---

## Services

| Service    | Description                         | Target Port |
|------------|-------------------------------------|-------------|
| `backend`  | Node.js / Express API               | `8080`      |
| `frontend` | Next.js application                 | `3000`      |
| `postgres` | Managed PostgreSQL (Railway plugin) | `5432`      |
| `redis`    | Managed Redis (Railway plugin)      | `6379`      |

---

## Environment Variables

### Backend

| Variable             | Source / Value                               |
|----------------------|----------------------------------------------|
| `DATABASE_URL`       | `${{Postgres-rF1T.DATABASE_URL}}`            |
| `REDIS_URL`          | `${{Redis.REDIS_URL}}`                       |
| `JWT_SECRET`         | Set manually in Railway service variables    |
| `NODE_ENV`           | `production`                                 |
| `PORT`               | `8080` (Railway injects this automatically)  |

### Frontend

| Variable              | Value                                        |
|-----------------------|----------------------------------------------|
| `NEXT_PUBLIC_API_URL` | Your backend's public Railway domain         |
| `NODE_ENV`            | `production`                                 |
| `PORT`                | `3000`                                       |

---

## Networking

- **Public HTTP** must be enabled for both `backend` and `frontend` services.
- The Postgres and Redis services are accessible within the private Railway
  network via their `.railway.internal` hostnames.
- The backend public URL is the value to use for `NEXT_PUBLIC_API_URL` in the
  frontend service.

---

## Healthcheck

The backend exposes a health endpoint at `/api/health`. Configure Railway's
healthcheck path to `/api/health` for the backend service.

---

## Deploying

Railway auto-deploys from the `main` branch whenever a push occurs (linked via
the GitHub integration). To trigger a manual redeploy, use:

```bash
railway up --service backend
railway up --service frontend
```

---

## CI Validator

The **Validator** GitHub Actions workflow
(`.github/workflows/validator.yml`) runs on every Pull Request and connects
to the real Railway Postgres database to validate the Prisma schema and run
the test suite.

### Required GitHub secret

| Secret name               | Description                                      |
|---------------------------|--------------------------------------------------|
| `VALIDATOR_DATABASE_URL`  | Full PostgreSQL connection string for CI use     |

Map the Railway variable `${Postgres-rF1T.DATABASE_URL}` to a Railway service
variable, then copy the **public** connection string (with
`.railway.app` hostname) into the `VALIDATOR_DATABASE_URL` GitHub secret.

> **Recommendation:** Create a dedicated CI database user with read-only /
> schema-introspection privileges instead of using the application user.
> See [`docs/VALIDATOR_SETUP.md`](./VALIDATOR_SETUP.md) for the exact `CREATE
> USER` SQL and `gh secret set` commands.

**Optional secrets:**

| Secret name            | Description                          |
|------------------------|--------------------------------------|
| `VALIDATOR_REDIS_URL`  | Redis connection string (optional)   |
| `VALIDATOR_JWT_SECRET` | JWT signing secret for tests (opt.)  |

For full setup instructions, networking guidance (public vs.
`postgres-rf1t.railway.internal`), and self-hosted runner configuration, see
[`docs/VALIDATOR_SETUP.md`](./VALIDATOR_SETUP.md).

---

## Security

- Never commit connection strings or secrets to the repository.
- Rotate credentials after any team-member offboarding.
- Enable SSL (`?sslmode=require`) on all external Postgres connections.
