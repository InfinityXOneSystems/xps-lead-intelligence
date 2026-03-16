---
applyTo: "backend/**"
---
# Backend Instructions (Express.js + TypeScript)

## Stack
- Express.js + TypeScript 5
- Prisma ORM + PostgreSQL
- Redis (optional, graceful degradation)
- Groq SDK (LLM)
- Jest + supertest (testing)

## Rules
- Every route must be typed — use `Request`, `Response` from `express`
- Every Prisma call must be in a try/catch with proper error response
- Never expose raw database errors to the client — sanitize error messages
- Use `stripHtml()` from `utils/sanitize.ts` for any HTML → text conversion
- Never use `/<[^>]+>/g` regex for HTML stripping
- Rate limiting is pre-configured on auth routes via `express-rate-limit`
- All external HTTP calls must go through `assertSafeExternalUrl()` (SSRF guard)

## Adding Routes
1. Create `src/routes/my-feature.ts`
2. Import and mount in `src/index.ts` at `/api/my-feature`
3. Add test in `src/__tests__/my-feature.test.ts`
4. Run `npx tsc --noEmit` to verify types

## Testing
- Always mock `../db/prisma` with `jest.mock('../db/prisma', () => ({...}))`
- Run: `npm test` (must show 50+ passing, 0 failing)
- JWT_SECRET is set in `jest.setup.js` — no need to set in individual tests

## Error Handling Pattern
```typescript
router.get('/path', async (req: Request, res: Response) => {
  try {
    const result = await prisma.model.findMany();
    res.json(result);
  } catch (err) {
    console.error('Failed to fetch:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Environment Variables
- Never hardcode secrets — use `process.env.VAR_NAME`
- JWT_SECRET must be set in production or app will exit
- See `.env.example` for full list
