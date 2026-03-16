# System Map

**Version**: 1.0  
**Last Updated**: 2026-03-15

This document provides a high-level visualization of the XPS Lead Intelligence platform architecture and explains how each layer interacts.

---

## Platform Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UI LAYER (Next.js 15)                          │
│                                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Dashboard │ │  Leads   │ │  Agent   │ │  Editor  │ │   Settings   │  │
│  │Analytics │ │  CRM     │ │  Chat    │ │  Sandbox │ │  Connectors  │  │
│  │GitHub    │ │  Scraper │ │  AutoRec │ │  Visual  │ │  Social/CRM  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                     AuthContext (JWT via lib/api.ts)                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTPS + Authorization: Bearer <JWT>
┌────────────────────────────▼────────────────────────────────────────────┐
│                       CHAT ENGINE (Agent Route)                           │
│                    POST /api/agent/chat + GET /api/agent/recommend        │
│                   Receives user intent → routes to orchestrator           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                  COGNITIVE CONTROL PLANE (orchestrator.ts)                │
│                                                                           │
│   intent analysis → task decomposition → policy check → route selection  │
│   confidence scoring → budget governance → safety routing → planning      │
│                                                                           │
│   Model: Groq llama-3.1-70b-versatile (free tier)                        │
│   Max tool rounds: 8 per session                                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                    AGENT GRAPH (orchestrator.ts loop)                     │
│                                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Planner  │ │  Builder │ │Researcher│ │  Scraper │ │  Validator   │  │
│  │ Agent    │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Monitor  │ │  Repair  │ │ Deploy   │ │ Intel.   │ │  Taxonomy    │  │
│  │ Agent    │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                                           │
│   State: AgentSession (DB) + context JSON per session                     │
│   Traces: AgentTask (DB) per tool call                                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                      TOOL RUNTIME (agent-tools.ts)                        │
│                                                                           │
│  GitHub Tools    │  Docker/Sandbox  │  Lead Tools    │  Railway Tools    │
│  ─────────────── │  ──────────────  │  ───────────   │  ─────────────── │
│  list_repos      │  create_sandbox  │  leads_list    │  list_services   │
│  create_issue    │  exec_in_sandbox │  leads_create  │  get_logs        │
│  list_workflows  │  stop_container  │  leads_scrape  │  get_deployments │
│  get_workflow_run│  get_preview_url │  leads_export  │                   │
│                  │                  │  leads_score   │                   │
│                                                                           │
│  Other: code_generate, email_send, sheets_export, calendar_event,        │
│          social_post, system_get_connectors                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                         WORKER LAYER                                       │
│                                                                           │
│   Scraping Worker    │   Email Worker     │   Social Worker              │
│   ─────────────────  │   ─────────────    │   ──────────────             │
│   ScrapingJob table  │   EmailSend table  │   SocialPost table           │
│   cheerio + p-limit  │   Nodemailer/Gmail │   Platform APIs              │
│                                                                           │
│   Queue: Redis (ioredis) → job keys → worker functions                    │
│   Retry: max 3 attempts with error logging                                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                          DATA LAYER                                        │
│                                                                           │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │        PostgreSQL (Prisma)       │  │           Redis              │  │
│  │                                  │  │                              │  │
│  │  Lead · EmailTemplate · Campaign │  │  Session cache               │  │
│  │  SocialAccount · Post · Inbound  │  │  Job queues                  │  │
│  │  AgentSession · AgentTask        │  │  Rate limit counters         │  │
│  │  Connector · UserAuth · Sandbox  │  │  Pub/sub events              │  │
│  │  ScrapingJob · GitHubEvent       │  │                              │  │
│  │  AdminConfig · CalendarFollowup  │  │  Degrades gracefully if down │  │
│  └─────────────────────────────────┘  └──────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                                 │
│                                                                           │
│  GitHub (source of truth)  →  CI (GitHub Actions)  →  Railway (runtime)  │
│                                                                           │
│  Backend service: Express.js · Port 4000 · nixpacks builder              │
│  Frontend service: Next.js · Port 3000 · nixpacks builder                │
│  Database: Railway PostgreSQL (managed)                                   │
│  Cache: Railway Redis (managed)                                           │
│                                                                           │
│  Pre-deploy: `npx prisma migrate deploy`                                  │
│  Health: GET /api/health  (200 = ready)                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Interaction Description

### UI Layer → Chat Engine
The frontend uses `lib/api.ts` to make authenticated HTTP requests. Every request includes `Authorization: Bearer <JWT>` injected automatically. The UI never bypasses the API layer or calls external services directly.

### Chat Engine → Cognitive Control Plane
The `/api/agent/chat` route receives the user message, extracts intent, and passes it to `orchestrator.ts`. The orchestrator decides which tools to call, in what order, and enforces safety policy before any execution.

### Cognitive Control Plane → Agent Graph
The orchestrator runs a loop: call Groq with the user intent and tool definitions, receive tool call decisions, execute tools from the tool registry, feed results back to the model, and repeat until either a final answer is produced or MAX_TOOL_ROUNDS (8) is reached.

### Agent Graph → Tool Runtime
Each agent type has an implicit tool allowlist. The tool runtime in `agent-tools.ts` implements the actual execution logic for each of the 30+ tools. Tools wrap external APIs (GitHub, Docker, Prisma, Redis) with error handling and timeouts.

### Tool Runtime → Worker Layer
Long-running jobs (scraping, email sending, social posting) are offloaded to workers. Workers read from Redis queues and process jobs asynchronously, persisting results to PostgreSQL.

### Worker Layer → Data Layer
All workers write final results to PostgreSQL via Prisma. Redis is used only for transient state (job queues, caches). The data layer is the source of truth for all persistent state.

### Data Layer → Infrastructure
PostgreSQL and Redis run as managed Railway services. Migrations run automatically on each deploy via `npx prisma migrate deploy`. The backend connects to both via environment variables (`DATABASE_URL`, `REDIS_URL`).

---

## Auth Flow

```
Browser → Settings → "Sign in with Google/GitHub"
  → Backend /api/auth/{provider}
  → OAuth2 provider consent
  → Callback → Store tokens in UserAuth table
  → Issue JWT (30-day TTL)
  → Frontend stores JWT in localStorage (key: xps_session_token)
  → All subsequent API calls include Authorization: Bearer <JWT>
  → AuthContext reads JWT → updates UI (N accounts connected pill)
```

---

## Observability Touchpoints

| Layer | Observability Signal |
|-------|---------------------|
| HTTP | Express request logs (stdout) |
| Agent | `AgentTask` table (tool calls, results, steps) |
| Scraper | `ScrapingJob` table (status, results, timing) |
| Workers | Redis job keys + PostgreSQL results |
| Health | `GET /api/health` (200 = all required services up) |
| Integrations | `GET /api/outreach/health/deep` (per-connector status) |
| Connectors | `Connector` table (`status`, `lastChecked`) |
