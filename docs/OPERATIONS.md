# Operations Guide

**Version**: 1.0  
**Last Updated**: 2026-03-15

Day-to-day operational procedures for maintaining and operating the XPS Lead Intelligence platform.

---

## Daily Operations

### Morning Health Check
1. Visit Railway dashboard — verify both `backend` and `frontend` services show green
2. Check `GET /api/health` returns `{"status":"ok"}`
3. Review `GET /api/outreach/health/deep` for any connector status changes
4. Check GitHub Actions for any failed scheduled workflows

### Monitoring Leads Pipeline
1. Open the Dashboard section — verify lead count matches expectations
2. Check the Live Scraper — ensure recent jobs completed successfully
3. Review Email Outreach — check pending/failed sends
4. Review Social Agent — check inbound messages for any flagged items

---

## Lead Management Operations

### Importing Leads
**Via Web Scraper UI**:
1. Navigate to Live Scraper section
2. Enter target URL (business directory, LinkedIn, etc.)
3. Click "Start Scrape"
4. Results appear in Leads CRM after completion

**Via Agent**:
- Ask the agent: *"Scrape leads from [URL]"*
- Agent will use `leads_scrape` tool and report results

**Via CSV**:
- Future feature — currently export-only via `GET /api/outreach/csv`

### Lead Scoring
Lead scores are calculated automatically. Factors include:
- Business email presence (+20)
- Business phone presence (+15)
- Website presence (+10)
- Years in business (+5 per year, max +25)
- Business name completeness (+15)
- Contact name (+10)

Rescore all leads:
```bash
curl -X POST https://<backend>/api/leads/score-all \
  -H "Authorization: Bearer <JWT>"
```

Or via agent: *"Rescore all leads"*

### Exporting Leads
```bash
# Export as CSV
curl https://<backend>/api/outreach/csv \
  -H "Authorization: Bearer <JWT>" \
  -o leads.csv

# Export to Google Sheets (requires Google OAuth connected)
curl -X POST https://<backend>/api/outreach/sheets-export \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Leads Export 2026-03-15"}'
```

---

## Email Operations

### Setting Up Email Sending
1. Connect Google account in Settings → Accounts → "Sign in with Google"
2. Verify Google OAuth has Gmail API scope
3. Test: Send a single email from the Email Outreach section
4. Check `GET /api/outreach/health/deep` shows `google: { status: "ok" }`

### Creating Email Templates
1. Navigate to Email Outreach section
2. Click "New Template"
3. Use `{{variable}}` syntax for personalization (e.g., `{{ownerName}}`)
4. Variables are filled from Lead fields at send time

### Sending Email Campaigns
1. Create or select an email template
2. Set lead filters in the campaign
3. Set scheduled time or send immediately
4. Monitor sends via the Email Outreach section

### Email Troubleshooting
- `BOUNCED` status: Email address is invalid — update lead record
- `FAILED` status: Check backend logs for SMTP error details
- Gmail rate limits: Max ~500 emails/day on free Gmail accounts

---

## Social Media Operations

### Connecting Social Accounts
1. Navigate to Social Agent section
2. Click "Connect Platform"
3. Follow platform-specific OAuth flow
4. Verify connection in Settings → Connectors

### Managing Inbound Messages
1. Navigate to Social CRM section
2. Review incoming messages, mentions, and DMs
3. Use auto-reply feature for common responses
4. Flag important conversations for manual follow-up

### Scheduling Posts
1. Navigate to Social Agent section
2. Compose post content
3. Select platform and schedule time
4. Monitor post status (DRAFT → SCHEDULED → PUBLISHED)

---

## Agent Operations

### Using the Agent
The AI agent in the Agent Chat section can:
- Scrape leads from any URL
- Export data to Google Sheets or CSV
- Create GitHub issues and PRs
- Manage Railway deployments
- Generate and send email campaigns
- Browse GitHub repositories
- Execute code in sandboxes

### Agent Context Tips
- Provide specific URLs, names, and filters in your request
- The agent retains session context within a conversation
- Use specific tool-like language: *"List my GitHub repos"* vs *"What repos do I have?"*
- For long operations, the agent will report progress in real-time

### Agent Rate Limits
- Max 8 tool calls per agent session (safety limit)
- For complex multi-step tasks, break into multiple sessions
- Groq free tier: ~6,000 tokens/minute, ~500,000 tokens/day

---

## GitHub Integration Operations

### Webhook Setup (Optional)
To receive GitHub events (push, PR, issues):
1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook URL: `https://<backend>/api/github/webhooks`
3. Set content type: `application/json`
4. Select events to receive
5. Add webhook secret and set `GITHUB_WEBHOOK_SECRET` in Railway env

### GitHub App vs OAuth App
The system uses GitHub OAuth App (not GitHub App):
- OAuth App: Used for user authentication and API access
- Webhooks can be configured on individual repositories

---

## Connector Health Operations

### Checking All Connectors
```bash
curl https://<backend>/api/connectors \
  -H "Authorization: Bearer <JWT>"
```

### Reconnecting a Failed Connector
1. Navigate to Settings → Connectors
2. Find the connector showing `error` or `disconnected`
3. Click "Reconnect" or follow the re-authentication flow
4. Verify status changes to `connected`

### OAuth Token Expiry
- Google tokens expire after ~1 hour but auto-refresh with the refresh token
- GitHub tokens do not expire unless revoked
- Railway tokens do not expire unless manually revoked
- If a connector fails after long period: re-authenticate in Settings

---

## Performance Operations

### Slow API Responses
1. Check Railway backend metrics for CPU/memory usage
2. Check PostgreSQL for slow queries: enable `log_min_duration_statement = 1000` temporarily
3. Common bottleneck: `leads_score_all` on large datasets — consider scheduling off-peak

### Database Size Management
Monitor DB size in Railway PostgreSQL metrics. When approaching plan limits:
1. Archive old records (see Maintenance in RUNBOOK.md)
2. Export to CSV and delete old scraping job results
3. Consider upgrading Railway PostgreSQL plan

### Redis Memory
Redis is used for:
- Rate limiting counters (auto-expire in 15 minutes)
- Session data (expires with JWT TTL)
- Job queue entries (cleaned after processing)

If Redis memory is high: `redis-cli -u $REDIS_URL FLUSHDB` (clears all — use carefully in production)

---

## Security Operations

### Rotating JWT Secret
**Impact**: All existing sessions will be invalidated. All users must re-authenticate.

Steps:
1. Generate new secret: `openssl rand -base64 32`
2. Update `JWT_SECRET` in Railway backend environment variables
3. Redeploy backend service
4. Notify users they will need to sign in again

### Revoking an OAuth Token
If a connected account is compromised:
1. Revoke the OAuth token from the provider's security settings
2. Delete the `UserAuth` record from the database:
   ```sql
   DELETE FROM user_auth WHERE provider = 'GOOGLE';
   ```
3. Update any dependent environment variables

### Audit Trail
Review agent actions via the `agent_tasks` table:
```sql
SELECT "sessionId", input, status, "toolCalls", "createdAt"
FROM agent_tasks
ORDER BY "createdAt" DESC
LIMIT 50;
```
