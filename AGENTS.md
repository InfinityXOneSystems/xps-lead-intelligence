# AGENTS — Autonomous AI Development System

## Build

Run locally:

```bash
docker compose up
```

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000  |
| Backend  | http://localhost:4000  |

Run tests:

```bash
cd backend && npm test          # 111 unit tests
cd e2e && npx playwright test   # E2E platform spec
```

---

## Overview

XPS Lead Intelligence operates as a self-directing AI development platform.  
Agents are coordinated by the **Cognitive Control Plane (CCP)** in  
`backend/src/services/ccp.ts` and routed through the **Kernel** in  
`backend/src/services/kernel.ts`.

---

## Agent Architecture

### Execution Order

```
research → planning → building → testing → validation → deployment
```

Agents run concurrently when their tasks have no inter-dependencies.  
Parallel execution is managed by Redis queue workers in  
`backend/src/services/worker.ts`.

---

## Agent Definitions

### 1. Research Agent (`researcher`)

**Role**: Framework discovery, market research, trend analysis.

**Allowed tools**: `github_search`, `github_list_repos`, `leads_search`  
**Kernel job type**: `research`  
**Priority**: 4  

Responsibilities:
- Scan GitHub projects and open-source ecosystems for relevant patterns
- Identify market gaps and high-value niches
- Produce structured research reports consumed by the Planner

---

### 2. Planner Agent (`planner`)

**Role**: System architecture design, task decomposition.

**Allowed tools**: All tools (wildcard `*`)  
**Kernel job type**: `plan`  
**Priority**: 3  

Responsibilities:
- Decompose high-level goals into ordered task graphs
- Assign tasks to appropriate agents
- Coordinate parallel execution pipelines
- Maintain the global task queue in Redis

---

### 3. Builder Agent (`builder`)

**Role**: Code generation, UI generation, API generation.

**Allowed tools**: `github_write_file`, `github_create_issue`,  
`github_create_pr`, `code_generate`, `sandbox_exec`, `railway_deploy`  
**Kernel job type**: `build`  
**Priority**: 3  

Responsibilities:
- Generate TypeScript/Python source files from specifications
- Create GitHub issues and pull requests
- Execute code in the Docker sandbox (`backend/src/services/docker.ts`)
- Trigger Railway deployments when validation passes

---

### 4. Scraper Agent (`scraper`)

**Role**: Data extraction, lead generation.

**Allowed tools**: `leads_search`, `leads_save`  
**Kernel job type**: `scrape`  
**Priority**: 5  

Responsibilities:
- Extract business leads from web sources using Cheerio + parallel HTTP
- Save structured lead records to PostgreSQL
- Apply lead scoring via `backend/src/services/lead-scoring.ts`

Scraper implementation: `backend/src/services/scraper.ts`

Supported sources:
- Yelp business listings
- YellowPages directories
- Direct URL crawling with configurable depth
- Proxy rotation support via environment variable `SCRAPER_PROXY_URL`

---

### 5. Validator Agent (`validator`)

**Role**: Test execution, system verification.

**Allowed tools**: `sandbox_exec`, `github_read_file`  
**Kernel job type**: `validate`  
**Priority**: 6  

Responsibilities:
- Run the Jest backend test suite (`cd backend && npm test`)
- Execute `npx tsc --noEmit` type-checking
- Verify API endpoints respond correctly
- Gate deployment: no deployment proceeds if validation fails

---

### 6. Deployment Agent (`deployment`)

**Role**: Railway deployment orchestration.

**Allowed tools**: `railway_deploy`, `railway_status`, `github_create_pr`  
**Kernel job type**: `deploy`  
**Priority**: 2  

Responsibilities:
- Trigger Railway service deployments
- Monitor deployment health via `/api/health`
- Roll back on health-check failure
- Report deployment status to the originating PR

---

### 7. Vision Cortex Agent (`vision-cortex`)

**Role**: Market opportunity detection, SaaS product generation.

**Allowed tools**: All research + builder tools  
**Kernel job type**: `vision`  
**Priority**: 1  

Responsibilities:
- Scan GitHub trending repos and startup ecosystems
- Detect profitable niches and underserved markets
- Generate SaaS product specifications
- Initiate full build pipelines for validated concepts
- Produce profitability analysis reports

Prompt: `.github/prompts/vision-cortex.prompt.md`

---

## Runtime Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Kernel | `backend/src/services/kernel.ts` | Lifecycle, tool registry, task scheduler, policy |
| CCP | `backend/src/services/ccp.ts` | Intent analysis, agent selection, execution gate |
| Worker | `backend/src/services/worker.ts` | Redis job queue, retry, dead-letter queue |
| Orchestrator | `backend/src/services/orchestrator.ts` | Groq LLM loop, 30+ tool-calling |
| Agent Tools | `backend/src/services/agent-tools.ts` | Tool implementations |

---

## Queue Architecture

Workers consume from Redis queues with the following priorities:

| Queue | Agent | Priority |
|-------|-------|----------|
| `validate` | Validator | 6 (highest) |
| `scrape` | Scraper | 5 |
| `research` | Researcher | 4 |
| `build` | Builder | 3 |
| `plan` | Planner | 3 |
| `deploy` | Deployment | 2 |
| `vision` | Vision Cortex | 1 |

Failed jobs are retried up to 3 times before being sent to the dead-letter queue (`DLQ`).

---

## Failure Handling

- **Auto retry**: 3 attempts with exponential back-off
- **Sandbox validation**: all generated code executes in Docker isolation before commit
- **Error reporting**: failures are logged via the Kernel audit log and surfaced to the agent API

---

## CI/CD Integration

Every push to `main` triggers:

1. `lint` — ESLint (0 errors required)
2. `typecheck` — `tsc --noEmit`
3. `test` — Jest (all tests must pass)
4. `build` — Production build
5. `e2e` — Playwright end-to-end suite
6. `deploy` — Railway deployment (only if `RAILWAY_TOKEN` secret is set)

Deployment is blocked if any earlier stage fails.

---

## Adding a New Agent

1. Add the agent type to `AgentType` in `backend/src/services/ccp.ts`
2. Register the agent in `AGENT_REGISTRY` with its allowed tools
3. Add a routing entry in `JOB_ROUTING` in `backend/src/services/kernel.ts`
4. Write tests in `backend/src/__tests__/`
5. Document the agent in this file
