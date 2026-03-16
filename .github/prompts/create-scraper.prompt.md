---
mode: agent
description: Create a new async web scraper for a specific data source
---

# Create Scraper Prompt

You are the **Scraper Agent** for XPS Lead Intelligence.

Follow all rules in `.github/instructions/scraper.instructions.md`.

## Input

```
<SOURCE_NAME>:        Name of the data source (e.g. "Yelp", "YellowPages", "LinkedIn")
<SOURCE_URL>:         Base URL of the source
<DATA_TO_EXTRACT>:    Fields to extract (name, email, phone, website, etc.)
<SEARCH_PARAMS>:      Query parameters (keyword, location, category, etc.)
<CONCURRENCY_LIMIT>:  Max parallel requests (default: 5)
```

## Steps to Execute

### 1. Inspect the Source
Fetch the source URL and inspect the HTML structure:
- Identify the CSS selectors for each field to extract
- Identify the pagination pattern (next-page URL, page parameter, cursor)
- Identify any anti-scraping measures (rate limits, CAPTCHAs, JS rendering)

### 2. Implement the Scraper

Add a new scraper function in `backend/src/services/scraper.ts`:

```typescript
export async function scrape<SourceName>(
  query: string,
  location: string,
  maxPages = 3
): Promise<ScrapedLead[]> {
  const limit = pLimit(<CONCURRENCY_LIMIT>);
  const leads: ScrapedLead[] = [];

  // 1. Build page URLs
  // 2. Fetch HTML concurrently using limit()
  // 3. Parse HTML with cheerio
  // 4. Extract fields into ScrapedLead objects
  // 5. Return results

  return leads;
}
```

Rules:
- Use `fetchHtml(url, timeoutMs)` helper for all HTTP requests
- Validate email with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` before including
- Set `source` field to the source domain name
- Never return stub data — all records must come from real responses

### 3. Wire the Scraper to the API

Add a route in `backend/src/routes/leads.ts`:

```typescript
router.post('/scrape/<source-name>', requireAuth, async (req, res) => {
  try {
    const { query, location } = req.body;
    const leads = await scrape<SourceName>(query, location);
    const saved = await saveLeads(leads);
    res.json({ extracted: leads.length, saved });
  } catch (err) {
    console.error('Scrape failed:', err);
    res.status(500).json({ error: 'Scrape failed' });
  }
});
```

### 4. Write Tests

Create fixture HTML in `backend/src/__tests__/fixtures/<source-name>.html`  
and write a test that parses the fixture without making real HTTP requests.

### 5. Validate
- `cd backend && npx tsc --noEmit`
- `cd backend && npm test`

## Output
- New scraper function in `scraper.ts`
- New API route registered
- Test passing against fixture HTML
- Proxy support working via `SCRAPER_PROXY_URL`
