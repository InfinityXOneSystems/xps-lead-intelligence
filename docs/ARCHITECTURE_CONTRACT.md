# Architecture Contract

**Status**: BINDING  
**Version**: 1.0  
**Last Updated**: 2026-03-15

This document defines the system architecture of XPS Lead Intelligence as a binding contract. All code, configuration, and infrastructure changes must conform to these specifications. Deviations require explicit justification and architectural review.

---

## 1. Kernel Layer

**Purpose**: Platform-level runtime that manages system state, lifecycle, and cross-cutting concerns.

**Responsibilities**:
- System state management (startup, ready, degraded, shutdown)
- Task scheduling and job routing
- Agent lifecycle management (spawn, monitor, terminate)
- Tool routing and capability discovery
- Policy enforcement and audit logging
- Retry coordination and failure handling
- Registry loading on startup

**System Boundaries**:
- Owns the job queue (Redis-backed)
- Owns the connector registry (`Connector` table)
- Owns the agent session store (`AgentSession`, `AgentTask` tables)
- Does NOT own business logic (leads, social, email)
- Does NOT own UI state

**Required Technologies**:
- Node.js + TypeScript (backend runtime)
- Redis (job queue, state cache)
- PostgreSQL via Prisma (persistent state)
- Express.js (HTTP layer)

---

## 2. Cognitive Control Plane

**Purpose**: Governor of all agent and tool execution. Decides what runs, in what order, under what constraints.

**Responsibilities**:
- Intent analysis from user input
- Task decomposition into agent steps
- Policy checks before execution
- Route selection (which agent/tool handles a task)
- Confidence scoring on outputs
- Budget and rate governance (Groq token limits)
- Safety routing (blocking dangerous actions)
- Rollback recommendations on failure

**System Boundaries**:
- Controls the agent orchestration layer — does NOT execute tools directly
- Reads from the Intelligence Library for context
- Writes execution plans to the AgentTask table
- Does NOT own the UI layer

**Required Technologies**:
- Groq LLM (llama-3.1-70b-versatile) for reasoning
- `orchestrator.ts` service in backend
- Policy rules as TypeScript constants (not runtime-configurable)

---

## 3. Agent Orchestration Layer

**Purpose**: Stateful, multi-step agent execution with explicit transitions, retries, and timeouts.

**Responsibilities**:
- Execute agent graphs with defined state transitions
- Enforce per-agent tool permissions
- Retry failed steps up to MAX_RETRIES (3)
- Enforce MAX_TOOL_ROUNDS (8) per session
- Persist full execution traces
- Support session resumability via `AgentSession` table

**System Boundaries**:
- Receives tasks from the Cognitive Control Plane
- Calls tools from the Tool Registry
- Writes results to `AgentTask` table
- Does NOT call external APIs directly (uses tool wrappers)

**Required Technologies**:
- `orchestrator.ts` with Groq native function-calling
- `agent-tools.ts` tool registry (30+ tools)
- PostgreSQL `AgentSession` + `AgentTask` models

**Agent Types** (implemented via tool permissions):
- planner, builder, researcher, scraper, validator, monitor, repair, deployment, intelligence, taxonomy, documentation

---

## 4. Vision Cortex

**Purpose**: Discovery engine for identifying opportunities from public data sources.

**Responsibilities**:
- Scan GitHub public repositories as seed intelligence
- Analyze SaaS patterns, market structures, opportunity clusters
- Score opportunities with evidence
- Persist findings to the Invention/Intelligence database
- Trigger Invention Machine on high-confidence discoveries

**System Boundaries**:
- Uses scraper tools and GitHub API tools only
- Writes to `IntelligenceRecord` (future model) or `AdminConfig` with structured JSON
- Does NOT make purchasing decisions
- Does NOT access private repositories without explicit auth

**Required Technologies**:
- Groq LLM for analysis
- GitHub REST API (via Octokit)
- Cheerio-based scraper for public web pages
- PostgreSQL for persistence

---

## 5. Invention Machine

**Purpose**: Transform Vision Cortex discoveries into structured build opportunities.

**Responsibilities**:
- Generate concept briefs, system blueprints, product maps
- Generate implementation trees and experiment plans
- Generate MVP, validation, and deployment plans
- Wire outputs into agent chat UI

**System Boundaries**:
- Consumes Vision Cortex output
- Produces structured JSON documents persisted in DB
- Does NOT execute builds autonomously without user approval

**Required Technologies**:
- Groq LLM for generation
- PostgreSQL for persistence (structured JSON in `AdminConfig` or dedicated table)

---

## 6. Intelligence Library

**Purpose**: Central knowledge store for all system intelligence artifacts.

**Responsibilities**:
- Taxonomy and ontology scaffolding
- Pattern, architecture, market, and technology libraries
- Prompt and eval registries
- Repo benchmark registry
- Semantic search and retrieval (keyword initially, vector when pgvector is added)

**System Boundaries**:
- Read/write from all system layers
- Exposed via `/api/xps/*` routes
- Does NOT replace operational databases (leads, social, etc.)

**Required Technologies**:
- PostgreSQL (primary store)
- pgvector extension (planned — keyword search until available)
- `xps.ts` route handler

