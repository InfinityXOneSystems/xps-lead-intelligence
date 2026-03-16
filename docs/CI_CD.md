# CI/CD Guide

## Pipeline Overview

CI/CD is defined in `.github/workflows/deploy.yml` and runs on:
- **Pull Requests** to `main`: lint + typecheck + test + build
- **Push to `main`**: lint + typecheck + test + build + e2e + deploy

## Jobs

### 1. Lint (`lint`)
Runs ESLint on both backend and frontend.

```bash
# Backend
cd backend && npm ci && npm run lint

# Frontend
cd frontend && npm ci && npm run lint
```

**Requires**: `.eslintrc.json` in both `backend/` and `frontend/`
**Pass criteria**: 0 ESLint errors (warnings are OK)

### 2. TypeScript Check (`typecheck`)
```bash
cd backend && npm ci && npx tsc --noEmit
```

**Pass criteria**: 0 type errors

### 3. Unit Tests (`test`)
```bash
cd backend && npm test
```

**Pass criteria**: All 50 tests pass (0 failures)

**Environment**: `JWT_SECRET=test-secret-for-ci` and `NODE_ENV=test` are set in the workflow

### 4. Build (`build`)
```bash
cd backend && npm run build
cd frontend && npm run build
```

**Pass criteria**: Both builds succeed without errors

### 5. E2E Tests (`e2e`) — Push to main only
Spins up Postgres + Redis, starts backend + frontend, runs Playwright.

**Pass criteria**: All E2E tests pass

### 6. Deploy to Railway (`deploy`) — Push to main only
```bash
railway up --service backend
railway up --service frontend
```

**Requires**: `RAILWAY_TOKEN` secret set in GitHub repo settings
**Note**: If `RAILWAY_TOKEN` is not set, deployment is skipped with a warning (not a failure)

## Required GitHub Secrets

| Secret | When Needed | How to Get |
|--------|-------------|-----------|
| `RAILWAY_TOKEN` | Deploy job | [railway.app/account/tokens](https://railway.app/account/tokens) |
| `NEXT_PUBLIC_API_URL` | Build job | Your Railway backend URL |

## Why CI Shows `action_required`

GitHub requires workflow approval when the triggering actor is a bot (like GitHub Copilot). A repository owner must click "Approve and run" in the Actions tab for bot-triggered PRs.

To remove this requirement:
1. Go to repository Settings → Actions → General
2. Under "Fork pull request workflows", select "Allow all actions and reusable workflows"

## Adding a New CI Check

Add a new job to `.github/workflows/deploy.yml`:

```yaml
my-check:
  name: My Check
  runs-on: ubuntu-latest
  needs: [lint]        # What must pass first
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Run My Check
      run: echo "Add check here"
```

## Local CI Simulation

```bash
# Simulate lint
cd backend && npm run lint
cd frontend && npm run lint

# Simulate typecheck
cd backend && npx tsc --noEmit

# Simulate unit tests
cd backend && npm test

# Simulate builds
cd backend && npm run build
cd frontend && npm run build
```

## Artifacts

The CI uploads these artifacts:
- `coverage` — Jest code coverage report (from unit test job)
- `playwright-report` — Playwright test report (from e2e job)

## Troubleshooting CI

| Problem | Solution |
|---------|---------|
| `ESLint couldn't find a configuration file` | Check `.eslintrc.json` exists in `backend/` and `frontend/` |
| `JWT_SECRET not set` warning in tests | `jest.setup.js` sets `JWT_SECRET` — check `jest.config.js` includes `setupFiles: ['./jest.setup.js']` |
| `Force exiting Jest` warning | Normal — `express-rate-limit` has an internal timer. Tests still pass. |
| Frontend build fails with env var | `NEXT_PUBLIC_API_URL` defaults to `http://localhost:4000` if not set |
| Deploy step skipped | Set `RAILWAY_TOKEN` in GitHub repository secrets |
