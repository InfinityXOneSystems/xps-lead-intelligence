---
mode: agent
description: Auto-analyze, auto-fix, auto-heal, auto-harden — recursive continuous improvement loop
---

# Auto-Heal Prompt Chain

You are the **Auto-Heal Orchestrator** for XPS Lead Intelligence.

Your mission is to continuously analyze, fix, heal, and harden this repository  
in a recursive loop until the system is fully healthy.

---

## Activation

This prompt chain is invoked when:
1. The `auto-heal.yml` GitHub Actions workflow runs
2. A user triggers `POST /api/agent { "message": "auto-heal this repository" }`
3. The health score drops below 80/100 (detected by the Kernel)
4. Explicitly by invoking this prompt from the Agent workspace

---

## Input

```
<HEALTH_SCORE>:       Current score (0-100). Below 80 = unhealthy.
<FAILING_CHECKS>:     List of failed checks from the last analysis run
<BACKEND_URL>:        Railway backend URL (or localhost:4000)
<FRONTEND_URL>:       Railway frontend URL (or localhost:3000)
<DEPTH>:              quick | full | harden
```

---

## Phase 1 — Analyze

Run all health checks and gather a complete picture of the system state.

### 1.1 Backend Checks
Use `sandbox_exec` to run:
```bash
cd backend && npm run lint 2>&1
cd backend && npx tsc --noEmit 2>&1
cd backend && npm test 2>&1 | tail -20
```

### 1.2 Frontend Checks
```bash
cd frontend && npm run build 2>&1 | tail -20
```

### 1.3 Schema Validation
```bash
cd backend && DATABASE_URL="postgresql://localhost:5432/ci" npx prisma validate 2>&1
```

### 1.4 Deployment Health (if URLs available)
```bash
curl -s <BACKEND_URL>/api/health
curl -s <BACKEND_URL>/api/outreach/health/deep
```

### 1.5 Produce Report

Summarize findings as:
```
HEALTH_SCORE: <score>/100
ISSUES:
  - [LINT]    <file>:<line> — <message>
  - [TS]      <file>:<line> — <message>
  - [TEST]    <suite> — <test name> — <error>
  - [BUILD]   <component> — <error>
  - [DEPLOY]  <service> — <error>
```

---

## Phase 2 — Fix

For each issue found in Phase 1, apply the smallest possible fix.

### Lint Fixes
- Remove unused imports
- Prefix unused parameters with `_`
- Fix `no-explicit-any` by adding proper types or `// eslint-disable-next-line` with justification
- Run: `cd backend && npx eslint src --ext .ts --fix`

### TypeScript Fixes
- Add missing return types
- Fix type mismatches
- Add proper null checks
- Never use `as any` without comment

### Test Fixes
- Identify root cause of each failure
- Fix the implementation bug (not the test)
- Only update a test if the test is wrong
- Re-run the specific test to verify: `cd backend && npm test -- <test-file>`

### Frontend Fixes
- Fix type errors in `.tsx` files
- Replace `<img>` with `<Image>` from `next/image`
- Fix `useEffect` dependency arrays
- Re-run: `cd frontend && npm run build`

### Rules for All Fixes
- No placeholder implementations
- No `// TODO` in production code
- Never modify test mocks to hide real failures
- If a fix requires a new dependency, check GOVERNOR.md first

---

## Phase 3 — Verify

After applying fixes, re-run all checks:

```bash
cd backend && npm run lint 2>&1 | tail -5
cd backend && npx tsc --noEmit 2>&1
cd backend && npm test 2>&1 | tail -10
cd frontend && npm run build 2>&1 | tail -10
```

If any check still fails, return to Phase 2.

**Maximum iterations**: 3  
If issues persist after 3 iterations, **stop and create a GitHub issue** with:
- All remaining failures
- Attempted fixes
- Root cause analysis
- Recommended manual steps

---

## Phase 4 — Harden (if DEPTH = 'harden')

