# Security Guide

## Security Model

XPS Lead Intelligence implements defense-in-depth with these layers:

### 1. Authentication & Authorization

**JWT-based sessions**:
- 30-day TTL
- Stored in `localStorage` (key: `xps_session_token`)
- Sent as `Authorization: Bearer <token>` on all API requests
- Verified server-side on protected routes

**JWT_SECRET enforcement**:
- Required in production — server exits with `process.exit(1)` if missing
- Dev fallback with loud warning only
- Minimum 32 chars recommended (`openssl rand -base64 32`)

**OAuth providers**: Google, GitHub, Railway — all tokens stored in `UserAuth` DB table with encryption-ready structure.

### 2. SSRF Prevention

All OAuth HTTP helper functions (`httpsGet`, `httpsPost`) call `assertSafeExternalUrl()` which:
- Requires `https:` protocol only
- Blocks all private IP ranges:
  - `127.x` (localhost)
  - `10.x` (private class A)
  - `172.16-31.x` (private class B)
  - `192.168.x` (private class C)
  - `169.254.x` (link-local / AWS metadata)
  - `::1` (IPv6 loopback)
  - `fc00:` (IPv6 private)

### 3. Input Validation

**Railway API tokens**: Validated for max length (512 chars) and character set (`[A-Za-z0-9._-]` only) before use.

**HTML content**: All HTML-to-text conversion uses `stripHtml()` from `backend/src/utils/sanitize.ts` (backed by `sanitize-html` package). Never use regex `/<[^>]+>/g`.

**Request body size**: Limited to 10MB by Express middleware.

### 4. Rate Limiting

Auth routes are rate-limited via `express-rate-limit`:
- Window: 15 minutes
- Max: 20 requests per IP
- Returns `{ error: 'Too many authentication attempts. Please try again later.' }`

### 5. Secret Handling

- **Never** hardcode secrets in code
- All secrets via `process.env` only
- See `.env.example` for variable names (no real values)
- Railway environment variables for production
- Local `.env` files excluded from git via `.gitignore`

### 6. CORS

Backend CORS origin is set from `FRONTEND_URL` environment variable. Do not use `*` wildcard in production.

### 7. Frontend URL Validation

`FRONTEND_URL` is validated at startup — must be a valid `http:` or `https:` URL. Invalid values fall back to `http://localhost:3000` with a warning.

## Security Checklist (Pre-Production)

- [ ] `JWT_SECRET` set to a strong random value
- [ ] `FRONTEND_URL` set to exact production URL (no trailing slash)
- [ ] `BACKEND_URL` set to exact production URL
- [ ] Google OAuth redirect URI exactly matches `BACKEND_URL + /api/auth/google/callback`
- [ ] GitHub OAuth callback URL exactly matches `BACKEND_URL + /api/auth/github/callback`
- [ ] No `.env` files committed to git
- [ ] CORS origin locked to production frontend URL
- [ ] Database not publicly accessible (use Railway internal networking)
- [ ] Redis not publicly accessible

## Known Limitations

1. **JWT stored in localStorage**: More convenient but less secure than httpOnly cookies. For higher security, migrate to httpOnly cookie session.

2. **No CSRF protection**: OAuth state parameter prevents CSRF in OAuth flows, but non-auth API routes don't have CSRF tokens. Mitigated by JWT Bearer auth (not cookie-based).

3. **Rate limiting per IP**: Can be bypassed with IP rotation. For production-grade protection, add account-level rate limiting.

4. **Social platform tokens**: Stored as plaintext in database. For production, encrypt with a KMS/AES key.

## Reporting Security Issues

Do not open public issues for security vulnerabilities. Contact the maintainer directly.
