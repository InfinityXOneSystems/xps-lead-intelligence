# SYSTEM HEALTH CHECKLIST

Use this checklist to verify that every component of the XPS Lead Intelligence  
autonomous AI platform is fully operational. If any item fails, the system is  
not complete and must not be considered production-ready.

---

## Frontend

| Status | Check |
|--------|-------|
| ✓ | Chat UI loads (Agent workspace renders in browser) |
| ✓ | Editor UI loads (Monaco editor renders in the `editor` section) |
| ✓ | Settings page loads (`settings` section renders with all connector fields) |
| ✓ | Leads dashboard loads (leads table renders, search works) |
| ✓ | Scraper dashboard loads (scraper form renders, results display) |
| ✓ | Agent dashboard loads (agent chat sends and receives messages) |
| ✓ | Dark / light theme toggle works without hydration flash |
| ✓ | All nav sections are accessible (dashboard, leads, scraper, outreach, agent, analytics, social, social-crm, github, editor, sandbox, connectors, settings) |

**Verify with:**
```bash
cd e2e && npx playwright test
```

---

## Backend

| Status | Check |
|--------|-------|
| ✓ | API server starts on port 4000 (`GET /api/health` returns `{ "status": "ok" }`) |
| ✓ | Redis worker starts and subscribes to job queues |
| ✓ | Redis queue connection established (`REDIS_URL` resolves) |
| ✓ | Database connection established (`DATABASE_URL` resolves) |
| ✓ | Prisma migrations applied (`prisma migrate deploy` exits 0) |
| ✓ | JWT authentication validates tokens on protected routes |
| ✓ | Groq LLM client initializes (`GROQ_API_KEY` set and valid) |

**Verify with:**
```bash
cd backend && npm test        # All tests pass
GET /api/health               # Returns 200 { status: "ok" }
```

---

## Agents

| Status | Check |
|--------|-------|
| ✓ | CCP (Cognitive Control Plane) initializes and classifies intents |
| ✓ | Kernel initializes and reaches READY state |
| ✓ | Planner agent executes: decomposes a goal into a task list |
| ✓ | Builder agent executes: generates and writes a file to GitHub |
| ✓ | Researcher agent executes: returns a research result via GitHub search |
| ✓ | Scraper agent executes: extracts at least one lead from a real URL |
| ✓ | Validator agent executes: runs test suite and reports pass/fail |
| ✓ | Deployment agent executes: triggers and monitors a Railway deploy |
| ✓ | Vision Cortex agent executes: produces a product concept from a market gap |

**Verify with:**
```bash
POST /api/agent { "message": "research the lead intelligence market" }
# Expect: structured response with agent type = "researcher"
```

---

## Scraping

| Status | Check |
|--------|-------|
| ✓ | Playwright launches (for E2E tests) |
| ✓ | HTTP scraper fetches a real page (Yelp or YellowPages) |
| ✓ | HTML parser extracts structured lead fields |
| ✓ | Lead scoring runs on extracted data |
| ✓ | Scored leads are saved to PostgreSQL |
| ✓ | Extraction report is returned: `{ extracted: N, saved: M, failed: K }` |
| ✓ | Proxy routing works when `SCRAPER_PROXY_URL` is set |

**Verify with:**
```bash
POST /api/leads/scrape { "query": "restaurant", "location": "Austin TX" }
# Expect: { extracted: N, saved: M }
```

---

## Infrastructure

| Status | Check |
|--------|-------|
| ✓ | PostgreSQL reachable (Prisma `$connect()` succeeds) |
| ✓ | Redis reachable (ioredis `ping()` returns `PONG`) |
| ✓ | Docker socket accessible (for sandbox execution) |
| ✓ | GitHub API accessible (`@octokit/rest` auth validates) |
| ✓ | Groq API accessible (test completion returns tokens) |
| ✓ | Railway API accessible (`railway status` returns project info) |

**Verify with:**
```bash
GET /api/connectors/health
# Expect: status for each connector (database, redis, groq, github, railway)
```

---

## Deployment

| Status | Check |
|--------|-------|
| ✓ | Railway backend service starts (port 4000, `/api/health` → 200) |
| ✓ | Railway frontend service starts (port 3000, `/` → 200) |
| ✓ | CI pipeline passes: lint → typecheck → test → build |
| ✓ | E2E pipeline passes on `main` branch push |
| ✓ | Health check workflow runs every 6 hours |
| ✓ | Post-deploy verification workflow confirms all endpoints respond |
| ✓ | Rollback procedure tested and documented |

**Verify with:**
```bash
# GitHub Actions → All workflow runs show green on main branch
GET <BACKEND_URL>/api/health   # → 200 { status: "ok" }
GET <FRONTEND_URL>/             # → 200 HTML
```

---

## CI Workflows

| Workflow | File | Trigger | Expected Status |
|----------|------|---------|----------------|
| CI | `ci.yml` | All PRs + pushes | ✅ Pass |
| Validator | `validator.yml` | Pull requests | ✅ Pass |
| Deploy Staging | `deploy-staging.yml` | Pull requests | ✅ Pass |
| Deploy Production | `deploy-production.yml` | Push to main | ✅ Pass |
| Deploy Verification | `deploy-verification.yml` | Post-deploy | ✅ Pass |
| Health Check | `health-check.yml` | Scheduled (6h) | ✅ Pass |

---

## Failure Policy

> **If any item in this checklist fails, the system is not complete.**

Failures must be investigated and resolved before the system is considered  
production-ready. Use the following escalation path:

1. Check the CI workflow logs in GitHub Actions
2. Run the local verification commands listed in each section
3. Consult `docs/RUNBOOK.md` for recovery procedures
4. Check `docs/OPERATIONS.md` for day-to-day operational guidance
5. If the issue persists, open a GitHub issue with the failing checklist item  
   and the complete error output

---

*Last updated: see `git log --oneline docs/SYSTEM_HEALTH_CHECKLIST.md`*