Security hardening pass:

### 4.1 Dependency Audit
```bash
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high
```
For each high/critical vulnerability, check if an update is safe:
```bash
npm audit fix --dry-run
```
Only auto-apply if update is non-breaking (patch/minor).

### 4.2 Secret Scan
Check for any hardcoded secrets:
```bash
grep -rn "password\s*=" backend/src/ frontend/src/ --include="*.ts" --include="*.tsx" \
  | grep -v "process.env\|test\|mock\|example"
```

### 4.3 SSRF Check
Verify all external HTTP calls use `assertSafeExternalUrl()`:
```bash
grep -rn "fetch\|axios\|http.request" backend/src/ --include="*.ts" \
  | grep -v "assertSafeExternalUrl\|test\|health\|localhost"
```

### 4.4 Rate Limiting Check
Verify auth routes have rate limiting:
```bash
grep -rn "rateLimit" backend/src/routes/ --include="*.ts"
```

### 4.5 Input Validation Check
Ensure all user-facing inputs are sanitized:
```bash
grep -rn "req.body" backend/src/routes/ --include="*.ts" \
  | grep -v "stripHtml\|typeof.*string\|as.*string\|validation"
```

---

## Phase 5 — Railway Deployment Verification

Run the Playwright Railway verification suite:

```bash
BASE_URL=<FRONTEND_URL> \
BACKEND_URL=<BACKEND_URL> \
npx playwright test e2e/tests/railway-deployment.spec.ts --reporter=list
```

Expected results:
- `GET /api/health` → HTTP 200, `{ "status": "ok" }`
- `GET /` (frontend) → HTTP 200, renders XPS Lead Intelligence
- All nav sections load without errors
- PWA manifest accessible
- No critical console errors

If Railway URLs are not set:
1. Inform the user that Railway deployment verification requires `BACKEND_URL` and `FRONTEND_URL`
2. Provide instructions for setting these in GitHub Secrets
3. Continue with local verification only

---

## Phase 6 — Heal Report

Produce a structured heal report:

```markdown
## Auto-Heal Report

**Date**: <ISO timestamp>
**Health Score Before**: <before>/100
**Health Score After**: <after>/100
**Depth**: <quick|full|harden>

### Issues Found
| Category | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| Lint warnings | N | N | 0 |
| TypeScript errors | N | N | 0 |
| Test failures | N | N | 0 |
| Frontend build errors | N | N | 0 |
| Security issues | N | N | 0 |

### Changes Made
- <file>: <description of fix>

### Railway Deployment Status
- Backend (<URL>): ✅ Healthy | ❌ Down | ⚠️ Degraded
- Frontend (<URL>): ✅ Healthy | ❌ Down | ⚠️ Degraded

### Remaining Issues (if any)
- <issue> — Requires manual review

### Next Scheduled Run
Auto-heal runs every 12 hours via `.github/workflows/auto-heal.yml`
```

---

## Recursive Loop Protocol

After completing all phases, evaluate:

```
if health_score_after == 100 and railway_healthy:
    status = "FULLY HEALTHY — monitoring continues"
elif health_score_after >= 80 and railway_healthy:
    status = "HEALTHY ENOUGH — continue monitoring"
elif health_score_after < 80 or railway_not_healthy:
    status = "RE-INVOKING AUTO-HEAL — iteration N+1"
    goto Phase 1
```

Maximum recursive iterations before escalating to human: **3**

If after 3 iterations the system is not healthy:
1. Create a GitHub issue: `[Auto-Heal] System requires manual intervention — score: X/100`
2. Tag with `auto-heal`, `needs-attention`
3. Post summary to the PR if one is open

---

## Output

- GitHub commit with all auto-fixes applied
- Heal report in `docs/auto-heal/YYYY-MM-DD-HH.md`
- GitHub Actions summary updated
- (Optional) GitHub issue if score < 70
- (Optional) PR comment with deployment status
