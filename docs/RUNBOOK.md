# Operations Runbook

**Version**: 1.0  
**Last Updated**: 2026-03-15

This runbook covers operational procedures for the XPS Lead Intelligence platform. Follow these procedures for startup, health monitoring, failure recovery, and maintenance.

---

## Quick Reference

| Action | Command / URL |
|--------|--------------|
| Backend health | `GET /api/health` |
| Deep integration check | `GET /api/outreach/health/deep` |
| Connector status | `GET /api/connectors` |
| Run migrations | `cd backend && npx prisma migrate deploy` |
| Run tests | `cd backend && npm test` |
| Check Railway logs | Railway dashboard → Service → Logs |
| Restart backend | Railway dashboard → Backend → Restart |

---

## System Startup

### Local Development

```bash
# 1. Start infrastructure services
docker-compose up -d
# This starts: postgres:15 on port 5432, redis:7 on port 6379

# 2. Verify services are running
docker-compose ps
# Both postgres and redis should show "Up"

# 3. Set up backend environment
cp .env.example backend/.env
# Edit backend/.env with your values (minimum: JWT_SECRET, GROQ_API_KEY)

# 4. Install dependencies
cd backend && npm ci
cd frontend && npm ci

# 5. Run database migrations
cd backend && npx prisma migrate dev

# 6. Start backend (port 4000)
cd backend && npm run dev
# Expect: "XPS Lead Intelligence backend running on port 4000"

# 7. Start frontend (port 3000)
cd frontend && npm run dev
# Expect: "Ready in Xms" + "Local: http://localhost:3000"

# 8. Verify health
curl http://localhost:4000/api/health
# Expected: {"status":"ok","uptime":X,"timestamp":"..."}
```

### Production (Railway)

Railway starts services automatically via `railway.toml`:
- Backend: `npm start` on port 4000
- Frontend: `npm start` on port 3000

Migrations run automatically before backend start:
```toml
[services.backend]
startCommand = "npm start"
buildCommand = "npm ci && npm run build && npx prisma generate"
```

Verify production startup:
```bash
curl https://<backend-url>/api/health
# Expected: {"status":"ok"}
```

---

## Service Health Checks

### Basic Health
```bash
# Backend health endpoint
curl https://<backend-url>/api/health

# Expected response:
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-03-15T12:00:00.000Z"
}
```

### Deep Integration Health
```bash
curl https://<backend-url>/api/outreach/health/deep

# Expected response:
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" | "unconfigured" },
    "groq": { "status": "ok" | "unconfigured" },
    "github": { "status": "ok" | "unconfigured" },
    "google": { "status": "ok" | "unconfigured" }
  }
}
```

Status meanings:
- `ok` — Service is connected and responding
- `unconfigured` — Environment variable not set (not an error, feature disabled)
- `error` — Service is configured but failing

### Connector Status
```bash
curl https://<backend-url>/api/connectors

# Returns array of connector records with status and lastChecked
```

---

## Scraper Monitoring

