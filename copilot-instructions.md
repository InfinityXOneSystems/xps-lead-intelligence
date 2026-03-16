# XPS Lead Intelligence — Copilot Instructions

## Repository Overview
XPS Lead Intelligence is a production-grade AI Operating System built as a monorepo with:
- **Backend**: Express.js + TypeScript + Prisma + PostgreSQL + Redis
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + React
- **AI**: Groq LLM (llama-3.1-70b-versatile) with 30+ tool-calling agent
- **Auth**: OAuth (Google/GitHub/Railway) + JWT
- **Deployment**: Railway (backend + frontend services)

## MANDATORY RULES — NO EXCEPTIONS

### 1. No Placeholders
- Every function must have a real implementation
- No `// TODO`, `throw new Error('not implemented')`, or mock returns in production code
- Every API route must connect to a real service or database

### 2. No Fake Data
- All UI components must fetch from real API endpoints
- No hardcoded mock arrays in production components
- If data isn't available, show a real empty state with clear messaging

### 3. Real Implementations Only
- Every button must have a real `onClick` handler that calls a real API
- Every form must submit to a real endpoint
- Every stat must come from a real database query

### 4. Every Change Must Compile
- Run `cd backend && npx tsc --noEmit` after backend changes
- Run `cd frontend && npm run build` after frontend changes
- Never commit code that doesn't compile

### 5. Every Critical Path Must Be Tested
- New API routes: add a test in `backend/src/__tests__/`
- Auth flows: update `auth.test.ts`
- Keep all 50 existing tests passing

### 6. Security Mandates
- Use `stripHtml()` from `backend/src/utils/sanitize.ts` for HTML stripping (never regex)
- No secrets in code — use environment variables only
- Validate all external URLs with `assertSafeExternalUrl()` in auth.ts (SSRF prevention)
- JWT_SECRET must be set in production or the process exits

### 7. Architecture Must Be Preserved
- Nav sections: dashboard, leads, scraper, outreach, agent, analytics, social, social-crm, github, editor, sandbox, connectors, settings
- `ActiveSection` type lives in `AppLayout.tsx`
- Auth context lives in `frontend/src/contexts/AuthContext.tsx`
- JWT stored in localStorage key `xps_session_token`
- Hydration fix: AppLayout uses `mounted` guard for next-themes (prevents SSR/CSR mismatch)

### 8. Design System
- Electric metallic design: CSS vars in `frontend/src/app/globals.css`
- Colors: `--electric-1: #00d2ff`, `--electric-2: #7b2ff7`, `--electric-3: #ff6b35`, `--bg-deep: #0a0a14`
- Card classes: `.card-electric` (animated gradient border), `.card-metallic` (subtle border)
- Never override the design system without updating `globals.css`

## Project Structure

```
xps-lead-intelligence/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── __tests__/          # Jest unit tests (50 tests, must all pass)
│   │   ├── db/prisma.ts        # Prisma client singleton
│   │   ├── index.ts            # Express app entry + route mounting
│   │   ├── routes/             # API route handlers
│   │   │   ├── auth.ts         # OAuth (Google/GitHub/Railway) + JWT
│   │   │   ├── leads.ts        # Lead CRUD + stats
│   │   │   ├── agent.ts        # LLM agent chat
│   │   │   ├── scraper (in leads.ts) # Web scraper
│   │   │   ├── email.ts        # Email templates + campaigns
│   │   │   ├── social.ts       # Social media accounts/posts
│   │   │   ├── outreach.ts     # Sheets, calendar, scoring, CSV
│   │   │   ├── github.ts       # GitHub App integration
│   │   │   ├── connectors.ts   # Connector health + config
│   │   │   └── admin.ts        # Admin config
│   │   └── services/           # Business logic services
│   ├── prisma/schema.prisma    # Database schema
│   ├── .eslintrc.json          # ESLint config (TypeScript rules)
│   └── jest.config.js          # Jest config (includes jest.setup.js)
│
├── frontend/                   # Next.js 15 app
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   │   ├── layout.tsx      # Root layout with Providers
│   │   │   ├── page.tsx        # Main page (renders AppLayout)
│   │   │   └── providers.tsx   # ThemeProvider + AuthProvider
│   │   ├── components/
│   │   │   ├── layout/         # AppLayout, LeftSidebar, CenterEditor, RightToolbar
│   │   │   ├── admin/          # AdminSettings (settings + connectors)
│   │   │   ├── agent/          # AgentChat + AutoRecommend
│   │   │   ├── leads/          # LeadsCRM, LiveScraper, LeadsDashboard
│   │   │   ├── email/          # EmailTemplates
│   │   │   ├── social/         # SocialMediaAgent, SocialCRM
│   │   │   ├── github/         # GitHubPanel
│   │   │   ├── editor/         # VisualEditor
│   │   │   └── sandbox/        # SandboxPanel
│   │   ├── contexts/AuthContext.tsx  # OAuth auth state
│   │   └── lib/api.ts          # API client with ****** injection
│   └── .eslintrc.json          # ESLint config (next/core-web-vitals)
│
├── e2e/                        # Playwright E2E tests
├── .github/workflows/
│   ├── deploy.yml              # Main CI/CD pipeline
│   └── health-check.yml        # Scheduled health checks
└── docs/                       # Architecture and operational docs
```

## Build & Test Commands

```bash
# Backend
cd backend
npm ci                    # Install dependencies
npm test                  # Run 50 Jest tests (must all pass)
npx tsc --noEmit          # TypeScript type check
npm run lint              # ESLint (0 errors required)
npm run build             # Build to dist/

# Frontend  
cd frontend
npm ci                    # Install dependencies
npm run lint              # Next.js ESLint (0 errors required)
npm run build             # Next.js production build

# E2E (requires running services)
cd e2e
npm ci && npx playwright install --with-deps chromium
npx playwright test
```

## Environment Variables

See `.env.example` for all required variables.

**Required for backend:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Strong random string (min 32 chars) — required in production
- `GROQ_API_KEY` — Groq LLM API key (free tier available)
- `REDIS_URL` — Redis connection string (optional, degrades gracefully)

**Required for OAuth:**
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET`
- `BACKEND_URL` — Public URL of backend (e.g. `https://your-app.railway.app`)
- `FRONTEND_URL` — Public URL of frontend

## Common Patterns

### Adding a new API route
```typescript
// backend/src/routes/my-feature.ts
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => {
  const data = await prisma.myModel.findMany();
  res.json(data);
});

export default router;
```
Then mount in `backend/src/index.ts`:
```typescript
import myFeatureRouter from './routes/my-feature';
app.use('/api/my-feature', myFeatureRouter);
```

### Adding a new frontend section
1. Add the section ID to `ActiveSection` type in `AppLayout.tsx`
2. Add nav item to `navItems` array in `LeftSidebar.tsx`
3. Add case in `CenterEditor.tsx` switch
4. Create component in appropriate folder

### Calling an authenticated API
```typescript
// All API calls go through lib/api.ts which injects JWT automatically
import { api } from '@/lib/api';
const data = await api.get('/my-endpoint');
```
