# TAP Protocol: Policy > Authority > Truth
# Railway infrastructure overview for xps-lead-intelligence.
# Secrets must be supplied via GitHub Secrets — never committed to the repository.

# Railway Infrastructure

This document provides an overview of the Railway infrastructure used by **xps-lead-intelligence**.

## Project

- **Project name:** Lead Intelligence
- **Platform:** [Railway](https://railway.app)

## Services

| Service | Type | Description |
|---------|------|-------------|
| `backend` | Node.js API | Express/TypeScript backend (source root: `backend/`) |
| `frontend` | Next.js app | React/Next.js frontend (source root: `frontend/`) |
| `Postgres-rF1T` | PostgreSQL plugin | Primary database |
| `Redis-rF1T` | Redis plugin | Cache and job queue |

## Internal Networking

Services communicate using Railway's private network:

- Postgres: `postgres-rf1t.railway.internal`
- Redis: `redis-rf1t.railway.internal`

> **Note:** Internal hostnames are only reachable within Railway's private network.
> GitHub-hosted CI runners cannot reach these hostnames directly.
> See [docs/RAILWAY_SETUP.md](RAILWAY_SETUP.md) for networking options.

## Setup and Provisioning

For full step-by-step provisioning instructions, see:

📖 **[docs/RAILWAY_SETUP.md](RAILWAY_SETUP.md)**

This includes:
- Manual provisioning using `scripts/railway_provision.sh`
- Automated provisioning via GitHub Actions `workflow_dispatch`
- Required GitHub Secrets and Railway variable mapping
- Networking guidance (internal vs public hostnames)
- Security notes and pre-merge checklist

## Environment Variables

Environment variables are managed in the Railway dashboard. Key variables:

| Variable | Service | Value |
|----------|---------|-------|
| `DATABASE_URL` | `backend` | `${Postgres-rF1T.DATABASE_URL}` |
| `REDIS_URL` | `backend` | `${Redis-rF1T.REDIS_URL}` |
| `NODE_ENV` | `backend` | `production` |
| `JWT_SECRET` | `backend` | _(from GitHub Secret)_ |
| `GROQ_API_KEY` | `backend` | _(from GitHub Secret)_ |
| `BACKEND_URL` | `backend` | Public Railway URL |
| `FRONTEND_URL` | `backend`, `frontend` | Public Railway URL |
| `NEXT_PUBLIC_API_URL` | `frontend` | Same as `BACKEND_URL` |
