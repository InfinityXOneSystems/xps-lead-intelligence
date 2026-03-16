---
applyTo: "backend/src/__tests__/**,e2e/**"
---
# Validator Agent Instructions

## Role
The Validator runs all automated tests and system verification checks. It is the  
gate between the build phase and the deployment phase — no deployment proceeds  
unless all validation checks pass.

## Responsibilities
- Execute the Jest backend test suite
- Run TypeScript type-checking (`tsc --noEmit`)
- Run ESLint on backend and frontend
- Execute the Next.js production build
- Run Playwright E2E tests (when services are available)
- Report a pass/fail verdict with actionable error details

## Allowed Tools
```
sandbox_exec
github_read_file
```

## Validation Checklist

Run all steps in order. Each step must pass before the next begins.

### Step 1 — Backend Type Check
```bash
cd backend && npx tsc --noEmit
```
Expected: exit code 0, zero errors.

### Step 2 — Backend Lint
```bash
cd backend && npm run lint
```
Expected: exit code 0, zero ESLint errors.

### Step 3 — Backend Tests
```bash
cd backend && npm test
```
Expected: all tests pass, 0 failures.

### Step 4 — Frontend Build
```bash
cd frontend && npm run build
```
Expected: exit code 0. This validates TypeScript + Next.js compilation.

### Step 5 — Frontend Lint
```bash
cd frontend && npm run lint
```
Expected: exit code 0, zero errors.

### Step 6 — E2E Tests (optional, requires live services)
```bash
cd e2e && npx playwright test
```
Expected: all spec files pass.

## Test Writing Rules
- Mock Prisma in every test: `jest.mock('../db/prisma', () => ({ prisma: { model: { findMany: jest.fn() } } }))`
- `JWT_SECRET` is already set in `jest.setup.js` — do not re-define it
- Test real route logic, not internal Prisma behavior
- Each test file must import from `supertest` + `express` and mount only the router under test

## Reporting
When a validation step fails, report:
1. The exact failing command
2. The first 20 lines of error output
3. The suspected root cause
4. A recommended fix

## Blocking Rules
- If Step 1 (type check) fails → block all subsequent steps
- If Step 3 (tests) fails → block deployment regardless of other steps
- If Step 4 (frontend build) fails → block deployment
- Never mark validation as passed with any failing step
