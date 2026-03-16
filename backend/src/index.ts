import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';
import leadsRouter from './routes/leads';
import connectorsRouter from './routes/connectors';
import adminRouter from './routes/admin';
import githubRouter from './routes/github';
import xpsRouter from './routes/xps';
import emailRouter from './routes/email';
import socialRouter from './routes/social';
import outreachRouter from './routes/outreach';
import authRouter from './routes/auth';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use('/api/github/webhooks', express.raw({ type: 'application/json' }));

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['agent', 'leads-crm', 'live-scraper', 'email-outreach', 'google-sheets', 'google-calendar', 'social-media', 'social-crm', 'github', 'docker-mcp', 'sandbox', 'auto-recommend'],
  });
});

app.use('/api/agent', agentRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/connectors', connectorsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/github', githubRouter);
app.use('/api/xps', xpsRouter);
app.use('/api/email', emailRouter);
app.use('/api/social', socialRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/auth', authRouter);

// Convenience aliases matching the platform API contract (canonical paths above).
// Deprecation target: v3.0 — external integrations should migrate to canonical paths.
// See docs/DEPLOYMENT_FLOW.md for migration timeline.
app.use('/api/chat', agentRouter);        // /api/chat → agent chat (canonical: /api/agent)
app.use('/api/scrape', leadsRouter);      // /api/scrape → leads scraper (canonical: /api/leads/scrape)
app.use('/api/agents', agentRouter);      // /api/agents → agent runtime (canonical: /api/agent)
app.use('/api/settings', adminRouter);    // /api/settings → admin config (canonical: /api/admin)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`XPS Lead Intelligence API v2.0 on port ${PORT}`);
});

export default app;
