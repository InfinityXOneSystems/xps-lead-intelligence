# XPS Lead Intelligence — GitHub Copilot Instructions

## Autonomous AI Platform Overview

XPS Lead Intelligence is a self-operating AI development platform.  
Agents are coordinated by the **Cognitive Control Plane (CCP)** and run through  
the **Kernel** runtime. All code must integrate with this agent architecture.

For the full agent architecture, see: [`AGENTS.md`](../AGENTS.md)

## Technology Stack

**Backend**: Express.js + TypeScript 5 + Prisma + PostgreSQL + Redis  
**Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS + React  
**AI**: Groq LLM (llama-3.1-70b-versatile) + 30+ tool-calling agent  
**Auth**: OAuth (Google / GitHub / Railway) + JWT  
**Deployment**: Railway (backend + frontend services)  
**Agents**: CCP → Kernel → Worker (Redis queues) → Orchestrator  

---

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
- Keep all existing tests passing
- CI blocks merges if any test fails

### 6. Security Mandates
- Use `stripHtml()` from `backend/src/utils/sanitize.ts` for HTML stripping (never regex)
- No secrets in code — use environment variables only
- Validate all external URLs with `assertSafeExternalUrl()` (SSRF prevention)
- JWT_SECRET must be set in production or the process exits

### 7. Architecture Must Be Preserved
- Nav sections: dashboard, leads, scraper, outreach, agent, analytics, social,  
  social-crm, github, editor, sandbox, connectors, settings
- `ActiveSection` type lives in `AppLayout.tsx`
- Auth context lives in `frontend/src/contexts/AuthContext.tsx`
- JWT stored in localStorage key `xps_session_token`
- Hydration fix: AppLayout uses `mounted` guard for next-themes

### 8. Design System
- CSS vars in `frontend/src/app/globals.css`
- Colors: `--electric-1: #00d2ff`, `--electric-2: #7b2ff7`, `--electric-3: #ff6b35`
- Card classes: `.card-electric` (animated gradient), `.card-metallic` (subtle)

### 9. API Calls (Frontend)
- Always use `lib/api.ts` — it injects JWT automatically
- Never use `fetch()` directly in components

### 10. Agent Integration
- New agent types: add to `AgentType` in `backend/src/services/ccp.ts`
- New tools: add to `AGENT_REGISTRY` + `agent-tools.ts`
- New job routes: add to `JOB_ROUTING` in `backend/src/services/kernel.ts`

---

## Build & Test Commands

```bash
# Backend
cd backend && npm test              # Run all Jest tests (must pass)
cd backend && npx tsc --noEmit     # TypeScript type check
cd backend && npm run lint         # ESLint (0 errors required)
cd backend && npm run build        # Production build

# Frontend
cd frontend && npm run build       # Next.js build + type check
cd frontend && npm run lint        # ESLint (0 errors required)

# E2E (requires running services)
cd e2e && npx playwright test
```

---

## Project Structure

```
xps-lead-intelligence/
├── AGENTS.md                       # Agent architecture & registry
├── backend/src/
│   ├── services/
│   │   ├── kernel.ts               # Kernel: lifecycle, tool registry, scheduler
│   │   ├── ccp.ts                  # CCP: intent analysis, agent selection
│   │   ├── worker.ts               # Redis job queue, retry, DLQ
│   │   ├── orchestrator.ts         # Groq LLM loop + tool execution
│   │   ├── agent-tools.ts          # 30+ tool implementations
│   │   └── scraper.ts              # Async parallel web scraper
│   ├── routes/                     # Express route handlers
│   └── __tests__/                  # Jest unit tests
├── frontend/src/
│   ├── components/layout/          # AppLayout, LeftSidebar, CenterEditor
│   ├── contexts/AuthContext.tsx    # OAuth auth state
│   └── lib/api.ts                  # Authenticated API client
├── .github/
│   ├── copilot-instructions.md     # This file
│   ├── instructions/               # Per-agent Copilot instructions
│   └── prompts/                    # Reusable Copilot prompts
└── docs/                           # Architecture and operational docs
```

---

## Adding a New Agent

1. Add type to `AgentType` in `backend/src/services/ccp.ts`
2. Register in `AGENT_REGISTRY` with description + allowed tools
3. Add routing entry in `JOB_ROUTING` in `backend/src/services/kernel.ts`
4. Add tests in `backend/src/__tests__/`
5. Document in `AGENTS.md`

## Adding a New API Route

```typescript
// backend/src/routes/my-feature.ts
import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await prisma.myModel.findMany();
    res.json(result);
  } catch (err) {
    console.error('Failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

Mount in `backend/src/index.ts`:
```typescript
import myFeatureRouter from './routes/my-feature';
app.use('/api/my-feature', myFeatureRouter);
```

## Calling an Authenticated API (Frontend)

```typescript
import { api } from '@/lib/api';
const data = await api.get('/my-endpoint');
const result = await api.post('/my-endpoint', { key: 'value' });
```