### Check Active Scraping Jobs
```sql
-- Via Prisma Studio or DB client
SELECT id, source, status, startedAt, completedAt
FROM scraping_jobs
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Scraper Failure Recovery
If scraping jobs are stuck in `RUNNING` status for > 5 minutes:
1. Check backend logs in Railway for error messages
2. Failed jobs can be retried via the Live Scraper UI → re-submit the URL
3. If all jobs are stuck, restart the backend service in Railway

### Scraper Rate Limits
The scraper uses `p-limit(3)` — max 3 concurrent requests. If getting blocked by target sites:
1. Reduce to `p-limit(1)` in `scraper.ts`
2. Add delay between requests if needed
3. Consider rotating user agents

---

## Agent Monitoring

### View Recent Agent Sessions
```sql
SELECT id, "sessionId", "createdAt", "updatedAt"
FROM agent_sessions
ORDER BY "createdAt" DESC
LIMIT 10;
```

### View Agent Task Traces
```sql
SELECT id, "sessionId", input, status, steps, "createdAt"
FROM agent_tasks
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Agent Stuck / Not Responding
1. Check backend logs for "Max tool rounds reached" — this is normal safety behavior
2. Check if `GROQ_API_KEY` is set and valid
3. Test Groq API directly: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`
4. If Groq is down, agent will return an error response — this is expected
5. Retry the agent request from the UI

---

## Failure Recovery

### Backend Not Responding (502/503)
1. Check Railway backend service status
2. View Railway logs: Dashboard → Backend → Logs
3. Common causes:
   - `DATABASE_URL` not set or wrong → Check env vars
   - Migration failed → Run manually: `railway run --service backend npx prisma migrate deploy`
   - Out of memory → Check Railway usage metrics
4. Restart service: Railway Dashboard → Backend → Restart

### Database Connection Failures
1. Verify `DATABASE_URL` is set correctly in Railway backend env vars
2. Check PostgreSQL service is running in Railway
3. Test connection: `railway run --service backend node -e "require('./dist/db/prisma').prisma.$connect().then(() => console.log('OK'))"` 
4. If DB is down: Railway Dashboard → PostgreSQL → Restart

### Redis Connection Failures
Redis failure does NOT crash the backend (graceful degradation):
- Rate limiting uses in-memory store when Redis is unavailable
- Job queues fall back to direct execution
- Monitor: `redis-cli -u $REDIS_URL ping` → should return `PONG`
- If Redis is consistently failing: check Railway Redis service, restart if needed

### JWT Authentication Failures (401 errors)
1. Verify `JWT_SECRET` is set in Railway backend env vars
2. Check that `JWT_SECRET` is the same value that was used to sign tokens
3. If `JWT_SECRET` was rotated, all existing tokens are invalidated — users must re-authenticate
4. Frontend will automatically redirect to Settings for re-authentication

### Failed Migrations
If `prisma migrate deploy` fails on deploy:
1. Check migration SQL for syntax errors
2. Verify the migration is backward-compatible
3. Manual recovery: Connect to production DB and run migration SQL directly
4. Roll forward (not back) whenever possible

---

## Routine Maintenance

### Database Cleanup (Monthly)
```sql
-- Archive old completed scraping jobs (keep 30 days)
DELETE FROM scraping_jobs
WHERE status = 'COMPLETED' 
AND "createdAt" < NOW() - INTERVAL '30 days';

-- Archive old agent tasks (keep 90 days)
DELETE FROM agent_tasks
WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- Archive old GitHub events (keep 30 days)  
DELETE FROM github_events
WHERE "createdAt" < NOW() - INTERVAL '30 days';
```

### Checking Email Send Status
```sql
SELECT status, COUNT(*) 
FROM email_sends 
GROUP BY status;
```

### Monitoring Lead Score Distribution
```sql
SELECT 
  CASE 
    WHEN "leadScore" >= 70 THEN 'Hot (70+)'
    WHEN "leadScore" >= 40 THEN 'Warm (40-69)'
    ELSE 'Cold (<40)'
  END as tier,
  COUNT(*)
FROM leads
GROUP BY tier;
```

---

## Logs

### Railway Logs
- Backend: Railway Dashboard → Backend service → Logs tab
- Frontend: Railway Dashboard → Frontend service → Logs tab
- Filter by time range and log level

### Key Log Messages

| Message | Meaning |
|---------|---------|
| `XPS Lead Intelligence backend running on port 4000` | Backend started successfully |
| `Redis connected` | Redis connection established |
| `Redis connection failed — running without cache` | Redis unavailable, degraded mode |
| `Groq tool call: <tool>` | Agent is executing a tool |
| `Max tool rounds reached` | Agent safety limit hit |
| `WARNING: JWT_SECRET not set` | Dev mode, insecure secret |
| `CRITICAL: JWT_SECRET not set. Exiting.` | Production missing JWT_SECRET |

---

## Scheduled Checks

The GitHub Actions `health-check.yml` workflow runs every 6 hours automatically:
- Checks `GET /api/health` endpoint
- Checks `GET /api/outreach/health/deep` for connector status
- Reports to GitHub Actions summary

Review the health check results in: GitHub → Actions → Auto-Connect Health Check
