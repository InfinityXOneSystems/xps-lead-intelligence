import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';
import leadsRouter from './routes/leads';
import connectorsRouter from './routes/connectors';
import adminRouter from './routes/admin';
import githubRouter from './routes/github';
import xpsRouter from './routes/xps';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Raw body needed for GitHub webhook signature verification
app.use('/api/github/webhooks', express.raw({ type: 'application/json' }));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: ['agent', 'leads', 'github', 'docker-mcp', 'sandbox', 'xps-orchestrator'],
  });
});

// Routes
app.use('/api/agent', agentRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/connectors', connectorsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/github', githubRouter);
app.use('/api/xps', xpsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`XPS Lead Intelligence API running on port ${PORT}`);
  console.log(`Features: Agent (Groq/llama3), GitHub App, Docker MCP, Sandbox, XPS Orchestrator`);
});

export default app;
