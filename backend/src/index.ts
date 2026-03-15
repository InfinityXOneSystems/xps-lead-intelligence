import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';
import leadsRouter from './routes/leads';
import connectorsRouter from './routes/connectors';
import adminRouter from './routes/admin';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Routes
app.use('/api/agent', agentRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/connectors', connectorsRouter);
app.use('/api/admin', adminRouter);

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
});

export default app;
