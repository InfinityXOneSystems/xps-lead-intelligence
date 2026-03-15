import { Router, Request, Response } from 'express';
import { processAgentMessage, getSessionHistory } from '../services/orchestrator';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await processAgentMessage(message, sessionId);
    return res.json(response);
  } catch (err) {
    console.error('Agent chat error:', err);
    return res.status(500).json({ error: 'Agent processing failed' });
  }
});

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const history = await getSessionHistory(sessionId);
    return res.json({ sessionId, messages: history });
  } catch (err) {
    console.error('Session fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;

