/**
 * Real OAuth authentication routes.
 * Supports Google OAuth2, GitHub OAuth App, and Railway API token.
 * All flows store tokens in the DB and issue JWTs to the frontend.
 */
import { Router, Request, Response } from 'express';
import https from 'https';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'xps-dev-secret-change-in-prod';
const JWT_TTL = '30d';

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function signJwt(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
}

function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ─── Middleware: optional auth (attaches user to req if valid JWT) ─────────────

export function optionalAuth(req: Request & { user?: Record<string, unknown> }, _res: Response, next: () => void) {
  const token = getBearerToken(req);
  if (token) {
    const payload = verifyJwt(token);
    if (payload) req.user = payload;
  }
  next();
}

// ─── Helper: HTTPS GET with JSON response ─────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'Accept': 'application/json', 'User-Agent': 'XPS-Lead-Intelligence/2.0', ...headers },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url: string, body: string, headers: Record<string, string> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'XPS-Lead-Intelligence/2.0',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── GET /api/auth/status ──────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const auths = await prisma.userAuth.findMany();
    const status: Record<string, unknown> = {};
    for (const a of auths) {
      status[a.provider.toLowerCase()] = {
        connected: !!a.accessToken,
        userEmail: a.userEmail,
        userName: a.userName,
        userAvatar: a.userAvatar,
        userLogin: a.userLogin,
        connectedAt: a.connectedAt,
      };
    }
    return res.json({ authenticated: auths.some((a) => !!a.accessToken), accounts: status });
  } catch (err) {
    console.error('Auth status error:', err);
    return res.status(500).json({ error: 'Failed to get auth status' });
  }
});

// ─── GOOGLE OAUTH ──────────────────────────────────────────────────────────────

router.get('/google/url', (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: 'GOOGLE_CLIENT_ID not configured. Add it to Railway env vars.' });
  }
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`;
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.send',
  ].join(' ');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent`;
  return res.json({ url });
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as Record<string, string>;
  if (error) {
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=google&msg=${encodeURIComponent(error)}`);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=google&msg=not_configured`);
  }
  try {
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`;
    // Exchange code for tokens
    const tokenResp = await httpsPost(
      'https://oauth2.googleapis.com/token',
      JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
    ) as Record<string, string>;

    if (!tokenResp.access_token) {
      return res.redirect(`${FRONTEND_URL}?auth=error&provider=google&msg=token_exchange_failed`);
    }

    // Get user info
    const userInfo = await httpsGet(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { Authorization: `Bearer ${tokenResp.access_token}` }
    ) as Record<string, string>;

    // Store in DB
    const auth = await prisma.userAuth.upsert({
      where: { provider: 'GOOGLE' },
      update: {
        userEmail: userInfo.email,
        userName: userInfo.name,
        userAvatar: userInfo.picture,
        userId: userInfo.sub,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token || undefined,
        tokenExpiry: tokenResp.expires_in
          ? new Date(Date.now() + parseInt(tokenResp.expires_in) * 1000)
          : undefined,
        rawProfile: userInfo as never,
      },
      create: {
        provider: 'GOOGLE',
        userEmail: userInfo.email,
        userName: userInfo.name,
        userAvatar: userInfo.picture,
        userId: userInfo.sub,
        accessToken: tokenResp.access_token,
        refreshToken: tokenResp.refresh_token || undefined,
        tokenExpiry: tokenResp.expires_in
          ? new Date(Date.now() + parseInt(tokenResp.expires_in) * 1000)
          : undefined,
        rawProfile: userInfo as never,
      },
    });

    // Also update AdminConfig so google.ts can find the refresh token
    if (tokenResp.refresh_token) {
      await prisma.adminConfig.upsert({
        where: { key: 'google_refresh_token' },
        update: { value: tokenResp.refresh_token },
        create: { key: 'google_refresh_token', value: tokenResp.refresh_token },
      });
    }
    if (userInfo.email) {
      await prisma.adminConfig.upsert({
        where: { key: 'gmail_user' },
        update: { value: userInfo.email },
        create: { key: 'gmail_user', value: userInfo.email },
      });
    }

    const sessionToken = signJwt({ provider: 'GOOGLE', email: auth.userEmail, name: auth.userName });
    return res.redirect(`${FRONTEND_URL}?auth=success&provider=google&token=${encodeURIComponent(sessionToken)}`);
  } catch (err) {
    console.error('Google callback error:', err);
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=google&msg=server_error`);
  }
});

// ─── GITHUB OAUTH ──────────────────────────────────────────────────────────────

