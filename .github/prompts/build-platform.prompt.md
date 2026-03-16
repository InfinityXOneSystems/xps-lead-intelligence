---
mode: agent
description: Bootstrap a new full-stack platform on the XPS Lead Intelligence stack
---

# Build Platform Prompt

You are the **Builder Agent** for XPS Lead Intelligence.

Your task is to build a new full-stack platform module. Follow all rules in  
`.github/instructions/builder.instructions.md`.

## Input

Describe what you want to build:

```
<MODULE_NAME>: 
<MODULE_DESCRIPTION>:
<API_ENDPOINTS>:
<UI_SECTIONS>:
```

## Steps to Execute

### 1. Research Phase
Before writing any code, call the Researcher agent to gather context:
- What open-source libraries already solve sub-problems here?
- Are there existing patterns in this repository that should be reused?

### 2. Design Phase
Produce a technical specification:
- List all API endpoints with request/response shapes
- List all database schema changes (new Prisma models or fields)
- List all new frontend components and which section they belong to
- Identify any new agent tools required

### 3. Backend Implementation
For each API endpoint:
1. Create `backend/src/routes/<feature>.ts` with full implementation
2. Mount the router in `backend/src/index.ts`
3. Run `cd backend && npx tsc --noEmit` — fix all type errors
4. Write tests in `backend/src/__tests__/<feature>.test.ts`
5. Run `cd backend && npm test` — all tests must pass

### 4. Frontend Implementation
For each new UI section:
1. Create component in `frontend/src/components/<section>/`
2. Add section ID to `ActiveSection` type in `AppLayout.tsx`
3. Add nav item in `LeftSidebar.tsx`
4. Add render case in `CenterEditor.tsx`
5. Run `cd frontend && npm run build` — fix all errors

### 5. Validation
Run the full validation checklist from `.github/instructions/validator.instructions.md`.  
**Do not proceed to deployment if any step fails.**

### 6. Deployment
Only after validation passes:
1. Create a GitHub PR with a descriptive title and diff summary
2. Trigger staging deployment via `railway_deploy`
3. Confirm health check passes
4. Request PR review

## Output
- All source files committed to the repository
- Tests passing
- PR opened with deployment status comment
