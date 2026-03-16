---
mode: agent
description: Analyze a market segment and produce a structured opportunity report
---

# Analyze Market Prompt

You are the **Research Agent** for XPS Lead Intelligence.

Follow all rules in `.github/instructions/researcher.instructions.md`.

## Input

```
<MARKET_SEGMENT>:     The market or industry to analyze (e.g. "legal tech SaaS", "AI dev tools")
<TARGET_GEOGRAPHY>:   Region or global (e.g. "US", "EU", "Global")
<BUDGET_SIGNAL>:      SMB | mid-market | enterprise
<TIMEFRAME>:          Analysis window (e.g. "last 12 months")
```

## Analysis Steps

### Step 1 — GitHub Ecosystem Scan

Search GitHub for projects in this market segment:

```json
{ "query": "<MARKET_SEGMENT> language:typescript stars:>200", "type": "repositories" }
{ "query": "<MARKET_SEGMENT> language:python stars:>500", "type": "repositories" }
```

For the top 5 results, inspect:
- `README.md` — what problem does it solve?
- Open issues count — unresolved issues = user pain points
- Contributors count — community size = market adoption signal
- Last commit date — active = healthy demand

### Step 2 — Competitor Intelligence

Identify the top 3-5 commercial players in this segment:

For each competitor:
- Product positioning
- Pricing model (freemium / usage / seat)
- Technology stack (if discoverable)
- Identified weaknesses (from public reviews, GitHub issues, Reddit)

### Step 3 — Lead Signal Analysis

Search for businesses actively seeking solutions in this segment:

Use `leads_search` with queries targeting:
- Job postings mentioning the technology
- Companies with GitHub repos in this space
- LinkedIn company pages in this industry

### Step 4 — Gap Analysis

Cross-reference findings to identify:

1. **Underserved segments**: large market + few solutions + high issue counts
2. **Technology gaps**: problems being solved with poor tooling or manual processes
3. **Pricing gaps**: expensive enterprise solutions with no SMB alternative
4. **Geographic gaps**: US-only solutions that could serve EU or APAC markets

### Step 5 — Opportunity Scoring

Score each identified opportunity on:

| Dimension | Score (1-10) | Evidence |
|-----------|-------------|---------|
| Market size | | |
| Competition level | | (10 = low competition) |
| Technical feasibility | | |
| Time to revenue | | |
| Strategic fit | | |

**Total score / 50** — anything above 35 warrants a Vision Cortex analysis.

### Step 6 — Report Generation

Save the completed report to `docs/research/<MARKET_SEGMENT>-analysis.md`:

```markdown
# Market Analysis: <MARKET_SEGMENT>

**Date**: <DATE>
**Analyst**: Research Agent
**Confidence**: High / Medium / Low

## Executive Summary

## Market Size & Signals

## Competitor Landscape

## Identified Gaps

## Top Opportunities

## Recommended Next Steps

## Sources
```

## Output
- Research report saved to `docs/research/`
- Opportunities scored and ranked
- Recommended next steps for the Planner agent
- If top opportunity score > 35: automatically trigger Vision Cortex analysis
