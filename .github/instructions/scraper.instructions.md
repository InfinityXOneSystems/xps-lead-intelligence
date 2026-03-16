---
applyTo: "backend/src/services/scraper.ts,backend/src/routes/leads.ts"
---
# Scraper Agent Instructions

## Role
The Scraper extracts structured business data and lead records from web sources.  
It feeds the leads database and triggers the lead-scoring pipeline.

## Responsibilities
- Extract business listings from Yelp, YellowPages, and direct URLs
- Parse structured lead data: name, email, phone, website, business details
- Apply lead scoring via `backend/src/services/lead-scoring.ts`
- Save scored leads to PostgreSQL via Prisma
- Support proxy rotation for rate-limit avoidance

## Allowed Tools
```
leads_search
leads_save
```

## Scraper Architecture

Implementation: `backend/src/services/scraper.ts`

The scraper uses:
- **Cheerio** for HTML parsing (no headless browser for standard pages)
- **`p-limit`** for parallel request concurrency control
- **Real HTTP requests** — no simulation, no mock data
- **Proxy support** via `SCRAPER_PROXY_URL` environment variable

## Supported Sources

| Source | Type | Notes |
|--------|------|-------|
| Yelp | Business listings | Category + location search |
| YellowPages | Business directories | Keyword + city search |
| Direct URL | Custom crawl | Configurable depth |

## Data Schema

Every extracted lead must conform to `ScrapedLead`:

```typescript
interface ScrapedLead {
  email: string;           // Required
  name?: string;           // Contact name
  company?: string;        // Business name
  phone?: string;          // Business phone
  website?: string;        // Business website
  source: string;          // Source URL or platform name
  metadata?: Record<string, unknown>; // Additional fields
}
```

## Scraping Rules
- **No fake data** — every record must originate from a real HTTP response
- **No stub functions** — all parsing logic must execute against real HTML
- Rate-limit all sources: max 5 concurrent requests per domain (`p-limit(5)`)
- Set a realistic User-Agent header on every request
- Timeout all requests at 15 seconds — skip and log on timeout
- Validate email format before saving: must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

## Lead Scoring Integration

After extraction, every lead is scored before saving:

```typescript
import { scoreLead } from '../services/lead-scoring';
const score = await scoreLead(lead);
await prisma.lead.create({ data: { ...lead, score } });
```

## Proxy Configuration

```bash
# .env
SCRAPER_PROXY_URL=http://user:pass@proxy-host:port
```

When set, all outbound scraper requests route through the proxy.

## Error Handling
- Log all HTTP errors with the source URL and status code
- Skip malformed records — do not save incomplete leads
- Report extraction counts: `{ extracted: N, saved: M, failed: K }`

## Testing
Mock all HTTP calls in tests — do NOT make real network requests in the test suite:

```typescript
jest.mock('https', () => ({ request: jest.fn() }));
```

Verify that the parser correctly extracts fields from fixture HTML files  
stored in `backend/src/__tests__/fixtures/`.
