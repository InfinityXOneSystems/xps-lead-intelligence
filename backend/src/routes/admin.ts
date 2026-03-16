import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.adminConfig.findMany();
    const configMap = configs.reduce<Record<string, unknown>>((acc, cfg) => {
      acc[cfg.key] = cfg.value;
      return acc;
    }, {});
    return res.json({ config: configMap });
  } catch (err) {
    console.error('Get config error:', err);
    return res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, unknown>;

    const results = await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.adminConfig.upsert({
          where: { key },
          update: { value: value as never },
          create: { key, value: value as never },
        })
      )
    );

    return res.json({ updated: results.length, config: updates });
  } catch (err) {
    console.error('Update config error:', err);
    return res.status(500).json({ error: 'Failed to update config' });
  }
});

router.get('/config/:key', async (req: Request, res: Response) => {
  try {
    const config = await prisma.adminConfig.findUnique({
      where: { key: req.params.key },
    });
    if (!config) return res.status(404).json({ error: 'Config key not found' });
    return res.json({ key: config.key, value: config.value });
  } catch (err) {
    console.error('Get config key error:', err);
    return res.status(500).json({ error: 'Failed to fetch config key' });
  }
});

export default router;
