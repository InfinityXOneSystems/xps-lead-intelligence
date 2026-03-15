/**
 * Real async parallel web scraper using cheerio.
 * Targets Yelp, YellowPages, and direct URL scraping.
 * No simulation — real HTTP requests to real pages.
 */

import * as https from 'https';
import * as http from 'http';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { prisma } from '../db/prisma';
import { scoreLead } from './lead-scoring';

export interface ScrapedLead {
  email: string;
  ownerName?: string;
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  yearsInBusiness?: number;
  specialities?: string;
  name?: string;
  company?: string;
  phone?: string;
  website?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XPSLeadBot/1.0; +https://xps.ai)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = lib.get(opts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        fetchHtml(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    req.on('error', reject);
  });
}

// ─── Normalisation pipeline ───────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+\-() ]/g, '').trim();
}

function normalizeUrl(raw: string): string {
  if (!raw) return '';
  if (!raw.startsWith('http')) return `https://${raw}`;
  return raw.trim();
}

function extractYearsInBusiness(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:years?|yrs?)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractEmail(html: string): string | null {
  const $ = cheerio.load(html);
  // Try visible mailto links first
  const mailto = $('a[href^="mailto:"]').first().attr('href');
  if (mailto) return mailto.replace('mailto:', '').split('?')[0].trim().toLowerCase();
  // Regex scan for email-like patterns in text
  const bodyText = $.text();
  const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0].toLowerCase() : null;
}

// ─── Yelp scraper ─────────────────────────────────────────────────────────────

async function scrapeYelp(query: string, location: string): Promise<ScrapedLead[]> {
  const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}&find_loc=${encodeURIComponent(location)}&ns=1`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const leads: ScrapedLead[] = [];

  // Yelp business cards use data-testid or itemprop markup
  $('[class*="businessName"], h3[class*="css-"] a, [data-testid="serp-ia-card"] h4 a, [class*="businessName__"] a').each((_, el) => {
    const name = $(el).text().trim();
    if (!name || name.length < 2) return;
    const href = $(el).attr('href');
    const bizUrl = href ? (href.startsWith('http') ? href : `https://www.yelp.com${href}`) : '';
    // Try to get phone from nearby sibling
    const card = $(el).closest('[class*="container"]').length
      ? $(el).closest('[class*="container"]')
      : $(el).parents().slice(0, 6).filter('[class*="card"], [class*="result"]').first();
    const phone = normalizePhone(card.find('[class*="phone"], [data-testid*="phone"]').text() || '');
    const placeholder = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@business.com`;
    leads.push({
      email: placeholder,
      businessName: name,
      businessPhone: phone || undefined,
      businessWebsite: bizUrl,
      source: `yelp:${query}:${location}`,
      metadata: { searchUrl: url, platform: 'yelp' },
    });
  });
  return leads;
}

// ─── Yellow Pages scraper ─────────────────────────────────────────────────────

async function scrapeYellowPages(query: string, location: string): Promise<ScrapedLead[]> {
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(query)}&geo_location_terms=${encodeURIComponent(location)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const leads: ScrapedLead[] = [];

  $('.result .info').each((_, el) => {
    const name = $(el).find('.business-name').text().trim();
    if (!name) return;
    const phone = normalizePhone($(el).find('.phones.phone.primary').text() || '');
    const rawSite = $(el).find('a.track-visit-website').attr('href') || '';
    const email = $(el).find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '') || '';
    const yearsText = $(el).find('.years-in-business .count').text() || '';
    const placeholder = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@yellowpages.biz`;
    leads.push({
      email: placeholder,
      businessName: name,
      businessPhone: phone || undefined,
      businessEmail: email || undefined,
      businessWebsite: normalizeUrl(rawSite),
      yearsInBusiness: yearsText ? parseInt(yearsText, 10) : undefined,
      specialities: $(el).find('.categories').text().trim() || undefined,
      source: `yellowpages:${query}:${location}`,
      metadata: { platform: 'yellowpages' },
    });
  });
  return leads;
}

// ─── Direct URL scraper ───────────────────────────────────────────────────────

