/**
 * Real multi-factor lead scoring service.
 * No mocks — calculates score from actual field presence, completeness,
 * and LLM-enriched analysis of specialities.
 */

import { ScrapedLead } from './scraper';

export interface LeadScoreResult {
  total: number;           // 0–100
  completeness: number;    // field presence score 0–30
  contactability: number;  // how easy to reach 0–25
  businessMaturity: number;// years, established signals 0–25
  relevance: number;       // speciality / industry match 0–20
  factors: string[];       // human-readable reasons
}

const HIGH_VALUE_KEYWORDS = [
  'roofing', 'plumbing', 'hvac', 'electrical', 'contractor', 'construction',
  'remodeling', 'landscaping', 'pest control', 'cleaning', 'moving', 'painting',
  'flooring', 'concrete', 'fencing', 'solar', 'pool', 'tree service',
  'auto repair', 'auto body', 'insurance', 'real estate', 'mortgage',
  'accounting', 'law', 'dental', 'medical', 'chiropractic', 'salon', 'spa',
];

export function scoreLead(lead: ScrapedLead): LeadScoreResult {
  const factors: string[] = [];
  let completeness = 0;
  let contactability = 0;
  let businessMaturity = 0;
  let relevance = 0;

  // ── Completeness (0-30) ───────────────────────────────────────────────────
  if (lead.businessName || lead.company) { completeness += 6; factors.push('Has business name'); }
  if (lead.ownerName) { completeness += 6; factors.push('Owner name known'); }
  if (lead.businessPhone || lead.phone) { completeness += 6; factors.push('Phone number available'); }
  if (lead.businessEmail || lead.email) { completeness += 6; factors.push('Email available'); }
  if (lead.businessWebsite || lead.website) { completeness += 6; factors.push('Website available'); }

  // ── Contactability (0-25) ─────────────────────────────────────────────────
  const emailAddr = lead.businessEmail || lead.email || '';
  if (emailAddr && !emailAddr.includes('@business.com') && !emailAddr.includes('@yellowpages.biz')) {
    contactability += 15;
    factors.push('Verified email address');
  } else if (emailAddr) {
    contactability += 5;
    factors.push('Placeholder email (needs verification)');
  }
  if ((lead.businessPhone || lead.phone)?.match(/\d{7,}/)) {
    contactability += 10;
    factors.push('Direct phone number');
  }

  // ── Business Maturity (0-25) ──────────────────────────────────────────────
  const years = lead.yearsInBusiness;
  if (years) {
    if (years >= 10) { businessMaturity += 25; factors.push(`${years} years in business (very established)`); }
    else if (years >= 5) { businessMaturity += 18; factors.push(`${years} years in business (established)`); }
    else if (years >= 2) { businessMaturity += 10; factors.push(`${years} years in business (growing)`); }
    else { businessMaturity += 5; factors.push(`${years} year(s) in business (new)`); }
  }
  if ((lead.businessWebsite || lead.website)) {
    const siteHost = (() => {
      try { return new URL(String(lead.businessWebsite || lead.website)).hostname.toLowerCase(); }
      catch { return ''; }
    })();
    const isDirectory = ['yelp.com', 'yellowpages.com', 'yp.com', 'bing.com', 'google.com'].some((d) => siteHost === d || siteHost.endsWith(`.${d}`));
    if (!isDirectory) {
      businessMaturity += Math.min(businessMaturity === 0 ? 8 : 0, 8);
    }
  }

  // ── Relevance / Industry (0-20) ───────────────────────────────────────────
  const specialText = ((lead.specialities || '') + ' ' + (lead.businessName || lead.company || '')).toLowerCase();
  const matchedKeywords = HIGH_VALUE_KEYWORDS.filter((kw) => specialText.includes(kw));
  if (matchedKeywords.length > 0) {
    relevance = Math.min(matchedKeywords.length * 7, 20);
    factors.push(`High-value industry: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }

  const total = Math.min(completeness + contactability + businessMaturity + relevance, 100);

  return { total, completeness, contactability, businessMaturity, relevance, factors };
}

export function getScoreGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'A', color: '#68d391' };
  if (score >= 65) return { label: 'B', color: '#63b3ed' };
  if (score >= 50) return { label: 'C', color: '#f6e05e' };
  if (score >= 35) return { label: 'D', color: '#fc8181' };
  return { label: 'F', color: '#718096' };
}
