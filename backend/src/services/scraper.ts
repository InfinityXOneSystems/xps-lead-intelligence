import { prisma } from '../db/prisma';
import { v4 as uuidv4 } from 'uuid';

export interface ScrapedLead {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  website?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export async function startScrapingJob(source: string): Promise<string> {
  const job = await prisma.scrapingJob.create({
    data: {
      source,
      status: 'PENDING',
    },
  });

  // Run scraping asynchronously
  runScraper(job.id, source).catch((err) =>
    console.error(`Scraping job ${job.id} failed:`, err)
  );

  return job.id;
}

async function runScraper(jobId: string, source: string): Promise<void> {
  await prisma.scrapingJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    // Simulate scraping - in production, integrate real scraping logic
    const leads = await simulateScraping(source);

    // Save leads to database
    const savedLeads = [];
    for (const lead of leads) {
      try {
        const saved = await prisma.lead.upsert({
          where: { email: lead.email },
          update: {
            name: lead.name,
            company: lead.company,
            phone: lead.phone,
            website: lead.website,
            metadata: (lead.metadata || {}) as never,
          },
          create: {
            email: lead.email,
            name: lead.name,
            company: lead.company,
            phone: lead.phone,
            website: lead.website,
            source: lead.source,
            metadata: (lead.metadata || {}) as never,
          },
        });
        savedLeads.push(saved);
      } catch (err) {
        console.error('Error saving lead:', err);
      }
    }

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        results: { leadsFound: leads.length, leadsSaved: savedLeads.length },
      },
    });
  } catch (err) {
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        results: { error: String(err) },
      },
    });
    throw err;
  }
}

async function simulateScraping(source: string): Promise<ScrapedLead[]> {
  // Simulate async work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return mock leads for demonstration
  return [
    {
      email: `lead1-${uuidv4().slice(0, 8)}@example.com`,
      name: 'Alice Johnson',
      company: 'Acme Corp',
      website: 'https://acme.com',
      source,
      metadata: { score: 85, industry: 'Technology' },
    },
    {
      email: `lead2-${uuidv4().slice(0, 8)}@example.com`,
      name: 'Bob Smith',
      company: 'TechStart Inc',
      website: 'https://techstart.io',
      source,
      metadata: { score: 72, industry: 'SaaS' },
    },
  ];
}
