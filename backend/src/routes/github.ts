import { Router, Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import rateLimit from 'express-rate-limit';
import {
  listRepos,
  getRepo,
  listIssues,
  createIssue,
  commentOnIssue,
  closeIssue,
  listPullRequests,
  createPullRequest,
  mergePullRequest,
  getFileContents,
  createOrUpdateFile,
  listBranches,
  createBranch,
  listWorkflows,
  triggerWorkflow,
  getWorkflowRuns,
  searchCode,
  searchRepositories,
  listReleases,
  createRelease,
  listInstallations,
  getAppInfo,
  isConfigured,
} from '../services/github';
import { prisma } from '../db/prisma';

// ─── Rate limiters ────────────────────────────────────────────────────────────

// 120 webhook deliveries per minute per IP is generous for GitHub App usage
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// General API endpoints — 300 req/min per IP
const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const router = Router();

router.use(apiRateLimit);

// ─── App metadata ─────────────────────────────────────────────────────────────

router.get('/app', async (_req: Request, res: Response) => {
  if (!isConfigured()) {
    return res.json({ configured: false, message: 'Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY' });
  }
  try {
    const info = await getAppInfo();
    return res.json({ configured: true, app: info });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/installations', async (_req: Request, res: Response) => {
  if (!isConfigured()) return res.status(400).json({ error: 'GitHub App not configured' });
  try {
    const installations = await listInstallations();
    return res.json({ installations });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Repositories ─────────────────────────────────────────────────────────────

router.get('/repos', async (_req: Request, res: Response) => {
  try {
    const repos = await listRepos();
    return res.json({ repos, total: repos.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/repos/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query as { q?: string };
    if (!q) return res.status(400).json({ error: 'q is required' });
    const results = await searchRepositories(q);
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/repos/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const data = await getRepo(owner, repo);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Branches ─────────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/branches', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const branches = await listBranches(owner, repo);
    return res.json({ branches });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/branches', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { branch, from_sha } = req.body as { branch: string; from_sha: string };
    if (!branch || !from_sha) return res.status(400).json({ error: 'branch and from_sha required' });
    const data = await createBranch(owner, repo, branch, from_sha);
    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Issues ───────────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/issues', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';
    const issues = await listIssues(owner, repo, state);
    return res.json({ issues, total: issues.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/issues', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { title, body, labels } = req.body as { title: string; body: string; labels?: string[] };
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });
    const issue = await createIssue(owner, repo, title, body, labels);
    return res.status(201).json(issue);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/issues/:number/comments', async (req: Request, res: Response) => {
  try {
    const { owner, repo, number } = req.params;
    const { body } = req.body as { body: string };
    if (!body) return res.status(400).json({ error: 'body required' });
    const comment = await commentOnIssue(owner, repo, parseInt(number, 10), body);
    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.patch('/repos/:owner/:repo/issues/:number/close', async (req: Request, res: Response) => {
  try {
    const { owner, repo, number } = req.params;
    const data = await closeIssue(owner, repo, parseInt(number, 10));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Pull Requests ────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/pulls', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';
    const prs = await listPullRequests(owner, repo, state);
    return res.json({ prs, total: prs.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/pulls', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { title, head, base, body } = req.body as { title: string; head: string; base: string; body: string };
    if (!title || !head || !base) return res.status(400).json({ error: 'title, head, base required' });
    const pr = await createPullRequest(owner, repo, title, head, base, body || '');
    return res.status(201).json(pr);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/pulls/:number/merge', async (req: Request, res: Response) => {
  try {
    const { owner, repo, number } = req.params;
    const { merge_method } = req.body as { merge_method?: 'merge' | 'squash' | 'rebase' };
    const data = await mergePullRequest(owner, repo, parseInt(number, 10), merge_method || 'squash');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── File Contents ────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/contents/*', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const path = req.params[0];
    const ref = req.query.ref as string | undefined;
    const data = await getFileContents(owner, repo, path, ref);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.put('/repos/:owner/:repo/contents/*', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const path = req.params[0];
    const { message, content, branch } = req.body as { message: string; content: string; branch?: string };
    if (!message || content === undefined) return res.status(400).json({ error: 'message and content required' });
    // Try to get existing sha
    let sha: string | undefined;
    try {
      const existing = await getFileContents(owner, repo, path, branch);
      sha = existing.sha;
    } catch { /* new file */ }
    const data = await createOrUpdateFile(owner, repo, path, message, content, sha, branch);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Workflows ────────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/actions/workflows', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const workflows = await listWorkflows(owner, repo);
    return res.json({ workflows });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/actions/workflows/:workflowId/dispatches', async (req: Request, res: Response) => {
  try {
    const { owner, repo, workflowId } = req.params;
    const { ref, inputs } = req.body as { ref: string; inputs?: Record<string, string> };
    if (!ref) return res.status(400).json({ error: 'ref required' });
    const data = await triggerWorkflow(owner, repo, workflowId, ref, inputs || {});
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.get('/repos/:owner/:repo/actions/runs', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const workflowId = req.query.workflow_id as string | undefined;
    const runs = await getWorkflowRuns(owner, repo, workflowId);
    return res.json({ runs });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────

router.get('/search/code', async (req: Request, res: Response) => {
  try {
    const { q } = req.query as { q?: string };
    if (!q) return res.status(400).json({ error: 'q is required' });
    const results = await searchCode(q);
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Releases ─────────────────────────────────────────────────────────────────

router.get('/repos/:owner/:repo/releases', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const releases = await listReleases(owner, repo);
    return res.json({ releases });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

router.post('/repos/:owner/:repo/releases', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { tag_name, name, body, draft, prerelease } = req.body as {
      tag_name: string; name: string; body?: string; draft?: boolean; prerelease?: boolean;
    };
    if (!tag_name || !name) return res.status(400).json({ error: 'tag_name and name required' });
    const release = await createRelease(owner, repo, tag_name, name, body || '', draft, prerelease);
    return res.status(201).json(release);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Webhook receiver ─────────────────────────────────────────────────────────

router.post('/webhooks', webhookRateLimit, async (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const deliveryId = req.headers['x-github-delivery'] as string;
  const event = req.headers['x-github-event'] as string;

  if (!deliveryId || !event) {
    return res.status(400).json({ error: 'Missing GitHub webhook headers' });
  }

  // Verify signature if secret is configured
  if (secret) {
    const webhooks = new Webhooks({ secret });
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = JSON.stringify(req.body);
    const verified = await webhooks.verify(rawBody, signature).catch(() => false);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  const payload = req.body as Record<string, unknown>;
  const action = (payload.action as string) || undefined;
  const repository = (payload.repository as { full_name?: string })?.full_name || undefined;
  const sender = (payload.sender as { login?: string })?.login || undefined;

  try {
    // Store event (upsert to handle re-deliveries)
    await prisma.gitHubEvent.upsert({
      where: { deliveryId },
      update: { processedAt: new Date() },
      create: {
        deliveryId,
        event,
        action,
        repository,
        sender,
        payload: payload as never,
        processedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Failed to store GitHub event:', err);
  }

  // Emit to console for now; production would push to a queue
  console.log(`[GitHub Webhook] ${event}${action ? `.${action}` : ''} from ${repository || 'unknown'}`);

  return res.json({ received: true, event, action, deliveryId });
});

// ─── Recent webhook events ────────────────────────────────────────────────────

router.get('/events', async (req: Request, res: Response) => {
  try {
    const events = await prisma.gitHubEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(req.query.limit as string || '50', 10),
    });
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