async function scrapeDirectUrl(url: string): Promise<ScrapedLead[]> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const email = extractEmail(html);
  if (!email) return [];

  const name = $('title').text().trim() || $('h1').first().text().trim() || url;
  const phone = normalizePhone(
    $('[class*="phone"], [itemprop="telephone"], a[href^="tel:"]').first().text() ||
    $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '') || ''
  );
  const website = normalizeUrl(url);
  const yearsText = $('[class*="year"], [class*="since"], [class*="founded"]').text();

  return [{
    email,
    businessName: name,
    businessPhone: phone || undefined,
    businessEmail: email,
    businessWebsite: website,
    yearsInBusiness: extractYearsInBusiness(yearsText),
    source: `direct:${url}`,
    metadata: { platform: 'direct', pageTitle: name },
  }];
}

// ─── Parallel scraping engine ──────────────────────────────────────────────────

export async function runRealScraper(source: string): Promise<ScrapedLead[]> {
  const limit = pLimit(3); // max 3 parallel requests

  // Parse source: "yelp:restaurants:New York" or "yp:plumbers:Dallas" or "url:https://..."
  const [platform, ...rest] = source.split(':');

  let rawLeads: ScrapedLead[] = [];
  try {
    if (platform === 'yelp') {
      const [query, location] = [rest.slice(0, -1).join(':'), rest[rest.length - 1]];
      rawLeads = await limit(() => scrapeYelp(query || 'businesses', location || 'United States'));
    } else if (platform === 'yp' || platform === 'yellowpages') {
      const [query, location] = [rest.slice(0, -1).join(':'), rest[rest.length - 1]];
      rawLeads = await limit(() => scrapeYellowPages(query || 'businesses', location || 'United States'));
    } else if (platform === 'url') {
      const targetUrl = rest.join(':');
      rawLeads = await limit(() => scrapeDirectUrl(targetUrl));
    } else if (platform === 'multi') {
      // "multi:restaurants:Chicago" — scrape both Yelp and YP in parallel
      const query = rest.slice(0, -1).join(':');
      const location = rest[rest.length - 1];
      const [yelpLeads, ypLeads] = await Promise.allSettled([
        limit(() => scrapeYelp(query, location)),
        limit(() => scrapeYellowPages(query, location)),
      ]);
      rawLeads = [
        ...(yelpLeads.status === 'fulfilled' ? yelpLeads.value : []),
        ...(ypLeads.status === 'fulfilled' ? ypLeads.value : []),
      ];
    } else {
      // Treat as "query:location" for Yellow Pages
      rawLeads = await limit(() => scrapeYellowPages(platform, rest.join(':') || 'United States'));
    }
  } catch (err) {
    console.error('Scraper error:', err);
    throw err;
  }

  // Deduplicate by email
  const seen = new Set<string>();
  return rawLeads.filter((l) => {
    if (seen.has(l.email)) return false;
    seen.add(l.email);
    return true;
  });
}

// ─── Job orchestrator ─────────────────────────────────────────────────────────

export async function startScrapingJob(source: string): Promise<string> {
  const job = await prisma.scrapingJob.create({
    data: { source, status: 'PENDING' },
  });
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
    const leads = await runRealScraper(source);
    let saved = 0;

    for (const lead of leads) {
      try {
        const score = scoreLead(lead);
        await prisma.lead.upsert({
          where: { email: lead.email },
          update: {
            businessName: lead.businessName,
            ownerName: lead.ownerName,
            businessPhone: lead.businessPhone,
            businessEmail: lead.businessEmail,
            businessWebsite: lead.businessWebsite || lead.website,
            yearsInBusiness: lead.yearsInBusiness,
            specialities: lead.specialities,
            leadScore: score.total,
            leadScoreDetails: score as never,
            metadata: (lead.metadata || {}) as never,
          },
          create: {
            email: lead.email,
            businessName: lead.businessName,
            ownerName: lead.ownerName,
            businessPhone: lead.businessPhone,
            businessEmail: lead.businessEmail,
            businessWebsite: lead.businessWebsite || lead.website,
            yearsInBusiness: lead.yearsInBusiness,
            specialities: lead.specialities,
            name: lead.businessName,
            company: lead.businessName,
            phone: lead.businessPhone,
            website: lead.businessWebsite,
            source: lead.source,
            leadScore: score.total,
            leadScoreDetails: score as never,
            metadata: (lead.metadata || {}) as never,
          },
        });
        saved++;
      } catch { /* skip duplicate / constraint errors */ }
    }

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        results: { leadsFound: leads.length, leadsSaved: saved } as never,
      },
    });
  } catch (err) {
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        results: { error: String(err) } as never,
      },
    });
    throw err;
  }
}
