import { Router } from 'express';
import { prisma } from '../db/prisma';
import { startScrapingJob } from '../services/scraper';
import { scoreLead, getScoreGrade } from '../services/lead-scoring';

const router = Router();

// ── List leads ────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, minScore, maxScore, outreachStatus, search, orderBy, limit } = req.query as Record<string, string>;
  const leads = await prisma.lead.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(outreachStatus ? { outreachStatus: outreachStatus as never } : {}),
      ...(minScore ? { leadScore: { gte: parseInt(minScore, 10) } } : {}),
      ...(maxScore ? { leadScore: { lte: parseInt(maxScore, 10) } } : {}),
      ...(search ? {
        OR: [
          { businessName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { businessPhone: { contains: search } },
          { specialities: { contains: search, mode: 'insensitive' } },
          { ownerName: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: orderBy === 'score' ? { leadScore: 'desc' } : { createdAt: 'desc' },
    take: limit ? parseInt(limit, 10) : 500,
    include: {
      _count: { select: { emailSends: true, calendarEvents: true } },
    },
  });

  const withGrade = leads.map((l) => ({ ...l, scoreGrade: getScoreGrade(l.leadScore) }));
  return res.json({ leads: withGrade, total: leads.length });
});

router.get('/stats', async (_req, res) => {
  const [total, byStatus, byOutreach, avgScore, topLeads] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['status'], _count: true }),
    prisma.lead.groupBy({ by: ['outreachStatus'], _count: true }),
    prisma.lead.aggregate({ _avg: { leadScore: true } }),
    prisma.lead.findMany({ orderBy: { leadScore: 'desc' }, take: 5, select: { id: true, businessName: true, leadScore: true, email: true } }),
  ]);
  return res.json({ total, byStatus, byOutreach, avgScore: Math.round(avgScore._avg.leadScore || 0), topLeads });
});

router.get('/:id', async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      emailSends: { orderBy: { createdAt: 'desc' }, take: 10 },
      calendarEvents: { orderBy: { scheduledAt: 'asc' } },
    },
  });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  return res.json({ ...lead, scoreGrade: getScoreGrade(lead.leadScore) });
});

router.post('/', async (req, res) => {
  const {
    email, ownerName, businessName, businessPhone, businessEmail, businessWebsite,
    yearsInBusiness, specialities, name, company, phone, website, source, metadata,
  } = req.body as Record<string, unknown>;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const scoreInput = { email: String(email), businessName: businessName ? String(businessName) : undefined, ownerName: ownerName ? String(ownerName) : undefined, businessPhone: businessPhone ? String(businessPhone) : undefined, businessEmail: businessEmail ? String(businessEmail) : undefined, businessWebsite: businessWebsite ? String(businessWebsite) : undefined, yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined, specialities: specialities ? String(specialities) : undefined, source: String(source || '') };
  const score = scoreLead(scoreInput);

  const lead = await prisma.lead.create({
    data: {
      email: String(email), ownerName: ownerName ? String(ownerName) : undefined, businessName: businessName ? String(businessName) : undefined, businessPhone: businessPhone ? String(businessPhone) : undefined, businessEmail: businessEmail ? String(businessEmail) : undefined, businessWebsite: businessWebsite ? String(businessWebsite) : undefined,
      yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined, specialities: specialities ? String(specialities) : undefined,
      name: name ? String(name) : (businessName ? String(businessName) : undefined),
      company: company ? String(company) : (businessName ? String(businessName) : undefined),
      phone: phone ? String(phone) : (businessPhone ? String(businessPhone) : undefined),
      website: website ? String(website) : (businessWebsite ? String(businessWebsite) : undefined),
      source: source ? String(source) : undefined,
      leadScore: score.total, leadScoreDetails: score as never,
      metadata: (metadata as never) || undefined,
    },
  });
  return res.status(201).json({ ...lead, scoreGrade: getScoreGrade(lead.leadScore) });
});

router.patch('/:id', async (req, res) => {
  const data = req.body as Record<string, unknown>;
  // Rescore if CRM fields changed
  const scoreFields = ['businessName', 'ownerName', 'businessPhone', 'businessEmail', 'businessWebsite', 'yearsInBusiness', 'specialities'];
  if (scoreFields.some((f) => f in data)) {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (existing) {
      const merged = { ...existing, ...data };
      const score = scoreLead({ email: existing.email, businessName: merged.businessName as string | undefined, ownerName: merged.ownerName as string | undefined, businessPhone: merged.businessPhone as string | undefined, businessEmail: merged.businessEmail as string | undefined, businessWebsite: merged.businessWebsite as string | undefined, yearsInBusiness: merged.yearsInBusiness as number | undefined, specialities: merged.specialities as string | undefined, source: existing.source || '' });
      data.leadScore = score.total;
      data.leadScoreDetails = score;
    }
  }
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
  return res.json({ ...lead, scoreGrade: getScoreGrade(lead.leadScore) });
});

router.delete('/:id', async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// ── Scraping ──────────────────────────────────────────────────────────────────
router.post('/scrape', async (req, res) => {
  const { source } = req.body as { source: string };
  if (!source) return res.status(400).json({ error: 'source is required (e.g. "yelp:restaurants:Chicago")' });
  const jobId = await startScrapingJob(source);
  return res.status(202).json({ jobId, message: `Scraping job started for: ${source}` });
});

router.get('/jobs/list', async (req, res) => {
  const jobs = await prisma.scrapingJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  });
  return res.json({ jobs });
});

router.get('/jobs/:id', async (req, res) => {
  const job = await prisma.scrapingJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(job);
});

export default router;
