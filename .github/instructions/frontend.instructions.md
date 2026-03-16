---
applyTo: "frontend/**"
---
# Frontend Instructions (Next.js 15 + TypeScript)

## Stack
- Next.js 15 App Router (NOT Pages Router)
- TypeScript 5
- Tailwind CSS 3
- next-themes for dark/light mode
- Lucide React icons

## Critical: Hydration Fix
The theme toggle (Sun/Moon icon) uses a `mounted` + `useEffect` guard in `AppLayout.tsx`.
This prevents the SSR/CSR mismatch from `next-themes` that resets ALL `useState` in the tree.
**Never remove or bypass this pattern.**

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
// Render placeholder until mounted to prevent layout shift
{mounted ? <ThemeIcon /> : <span className="w-4 h-4 block" suppressHydrationWarning />}
```

## Navigation Pattern
- `ActiveSection` type is defined in `AppLayout.tsx`
- Nav items in `LeftSidebar.tsx`
- Section rendering in `CenterEditor.tsx`
- To add a new section: update all three files

## API Calls
Always use `lib/api.ts` — it injects JWT automatically:
```typescript
import { api } from '@/lib/api';
const data = await api.get('/endpoint');
const result = await api.post('/endpoint', { key: 'value' });
```
Never use `fetch()` directly in components.

## Design System
Use CSS variables defined in `globals.css`:
- `--electric-1: #00d2ff` (cyan)
- `--electric-2: #7b2ff7` (purple)  
- `--electric-3: #ff6b35` (orange)
- `--bg-deep: #0a0a14` (dark background)
- Class `.card-electric` = animated gradient border
- Class `.card-metallic` = subtle metallic border

## Auth
Import from `@/contexts/AuthContext`:
```typescript
const { auth, anyConnected, loginGoogle, loginGithub } = useAuth();
```

## Image Optimization
Prefer `<Image>` from `next/image` over `<img>` for performance.
Use `<img>` only for dynamic/external images where `<Image>` doesn't work.

## Rules
- Never use `any` type without a comment explaining why
- Every `useEffect` must have correct dependencies
- No inline styles unless Tailwind can't achieve the effect
- Dark mode support is mandatory for all new components
