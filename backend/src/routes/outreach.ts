import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma';
import { exportLeadsToSheets, createCalendarFollowup, listCalendarFollowups } from '../services/google';
import { generateRecommendations } from '../services/auto-recommend';
import { scoreLead } from '../services/lead-scoring';
import { startScrapingJob } from '../services/scraper';

const router = Router();
const limited = rateLimit({ windowMs: 60_000, max: 60 });

// ── Auto-recommendations ──────────────────────────────────────────────────────

router.post('/recommend', async (req, res) => {
  const { section, messages, leadCount, pendingEmails, pendingMessages } = req.body as {
    section: string;
    messages: string[];
    leadCount?: number;
    pendingEmails?: number;
    pendingMessages?: number;
  };
  try {
    const recs = await generateRecommendations(section, messages || [], leadCount, pendingEmails, pendingMessages);
    return res.json({ recommendations: recs });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Google Sheets export ──────────────────────────────────────────────────────

router.post('/sheets/export', limited, async (req, res) => {
  const { spreadsheetId } = req.body as { spreadsheetId?: string };
  try {
    const result = await exportLeadsToSheets(spreadsheetId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
      hint: 'Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set in .env',
    });
  }
});

// ── Google Calendar followups ─────────────────────────────────────────────────

router.post('/calendar/followup', limited, async (req, res) => {
  const { leadId, title, description, scheduledAt } = req.body as Record<string, string>;
  if (!leadId || !title || !scheduledAt) return res.status(400).json({ error: 'leadId, title, scheduledAt required' });
  try {
    const result = await createCalendarFollowup(leadId, title, description || title, new Date(scheduledAt));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/calendar/followups', async (_req, res) => {
  try {
    const events = await listCalendarFollowups();
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/calendar/followups/db', async (_req, res) => {
  const followups = await prisma.calendarFollowup.findMany({
    include: { lead: { select: { businessName: true, email: true, leadScore: true } } },
    orderBy: { scheduledAt: 'asc' },
    where: { scheduledAt: { gte: new Date() } },
  });
  return res.json({ followups });
});

// ── Bulk lead scoring ─────────────────────────────────────────────────────────

router.post('/leads/score-all', async (_req, res) => {
  const leads = await prisma.lead.findMany();
  let updated = 0;
  for (const lead of leads) {
    const score = scoreLead({
      email: lead.email,
      businessName: lead.businessName || undefined,
      ownerName: lead.ownerName || undefined,
      businessPhone: lead.businessPhone || undefined,
      businessEmail: lead.businessEmail || undefined,
      businessWebsite: lead.businessWebsite || undefined,
      yearsInBusiness: lead.yearsInBusiness || undefined,
      specialities: lead.specialities || undefined,
      source: lead.source || '',
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { leadScore: score.total, leadScoreDetails: score as never },
    });
    updated++;
  }
  return res.json({ updated });
});

// ── Bulk scrape (parallel) ────────────────────────────────────────────────────

router.post('/scrape/bulk', async (req, res) => {
  const { sources } = req.body as { sources: string[] };
  if (!sources?.length) return res.status(400).json({ error: 'sources array required' });

  const jobIds = await Promise.all(sources.map((s) => startScrapingJob(s)));
  return res.json({ jobIds, message: `${jobIds.length} scraping jobs started in parallel` });
});

// ── Lead CSV export ───────────────────────────────────────────────────────────

router.get('/leads/export/csv', async (_req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }] });
  const headers = ['#', 'Business Name', 'Owner Name', 'Phone', 'Email', 'Website', 'Years', 'Specialities', 'Score', 'Status', 'Outreach', 'Source', 'Created'];
  const rows = leads.map((l, i) => [
    i + 1,
    `"${(l.businessName || l.company || '').replace(/"/g, '""')}"`,
    `"${(l.ownerName || l.name || '').replace(/"/g, '""')}"`,
    `"${(l.businessPhone || l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.businessEmail || l.email || '').replace(/"/g, '""')}"`,
    `"${(l.businessWebsite || l.website || '').replace(/"/g, '""')}"`,
    l.yearsInBusiness ?? '',
    `"${(l.specialities || '').replace(/"/g, '""')}"`,
    l.leadScore,
    l.status,
    l.outreachStatus,
    `"${(l.source || '').replace(/"/g, '""')}"`,
    l.createdAt.toISOString().split('T')[0],
  ].join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="xps-leads.csv"');
  return res.send([headers.join(','), ...rows].join('\n'));
});

// ── Health / auto-connect checks ──────────────────────────────────────────────

router.get('/health/deep', async (_req, res) => {
  const checks: Record<string, { status: 'ok' | 'error' | 'unconfigured'; detail?: string }> = {};

  // Database
  try { await prisma.$queryRaw`SELECT 1`; checks.database = { status: 'ok' }; }
  catch (e) { checks.database = { status: 'error', detail: String(e) }; }

  // Redis
  try {
    const { cacheGet } = await import('../services/redis');
    await cacheGet('__health_check__');
    checks.redis = { status: 'ok' };
  } catch (e) { checks.redis = { status: 'error', detail: String(e) }; }

  // Google
  checks.google = process.env.GOOGLE_CLIENT_ID
    ? { status: process.env.GOOGLE_REFRESH_TOKEN ? 'ok' : 'unconfigured', detail: 'Refresh token missing' }
    : { status: 'unconfigured', detail: 'GOOGLE_CLIENT_ID not set' };

  // Email
  checks.email = (process.env.SMTP_HOST || process.env.GOOGLE_REFRESH_TOKEN)
    ? { status: 'ok' }
    : { status: 'unconfigured', detail: 'Set SMTP_HOST or GOOGLE_REFRESH_TOKEN' };

  // GitHub
  checks.github = process.env.GITHUB_APP_ID ? { status: 'ok' } : { status: 'unconfigured', detail: 'GITHUB_APP_ID not set' };

  // Railway
  checks.railway = process.env.RAILWAY_TOKEN ? { status: 'ok' } : { status: 'unconfigured', detail: 'RAILWAY_TOKEN not set' };

  // LLM
  checks.llm = process.env.GROQ_API_KEY ? { status: 'ok' } : { status: 'unconfigured', detail: 'GROQ_API_KEY not set' };

  // Social
  const socialAccounts = await prisma.socialAccount.count();
  checks.social = socialAccounts > 0 ? { status: 'ok', detail: `${socialAccounts} account(s) connected` } : { status: 'unconfigured', detail: 'No social accounts connected' };

  const allOk = Object.values(checks).every((c) => c.status === 'ok' || c.status === 'unconfigured');
  return res.status(allOk ? 200 : 207).json({ status: allOk ? 'ok' : 'partial', checks });
});

export default router;
