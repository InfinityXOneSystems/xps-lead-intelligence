# Connectors Guide

## Overview

XPS Lead Intelligence connects to external services through a Connector system. Each connector has:
- An integration in the backend (route + service)
- Settings UI in the frontend (Settings → Connectors)
- Health tracking in the `Connector` database table

## Available Connectors

### Google Account
Enables: Gmail sending, Google Sheets export, Google Calendar follow-ups

**Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web application type)
3. Enable: Gmail API, Google Sheets API, Google Calendar API
4. Add redirect URI: `https://<backend>/api/auth/google/callback`
5. Add to Railway: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
6. In app: Settings → Accounts → "Sign in with Google"

**Features after connecting**:
- Email Outreach → Send via Gmail
- Leads CRM → Export to Google Sheets
- Email Outreach → Create Calendar follow-up events

---

### GitHub Account
Enables: Repository browsing, issue creation, PR management, Actions workflows

**Setup**:
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set callback URL: `https://<backend>/api/auth/github/callback`
3. Add to Railway: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
4. In app: Settings → Accounts → "Sign in with GitHub"

**Features after connecting**:
- GitHub panel: Browse repos, issues, PRs
- Agent: Use GitHub tools (`github_list_repos`, `github_create_issue`, etc.)
- Webhooks: Receive GitHub events (requires GitHub App or webhook config)

---

### Railway Account
Enables: Service management, deployment logs, environment variables

**Setup**:
1. Go to [railway.app/account/tokens](https://railway.app/account/tokens)
2. Create a new token
3. In app: Settings → Accounts → "Connect Railway" → paste token

**Features after connecting**:
- Agent: Use Railway tools (`railway_list_services`, `railway_get_logs`)
- Connectors panel: See Railway service status

---

### Groq LLM
Enables: AI agent chat, auto-recommendations, email template generation, social post generation

**Setup**:
1. Sign up at [console.groq.com](https://console.groq.com) (free tier available)
2. Create an API key
3. Add to Railway: `GROQ_API_KEY`

**Model used**: `llama-3.1-70b-versatile`

---

### Social Media
Enables: Twitter, LinkedIn, Instagram posting and inbound message handling

**Setup**:
1. Connect in app: Social Agent → Connect Platform
2. Each platform requires its own API credentials:
   - Twitter: API v2 Bearer Token
   - LinkedIn: OAuth App
   - Instagram: Business account + Meta App

---

### Docker (Sandbox)
Enables: Running generated code in isolated containers

**Setup**: Docker daemon must be running on the backend host.

- Railway does NOT support Docker-in-Docker by default
- For sandbox features, run backend on a host with Docker access (e.g., a VPS)
- The sandbox degrades gracefully — other features work without Docker

## Connector Health Check

```bash
# Get connector health status
curl https://<backend>/api/outreach/health/deep

# Get all connectors
curl https://<backend>/api/connectors
```

Health statuses:
- `connected` — Integration is working
- `disconnected` — Not configured
- `unconfigured` — Env vars missing
- `error` — Configured but failing

## Connector Table in Database

The `Connector` table tracks connector health:

```prisma
model Connector {
  id          String
  type        ConnectorType  # GITHUB | RAILWAY | GPT | GOOGLE | XPS
  name        String
  config      Json
  status      ConnectorStatus  # CONNECTED | DISCONNECTED | ERROR
  lastChecked DateTime?
}
```

## Debugging Connector Issues

1. Check connector status in Settings → Connectors
2. View raw health: `GET /api/connectors`
3. Check backend logs in Railway dashboard
4. Verify environment variables are set in Railway service settings
5. Test OAuth callbacks manually with the correct redirect URIs