---

## 7. Taxonomy + Index System

**Purpose**: Formal classification and retrieval of all system artifacts.

**Responsibilities**:
- Classify: technologies, agents, tools, prompts, APIs, business models, workflows
- Deterministic ID generation (cuid)
- Evidence and provenance fields on all records
- Tag-based and category-based retrieval

**System Boundaries**:
- Schema lives in Prisma models
- Exposed via API routes
- Does NOT overlap with lead CRM data

**Required Technologies**:
- PostgreSQL + Prisma
- cuid for deterministic IDs
- JSON fields for flexible metadata

---

## 8. Plugin / Tool System

**Purpose**: Universal tool registry with schema-validated I/O, permissions, and telemetry.

**Responsibilities**:
- Registry-based tool loading
- Per-tool input/output schema validation
- Per-agent tool permissions
- Timeout enforcement
- Graceful degradation on tool failure

**System Boundaries**:
- All tools defined in `agent-tools.ts`
- Tools call external services (GitHub API, Docker, Prisma)
- Does NOT expose tools directly to frontend (agent-mediated only)

**Required Technologies**:
- TypeScript interfaces for tool contracts
- Groq function-calling JSON schemas
- Node.js `p-limit` for concurrency control

---

## 9. Sandbox Execution System

**Purpose**: Isolated code execution environment for generated code.

**Responsibilities**:
- Docker container lifecycle (create, exec, stop)
- Filesystem boundary enforcement
- Timeout and resource limit enforcement
- Artifact capture and log streaming
- Test execution before promotion

**System Boundaries**:
- Docker daemon required on host
- Degrades gracefully when Docker unavailable
- Results stored in `Sandbox` table

**Required Technologies**:
- Dockerode (Node.js Docker SDK)
- PostgreSQL `Sandbox` model
- TTY stream parsing for output

---

## 10. Data Layer

**Purpose**: Persistent storage for all system data domains.

**Responsibilities**:
- Primary relational store for all entities
- Cache/queue via Redis
- Embedding store (pgvector, planned)

**System Boundaries**:
- All DB access via Prisma ORM only
- No raw SQL in application code
- Redis used for: session cache, job queues, pub/sub
- Migrations via `prisma migrate deploy` in CI/CD

**Required Technologies**:
- PostgreSQL 15+ (primary)
- Prisma ORM (migrations + client)
- Redis 7+ (cache/queue)
- pgvector (planned — for embeddings)

**Data Domains** (Prisma models):
`Lead`, `EmailTemplate`, `EmailCampaign`, `EmailSend`, `CalendarFollowup`, `SocialAccount`, `SocialPost`, `SocialInboundMessage`, `ScrapingJob`, `AgentSession`, `AgentTask`, `Connector`, `UserAuth`, `Sandbox`, `GitHubEvent`, `AdminConfig`

---

## 11. Event / Queue / Workflow Layer

**Purpose**: Async job processing, event-driven orchestration, and workflow coordination.

**Responsibilities**:
- Redis-backed job queue for scraping, email sending, social posting
- Retry with exponential backoff (max 3 retries)
- Dead letter strategy: log to `AdminConfig` with `dlq:` prefix
- Job progress tracking via Redis keys
- Cancellation support where feasible

**System Boundaries**:
- Workers consume from Redis queues
- Job results persisted to PostgreSQL
- Does NOT use external queue services (SQS, PubSub, etc.)

**Required Technologies**:
- Redis 7+ (ioredis client)
- Node.js worker processes

---

## 12. Observability

**Purpose**: Full system visibility from startup to production.

**Responsibilities**:
- Structured JSON logging with trace IDs
- Health endpoint at `GET /api/health`
- Deep integration health at `GET /api/outreach/health/deep`
- Agent execution traces in `AgentTask` table
- Scraper job traces in `ScrapingJob` table

**System Boundaries**:
- Logs to stdout (Railway captures automatically)
- Does NOT require external observability services for core operation
- OpenTelemetry integration is planned but not required for MVP

**Required Technologies**:
- Express.js request logging (morgan or structured console)
- PostgreSQL for trace storage
- Health endpoints (already implemented)

---

## 13. Security Layer

**Purpose**: Defense-in-depth security across all system surfaces.

**Responsibilities**:
- JWT authentication (30-day TTL, required in production)
- OAuth via Google, GitHub, Railway
- SSRF prevention via `assertSafeExternalUrl()`
- Rate limiting on auth routes (20 req/15min)
- HTML sanitization via `stripHtml()` (sanitize-html package)
- Input validation on all routes
- No secrets in code

**System Boundaries**:
- Auth middleware on all protected routes
- SSRF guard on all external HTTP calls
- Secrets via environment variables only

**Required Technologies**:
- `jsonwebtoken` (JWT)
- `express-rate-limit` (rate limiting)
- `sanitize-html` (HTML stripping)
- OAuth2 flows via Google/GitHub OAuth apps

---

## Contract Enforcement

This contract is enforced by:
1. `copilot-instructions.md` — Copilot behavioral rules
2. `.github/workflows/ci.yml` — Automated CI checks
3. `docs/GOVERNOR.md` — Change governance rules
4. Code review requirement before merge to `main`
