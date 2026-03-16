# Architecture

## Overview

XPS Lead Intelligence is a full-stack AI Operating System for lead generation and business intelligence. It combines autonomous AI agents, web scraping, CRM, email outreach, social media management, and OAuth-gated features in a single platform.

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Dashboard│  │ Agent Chat│  │ Leads CRM│  │  Settings │  │
│  │ Analytics│  │AutoRecommd│  │  Scraper │  │ OAuth Login│  │
│  │ GitHub   │  │  Editor   │  │  Email   │  │ Connectors│  │
│  │ Social   │  │  Sandbox  │  │  SocialCRM│  │           │  │
│  └──────────┘  └───────────┘  └──────────┘  └───────────┘  │
│                         AuthContext (JWT)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP + Bearer JWT
┌─────────────────────▼───────────────────────────────────────┐
│                    Backend (Express.js)                       │
│                                                               │
│  Routes: /api/auth/* /api/leads/* /api/agent/* /api/email/*  │
│          /api/social/* /api/outreach/* /api/github/*         │
│          /api/connectors/* /api/admin/* /api/xps/*           │
│                                                               │
│  Services:                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Orchestrtr│  │  Scraper │  │  Email   │  │   GitHub   │  │
│  │(Groq LLM)│  │(Cheerio) │  │(Nodemailer│  │  (Octokit) │  │
│  │30+ tools │  │p-limit   │  │ Gmail    │  │ Webhooks   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Lead Score│  │  Social  │  │  Google  │  │   Docker   │  │
│  │(multi-   │  │(Twitter/ │  │(OAuth2/  │  │ (Sandbox)  │  │
│  │ factor)  │  │LinkedIn) │  │ Sheets/  │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────┬──────────────────────┬────────────────────────────────┘
       │                      │
┌──────▼──────┐        ┌──────▼──────┐
│ PostgreSQL  │        │    Redis    │
│  (Prisma)   │        │  (cache/    │
│  16 models  │        │   queue)    │
└─────────────┘        └─────────────┘
```

## Data Models (Prisma)

| Model | Purpose |
|-------|---------|
| `Lead` | CRM record with contact + business data + scoring |
| `EmailTemplate` | Reusable email templates with `{{variable}}` placeholders |
| `EmailCampaign` | Mass email campaigns with lead filtering |
| `EmailSend` | Individual email send tracking (opens, clicks, replies) |
| `CalendarFollowup` | Google Calendar follow-up events |
| `SocialAccount` | Connected social media accounts |
| `SocialPost` | Scheduled/published social posts |
| `SocialInboundMessage` | Incoming DMs/mentions for CRM |
| `ScrapingJob` | Web scraper job tracking |
| `AgentSession` | Agent conversation history |
| `AgentTask` | Agent task execution log |
| `Connector` | Integration health tracking |
| `UserAuth` | OAuth provider tokens (Google/GitHub/Railway) |
| `Sandbox` | Docker sandbox environments |
| `GitHubEvent` | GitHub webhook event log |
| `AdminConfig` | Key/value config storage |

## API Routes

### `/api/auth/*` — OAuth + JWT
- `GET /api/auth/status` — Get all connected account states
- `GET /api/auth/google` — Initiate Google OAuth2 flow
- `GET /api/auth/google/callback` — Google OAuth callback
- `GET /api/auth/github` — Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` — GitHub OAuth callback
- `POST /api/auth/railway` — Connect Railway via API token
- `POST /api/auth/logout/:provider` — Disconnect a provider
- `GET /api/auth/verify` — Verify JWT token

### `/api/leads/*` — Lead CRM
- `GET /api/leads` — List leads (filterable, sortable)
- `POST /api/leads` — Create lead
- `PUT /api/leads/:id` — Update lead
- `DELETE /api/leads/:id` — Delete lead
- `GET /api/leads/stats` — Aggregated stats
- `POST /api/leads/scrape` — Trigger web scrape
- `POST /api/leads/score-all` — Re-score all leads

### `/api/agent/*` — LLM Agent
- `POST /api/agent/chat` — Send message to AI agent
- `GET /api/agent/recommend` — Get context-aware suggestions

### `/api/email/*` — Email Outreach
- `GET/POST /api/email/templates` — Email template management
- `POST /api/email/send` — Send emails via campaign
- `GET /api/email/campaigns` — List campaigns

### `/api/social/*` — Social Media
- `GET/POST /api/social/accounts` — Social account management
- `POST /api/social/post` — Publish/schedule post
- `GET /api/social/inbound` — Inbound messages
- `POST /api/social/auto-reply` — Process auto-replies

### `/api/outreach/*` — Outreach Tools
- `POST /api/outreach/sheets-export` — Export to Google Sheets
- `POST /api/outreach/calendar-event` — Create Google Calendar event
- `GET /api/outreach/csv` — Export leads as CSV
- `GET /api/outreach/health/deep` — Deep integration health check

### `/api/github/*` — GitHub Integration
- `GET /api/github/repos` — List repositories
- `GET /api/github/issues/:owner/:repo` — List issues
- `POST /api/github/issues` — Create issue
- `GET /api/github/pulls/:owner/:repo` — List PRs
- `GET /api/github/workflows/:owner/:repo` — List workflows
- `POST /api/github/webhooks` — Webhook handler

### `/api/connectors/*` — Connector Health
- `GET /api/connectors` — List all connector statuses
- `PUT /api/connectors/:type` — Update connector config

## Agent Tools (30+)

The AI agent (Groq llama-3.1-70b-versatile) has access to:

**GitHub Tools**: `github_list_repos`, `github_get_repo`, `github_list_issues`, `github_create_issue`, `github_list_pulls`, `github_list_workflows`, `github_get_workflow_run`, `github_create_file`

**Docker/Sandbox Tools**: `docker_list_containers`, `docker_create_sandbox`, `docker_exec_in_sandbox`, `docker_stop_container`, `sandbox_get_preview_url`

**Lead Tools**: `leads_list`, `leads_create`, `leads_update`, `leads_scrape`, `leads_export_csv`, `leads_score_all`

**Railway Tools**: `railway_list_services`, `railway_get_logs`, `railway_get_deployments`

**Other**: `code_generate`, `system_get_connectors`, `email_send`, `email_template_create`, `google_sheets_export`, `calendar_schedule_followup`, `lead_score_all`, `social_post_publish`, `social_process_replies`

## Authentication Flow

```
User → Settings → "Sign in with Google"
  → Backend /api/auth/google → Google OAuth2 consent
  → Callback /api/auth/google/callback
  → Store in UserAuth DB table
  → Issue JWT (30-day TTL)
  → Frontend receives JWT → stores in localStorage
  → AuthContext reads JWT → updates UI state
  → "N accounts connected" pill appears in header
  → All API calls include Authorization: Bearer <jwt>
```

## Security

- **SSRF Prevention**: `assertSafeExternalUrl()` blocks private IP ranges
- **Rate Limiting**: `express-rate-limit` on all auth routes (20 req/15min)
- **JWT**: Required in production (process.exit(1) if missing)
- **Input Validation**: Railway tokens validated (length + charset)
- **HTML Sanitization**: `stripHtml()` from `sanitize-html` package
- **Secret Handling**: All secrets via environment variables only