router.get('/github/url', (_req: Request, res: Response) => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: 'GITHUB_OAUTH_CLIENT_ID not configured. Add it to Railway env vars.' });
  }
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/github/callback`;
  const scopes = 'read:user,user:email,repo,read:org';
  const url = `https://github.com/login/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}`;
  return res.json({ url });
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as Record<string, string>;
  if (error) {
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=github&msg=${encodeURIComponent(error)}`);
  }
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=github&msg=not_configured`);
  }
  try {
    // Exchange code for token
    const tokenResp = await httpsPost(
      'https://github.com/login/oauth/access_token',
      JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    ) as Record<string, string>;

    if (!tokenResp.access_token) {
      return res.redirect(`${FRONTEND_URL}?auth=error&provider=github&msg=token_exchange_failed`);
    }

    // Get user info
    const userInfo = await httpsGet('https://api.github.com/user', {
      Authorization: `Bearer ${tokenResp.access_token}`,
    }) as Record<string, string | number>;

    // Get primary email
    const emails = await httpsGet('https://api.github.com/user/emails', {
      Authorization: `Bearer ${tokenResp.access_token}`,
    }) as Array<{ email: string; primary: boolean }>;
    const primaryEmail = emails.find((e) => e.primary)?.email || String(userInfo.email || '');

    // Store in DB
    const auth = await prisma.userAuth.upsert({
      where: { provider: 'GITHUB' },
      update: {
        userEmail: primaryEmail,
        userName: String(userInfo.name || userInfo.login),
        userAvatar: String(userInfo.avatar_url || ''),
        userLogin: String(userInfo.login),
        userId: String(userInfo.id),
        accessToken: tokenResp.access_token,
        rawProfile: userInfo as never,
      },
      create: {
        provider: 'GITHUB',
        userEmail: primaryEmail,
        userName: String(userInfo.name || userInfo.login),
        userAvatar: String(userInfo.avatar_url || ''),
        userLogin: String(userInfo.login),
        userId: String(userInfo.id),
        accessToken: tokenResp.access_token,
        rawProfile: userInfo as never,
      },
    });

    // Also store token in AdminConfig for existing GitHub service
    await prisma.adminConfig.upsert({
      where: { key: 'github_token' },
      update: { value: tokenResp.access_token },
      create: { key: 'github_token', value: tokenResp.access_token },
    });

    const sessionToken = signJwt({ provider: 'GITHUB', login: auth.userLogin, name: auth.userName });
    return res.redirect(`${FRONTEND_URL}?auth=success&provider=github&token=${encodeURIComponent(sessionToken)}`);
  } catch (err) {
    console.error('GitHub callback error:', err);
    return res.redirect(`${FRONTEND_URL}?auth=error&provider=github&msg=server_error`);
  }
});

// ─── RAILWAY TOKEN ─────────────────────────────────────────────────────────────

router.post('/railway', async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token?.trim()) {
    return res.status(400).json({ error: 'Railway API token is required' });
  }
  try {
    // Validate token via Railway GraphQL API
    const query = `{ me { id name email } }`;
    const resp = await httpsPost(
      'https://backboard.railway.app/graphql/v2',
      JSON.stringify({ query }),
      { Authorization: `Bearer ${token}` }
    ) as { data?: { me?: { id: string; name: string; email: string } }; errors?: unknown[] };

    if (!resp.data?.me) {
      return res.status(401).json({ error: 'Invalid Railway token. Check your Railway account → Account → Tokens.' });
    }

    const { id, name, email } = resp.data.me;

    // Store in DB
    const auth = await prisma.userAuth.upsert({
      where: { provider: 'RAILWAY' },
      update: {
        userId: id,
        userName: name,
        userEmail: email,
        accessToken: token,
        rawProfile: resp.data.me as never,
      },
      create: {
        provider: 'RAILWAY',
        userId: id,
        userName: name,
        userEmail: email,
        accessToken: token,
        rawProfile: resp.data.me as never,
      },
    });

    // Also store in AdminConfig for existing Railway integrations
    await prisma.adminConfig.upsert({
      where: { key: 'railway_token' },
      update: { value: token },
      create: { key: 'railway_token', value: token },
    });

    const sessionToken = signJwt({ provider: 'RAILWAY', name: auth.userName, email: auth.userEmail });
    return res.json({
      success: true,
      token: sessionToken,
      user: { id, name, email },
      message: `Connected as ${name} (${email})`,
    });
  } catch (err) {
    console.error('Railway auth error:', err);
    return res.status(500).json({ error: 'Failed to validate Railway token. Ensure the token is valid.' });
  }
});

// ─── LOGOUT (single provider or all) ─────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  const { provider } = req.body as { provider?: string };
  try {
    if (provider) {
      const enumProvider = provider.toUpperCase() as 'GOOGLE' | 'GITHUB' | 'RAILWAY';
      await prisma.userAuth.updateMany({
        where: { provider: enumProvider },
        data: { accessToken: null, refreshToken: null },
      });
    } else {
      await prisma.userAuth.updateMany({ data: { accessToken: null, refreshToken: null } });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── GET /api/auth/verify ─── (validate a JWT from the frontend) ──────────────

router.post('/verify', (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'Token required' });
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  return res.json({ valid: true, payload });
});

export default router;
