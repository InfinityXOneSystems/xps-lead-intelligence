# Governor

**Status**: ENFORCED  
**Version**: 1.0  
**Last Updated**: 2026-03-15

This document defines the governance rules for the XPS Lead Intelligence platform. All contributors, automated agents (including GitHub Copilot), and CI systems must comply.

---

## 1. Allowed Technology Stack

The following technologies are approved for use in this repository. Adding a new technology outside this list requires an architectural review documented in a PR.

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 LTS | Runtime |
| TypeScript | 5.x | Type safety |
| Express.js | 4.x | HTTP server |
| Prisma | 5.x | ORM + migrations |
| PostgreSQL | 15+ | Primary database |
| Redis / ioredis | 7+ | Cache, queues |
| Groq SDK | latest | LLM inference |
| @octokit/rest | latest | GitHub API |
| Dockerode | latest | Container SDK |
| sanitize-html | latest | HTML sanitization |
| express-rate-limit | latest | Rate limiting |
| jsonwebtoken | latest | JWT auth |
| Jest + ts-jest | latest | Unit testing |
| Supertest | latest | HTTP testing |
| ESLint + @typescript-eslint | 8.x | Linting |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | App framework (App Router only) |
| TypeScript | 5.x | Type safety |
| React | 18 | UI rendering |
| Tailwind CSS | 3.x | Styling |
| next-themes | latest | Light/dark mode |
| Lucide React | latest | Icons |
| ESLint (next/core-web-vitals) | 8.x | Linting |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| GitHub Actions | CI/CD |
| Railway | Production runtime |
| nixpacks | Build system (Railway) |
| Docker | Sandbox execution |
| Playwright | E2E testing |

---

## 2. Forbidden Patterns

The following patterns are explicitly prohibited:

### Code Quality
- ❌ `// TODO:` stubs in production code (use GitHub Issues instead)
- ❌ Placeholder functions that return hardcoded/mock data in production
- ❌ `console.log` for structured logging (use proper log levels)
- ❌ `any` TypeScript type without inline comment explaining why
- ❌ Raw SQL queries — use Prisma ORM exclusively
- ❌ Inline secrets or API keys in any file
- ❌ `/<[^>]+>/g` regex for HTML stripping — use `stripHtml()` from `utils/sanitize.ts`
- ❌ Direct `fetch()` calls in frontend components — use `lib/api.ts`
- ❌ Modifying `node_modules/` or committing build artifacts

### Architecture
- ❌ Adding new nav sections without updating `AppLayout.tsx`, `LeftSidebar.tsx`, AND `CenterEditor.tsx`
- ❌ Bypassing JWT auth on protected routes
- ❌ Calling external URLs without `assertSafeExternalUrl()` validation (SSRF prevention)
- ❌ Adding paid-only required dependencies for core operation
- ❌ Storing secrets in database (store references/metadata only)
- ❌ Removing or weakening the mounted/useEffect hydration guard in `AppLayout.tsx`

### CI/Deployment
- ❌ Merging to `main` with failing CI checks
- ❌ Deploying without running migrations
- ❌ Hardcoding environment-specific values in source code
- ❌ Committing `.env` files or secrets

### Security
- ❌ Unauthorized credential extraction (only owner's own systems)
- ❌ Scraping private/authenticated content without authorization
- ❌ Prompt injection — all external content must be sanitized before LLM input
- ❌ Disabling rate limiting without architectural justification

---

## 3. Deployment Rules

### Required Before Any Deploy to `main`
1. ✅ All CI checks pass (`lint`, `typecheck`, `test`, `build`)
2. ✅ All 50 backend unit tests pass
3. ✅ Backend TypeScript compiles without errors
4. ✅ Frontend Next.js build succeeds
5. ✅ ESLint reports 0 errors (warnings are acceptable)
6. ✅ Prisma migrations are valid (run `prisma migrate deploy` in CI)

### Railway Deployment
- Backend starts on `PORT=4000` via `npm start`
- Frontend starts on `PORT=3000` via `npm start`
- Pre-deploy command: `npx prisma migrate deploy && npx prisma generate`
- Health check: `GET /api/health` must return 200 within 30 seconds
- Max 3 restart retries on failure

### Environment Variables
- All secrets must be set in Railway service environment variables
- Never set secrets as Railway build-time variables (they get baked into images)
- `JWT_SECRET` must be set in production — missing causes immediate `process.exit(1)`
- See `docs/ENVIRONMENT.md` for full variable reference

---

## 4. Security Rules

### Authentication
- All non-public routes require JWT `Authorization: Bearer <token>` header
- JWT TTL: 30 days
- JWT secret: minimum 32 characters, generated with `openssl rand -base64 32`
- Session storage: `localStorage` key `xps_session_token`

### Input Validation
- All user-supplied strings must be validated for type, length, and character set
- HTML inputs must go through `stripHtml()` before storage or LLM input
- Railway tokens: max 512 chars, alphanumeric + `._-` only

### External Requests
- All external HTTP requests must call `assertSafeExternalUrl()` first
- Blocked: localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x (AWS metadata)
- HTTPS only for external API calls

### Rate Limiting
- Auth routes: 20 requests per 15 minutes per IP
- Do not remove or weaken rate limiters

### Secrets
- No secrets in code, ever
- Use `process.env.VARIABLE_NAME` only
- Log secret names in health checks, never values

---

## 5. CI Requirements

Every pull request to `main` must pass:

| Check | Tool | Required |
|-------|------|---------|
| Backend lint | ESLint | ✅ 0 errors |
| Frontend lint | next lint | ✅ 0 errors |
| TypeScript | tsc --noEmit | ✅ 0 errors |
| Unit tests | Jest | ✅ 50/50 pass |
| Backend build | tsc | ✅ success |
| Frontend build | next build | ✅ success |

E2E tests (Playwright) run on push to `main` only.

---

## 6. Architecture Drift Prevention

To prevent architectural drift:

1. **Before adding a new service**: Document it in `docs/ARCHITECTURE_CONTRACT.md`
2. **Before adding a new database model**: Add it to the data domains list in the contract
3. **Before adding a new API route**: Mount it in `backend/src/index.ts` and document in `docs/ARCHITECTURE.md`
4. **Before changing the nav structure**: Update all three files (`AppLayout.tsx`, `LeftSidebar.tsx`, `CenterEditor.tsx`) in the same commit
5. **Before adding a new environment variable**: Add it to `.env.example` and `docs/ENVIRONMENT.md`

---

## 7. Change Review Process

1. Create a feature branch from `main`
2. Implement changes following this Governor document
3. Run local checks: `npm run lint && npx tsc --noEmit && npm test`
4. Open a Pull Request against `main`
5. CI must pass automatically
6. At least one review approval required (enforced via branch protection)
7. Merge only when all checks are green
