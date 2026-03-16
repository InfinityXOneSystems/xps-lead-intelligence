import { Router, Request, Response } from 'express';
import { processAgentMessage, getTaskHistory } from '../services/orchestrator';
import { ALL_TOOLS } from '../services/agent-tools';
import { isConfigured } from '../services/github';
import { prisma } from '../db/prisma';

const router = Router();

// ─── XPS Orchestrator status ──────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  const githubConfigured = isConfigured();
  const groqConfigured = !!process.env.GROQ_API_KEY;

  let githubApp = null;
  if (githubConfigured) {
    try {
      const { getAppInfo } = await import('../services/github');
      githubApp = await getAppInfo();
    } catch {
      githubApp = { error: 'Could not reach GitHub API' };
    }
  }

  return res.json({
    status: 'operational',
    capabilities: {
      llm: groqConfigured ? 'groq/llama3-8b-8192' : 'not configured',
      github: githubConfigured ? 'configured' : 'not configured',
      toolCount: ALL_TOOLS.length,
    },
    githubApp,
    tools: ALL_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
    })),
  });
});

// ─── Execute an autonomous task ───────────────────────────────────────────────

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { task, sessionId } = req.body as { task: string; sessionId?: string };
    if (!task || typeof task !== 'string') {
      return res.status(400).json({ error: 'task is required' });
    }
    const result = await processAgentMessage(task, sessionId);
    return res.json(result);
  } catch (err) {
    console.error('XPS execute error:', err);
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Task history ─────────────────────────────────────────────────────────────

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query as { sessionId?: string };
    const tasks = await getTaskHistory(sessionId);
    return res.json({ tasks });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── List available tools ─────────────────────────────────────────────────────

router.get('/tools', async (_req: Request, res: Response) => {
  return res.json({
    tools: ALL_TOOLS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
    total: ALL_TOOLS.length,
  });
});

// ─── Call a specific tool directly ────────────────────────────────────────────

router.post('/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const tool = ALL_TOOLS.find((t) => t.function.name === toolName);
    if (!tool) {
      return res.status(404).json({ error: `Tool '${toolName}' not found` });
    }

    const { executeTool } = await import('../services/agent-tools');
    const result = await executeTool(toolName, req.body as Record<string, unknown>);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Agent sessions ───────────────────────────────────────────────────────────

router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.agentSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { sessionId: true, createdAt: true, updatedAt: true },
    });
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
