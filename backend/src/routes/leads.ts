import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { startScrapingJob } from '../services/scraper';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ leads, total: leads.length });
  } catch (err) {
    console.error('Get leads error:', err);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    return res.json(lead);
  } catch (err) {
    console.error('Get lead error:', err);
    return res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, company, phone, website, source, metadata } = req.body as {
      email: string;
      name?: string;
      company?: string;
      phone?: string;
      website?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    };

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const lead = await prisma.lead.create({
      data: { email, name, company, phone, website, source, metadata: metadata as never },
    });
    return res.status(201).json(lead);
  } catch (err) {
    console.error('Create lead error:', err);
    return res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body as Record<string, unknown>,
    });
    return res.json(lead);
  } catch (err) {
    console.error('Update lead error:', err);
    return res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error('Delete lead error:', err);
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { source } = req.body as { source: string };
    if (!source) return res.status(400).json({ error: 'Source is required' });

    const jobId = await startScrapingJob(source);
    return res.status(202).json({ jobId, message: 'Scraping job started' });
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ error: 'Failed to start scraping job' });
  }
});

router.get('/jobs/list', async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.scrapingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ jobs });
  } catch (err) {
    console.error('Get jobs error:', err);
    return res.status(500).json({ error: 'Failed to fetch scraping jobs' });
  }
});

export default router;
