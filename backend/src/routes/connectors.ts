import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

const VALID_TYPES = ['GITHUB', 'RAILWAY', 'GPT', 'GOOGLE', 'XPS'];

router.get('/', async (_req: Request, res: Response) => {
  try {
    const connectors = await prisma.connector.findMany();
    return res.json({ connectors });
  } catch (err) {
    console.error('Get connectors error:', err);
    return res.status(500).json({ error: 'Failed to fetch connectors' });
  }
});

router.get('/:type', async (req: Request, res: Response) => {
  try {
    const type = req.params.type.toUpperCase();
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid connector type' });
    }

    const connector = await prisma.connector.findUnique({
      where: { type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS' },
    });
    if (!connector) return res.status(404).json({ error: 'Connector not found' });
    return res.json(connector);
  } catch (err) {
    console.error('Get connector error:', err);
    return res.status(500).json({ error: 'Failed to fetch connector' });
  }
});

router.post('/:type/connect', async (req: Request, res: Response) => {
  try {
    const type = req.params.type.toUpperCase();
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid connector type' });
    }

    const { config, name } = req.body as { config?: Record<string, unknown>; name?: string };

    const connector = await prisma.connector.upsert({
      where: { type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS' },
      update: {
        config: (config || {}) as never,
        status: 'CONNECTED',
        lastChecked: new Date(),
        name: name || type,
      },
      create: {
        type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS',
        name: name || type,
        config: (config || {}) as never,
        status: 'CONNECTED',
        lastChecked: new Date(),
      },
    });

    return res.json({ connector, message: `${type} connector connected` });
  } catch (err) {
    console.error('Connect error:', err);
    return res.status(500).json({ error: 'Failed to connect' });
  }
});

router.post('/:type/disconnect', async (req: Request, res: Response) => {
  try {
    const type = req.params.type.toUpperCase();
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid connector type' });
    }

    const connector = await prisma.connector.upsert({
      where: { type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS' },
      update: { status: 'DISCONNECTED', lastChecked: new Date() },
      create: {
        type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS',
        name: type,
        config: {},
        status: 'DISCONNECTED',
      },
    });

    return res.json({ connector, message: `${type} connector disconnected` });
  } catch (err) {
    console.error('Disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
