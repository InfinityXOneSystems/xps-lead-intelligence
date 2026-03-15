import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

const VALID_TYPES = ['GITHUB', 'RAILWAY', 'GPT', 'GOOGLE', 'XPS'];

// Pre-wired Railway project metadata
const RAILWAY_PROJECT_ID = '0361239a-54f7-4db8-8350-d7931d2b9260';
const RAILWAY_PROJECT_NAME = 'Lead Intelligence';
const RAILWAY_PROJECT_URL = `https://railway.app/project/${RAILWAY_PROJECT_ID}`;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const connectors = await prisma.connector.findMany();
    // Enrich Railway connector with project metadata
    const enriched = connectors.map((c) =>
      c.type === 'RAILWAY'
        ? {
            ...c,
            projectId: RAILWAY_PROJECT_ID,
            projectName: RAILWAY_PROJECT_NAME,
            projectUrl: RAILWAY_PROJECT_URL,
          }
        : c,
    );
    return res.json({ connectors: enriched });
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

    if (type === 'RAILWAY') {
      return res.json({
        ...connector,
        projectId: RAILWAY_PROJECT_ID,
        projectName: RAILWAY_PROJECT_NAME,
        projectUrl: RAILWAY_PROJECT_URL,
      });
    }
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

    const { config: userConfig, name } = req.body as { config?: Record<string, unknown>; name?: string };

    // Merge Railway project metadata into config automatically
    const config =
      type === 'RAILWAY'
        ? {
            projectId: RAILWAY_PROJECT_ID,
            projectName: RAILWAY_PROJECT_NAME,
            projectUrl: RAILWAY_PROJECT_URL,
            ...userConfig,
          }
        : (userConfig || {});

    const connector = await prisma.connector.upsert({
      where: { type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS' },
      update: {
        config: config as never,
        status: 'CONNECTED',
        lastChecked: new Date(),
        name: name || (type === 'RAILWAY' ? RAILWAY_PROJECT_NAME : type),
      },
      create: {
        type: type as 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS',
        name: name || (type === 'RAILWAY' ? RAILWAY_PROJECT_NAME : type),
        config: config as never,
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
        name: type === 'RAILWAY' ? RAILWAY_PROJECT_NAME : type,
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

