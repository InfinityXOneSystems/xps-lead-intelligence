import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma';
import {
  generateSocialContent, generateAutoReply,
  twitterPost, linkedinPost, instagramPost,
  processScheduledPosts, processInboundMessages,
} from '../services/social-media';

const router = Router();
const postLimit = rateLimit({ windowMs: 60_000, max: 30 });

// ── Social Accounts ────────────────────────────────────────────────────────────

router.get('/accounts', async (_req, res) => {
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { platform: 'asc' },
    select: {
      id: true, platform: true, handle: true, isActive: true,
      autoPost: true, autoReply: true, profileData: true,
      tokenExpiry: true, createdAt: true, updatedAt: true,
      _count: { select: { posts: true, inboundMessages: true } },
    },
  });
  return res.json({ accounts });
});

router.post('/accounts', async (req, res) => {
  const { platform, handle, accessToken, refreshToken, profileData, autoPost, autoReply } = req.body as Record<string, unknown>;
  if (!platform || !handle) return res.status(400).json({ error: 'platform and handle required' });
  const account = await prisma.socialAccount.upsert({
    where: { platform: platform as never },
    update: {
      handle: String(handle),
      accessToken: accessToken ? String(accessToken) : undefined,
      refreshToken: refreshToken ? String(refreshToken) : undefined,
      profileData: (profileData as never) || {},
      autoPost: Boolean(autoPost),
      autoReply: Boolean(autoReply),
      isActive: true,
    },
    create: {
      platform: platform as never,
      handle: String(handle),
      accessToken: accessToken ? String(accessToken) : undefined,
      refreshToken: refreshToken ? String(refreshToken) : undefined,
      profileData: (profileData as never) || {},
      autoPost: Boolean(autoPost),
      autoReply: Boolean(autoReply),
    },
  });
  return res.json(account);
});

router.patch('/accounts/:id', async (req, res) => {
  const account = await prisma.socialAccount.update({
    where: { id: req.params.id },
    data: req.body as Record<string, unknown>,
  });
  return res.json(account);
});

router.delete('/accounts/:id', async (req, res) => {
  await prisma.socialAccount.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// ── Generate content ──────────────────────────────────────────────────────────

router.post('/generate', async (req, res) => {
  const { platform, topic, tone, includeHashtags } = req.body as Record<string, unknown>;
  if (!platform || !topic) return res.status(400).json({ error: 'platform and topic required' });
  try {
    const result = await generateSocialContent(String(platform), String(topic), String(tone || 'professional'), Boolean(includeHashtags !== false));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Posts ─────────────────────────────────────────────────────────────────────

router.get('/posts', async (req, res) => {
  const { accountId, platform, status } = req.query as Record<string, string>;
  const posts = await prisma.socialPost.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      ...(platform ? { platform: platform as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { account: { select: { handle: true, platform: true } } },
  });
  return res.json({ posts });
});

router.post('/posts', postLimit, async (req, res) => {
  const { accountId, content, scheduledAt } = req.body as Record<string, unknown>;
  if (!accountId || !content) return res.status(400).json({ error: 'accountId and content required' });

  const account = await prisma.socialAccount.findUnique({ where: { id: String(accountId) } });
  if (!account) return res.status(404).json({ error: 'Social account not found' });

  // If no schedule, post immediately
  if (!scheduledAt) {
    try {
      let platformPostId: string | undefined;
      switch (account.platform) {
        case 'TWITTER':
          platformPostId = (await twitterPost(account.accessToken!, String(content))).id;
          break;
        case 'LINKEDIN': {
          const pd = account.profileData as { urn?: string };
          platformPostId = (await linkedinPost(account.accessToken!, pd.urn || '', String(content))).id;
          break;
        }
        case 'INSTAGRAM': {
          const ig = account.profileData as { userId?: string };
          platformPostId = (await instagramPost(account.accessToken!, ig.userId || '', String(content))).id;
          break;
        }
      }
      const post = await prisma.socialPost.create({
        data: {
          accountId: String(accountId),
          content: String(content),
          platform: account.platform,
          status: 'PUBLISHED',
          platformPostId,
          publishedAt: new Date(),
        },
      });
      return res.status(201).json(post);
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Scheduled post
  const post = await prisma.socialPost.create({
    data: {
      accountId: String(accountId),
      content: String(content),
      platform: account.platform,
      status: 'SCHEDULED',
      scheduledAt: new Date(scheduledAt as string),
    },
  });
  return res.status(201).json(post);
});

// ── Process scheduled posts ────────────────────────────────────────────────────

router.post('/posts/process-scheduled', async (_req, res) => {
  const result = await processScheduledPosts();
  return res.json(result);
});

// ── Inbound messages ──────────────────────────────────────────────────────────

router.get('/inbound', async (req, res) => {
  const { platform, unread, requiresReply } = req.query as Record<string, string>;
  const msgs = await prisma.socialInboundMessage.findMany({
    where: {
      ...(platform ? { platform: platform as never } : {}),
      ...(unread === 'true' ? { isRead: false } : {}),
      ...(requiresReply === 'true' ? { requiresReply: true } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { account: { select: { handle: true, platform: true } } },
  });
  return res.json({ messages: msgs, total: msgs.length });
});

router.post('/inbound', async (req, res) => {
  // Ingest an inbound message (webhook or manual entry)
  const { accountId, platformMessageId, senderHandle, senderName, content, messageType, threadId } = req.body as Record<string, unknown>;
  if (!accountId || !platformMessageId || !senderHandle || !content) {
    return res.status(400).json({ error: 'accountId, platformMessageId, senderHandle, content required' });
  }
  const account = await prisma.socialAccount.findUnique({ where: { id: String(accountId) } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const msg = await prisma.socialInboundMessage.upsert({
    where: { platformMessageId: String(platformMessageId) },
    update: { isRead: false },
    create: {
      accountId: String(accountId),
      platform: account.platform,
      platformMessageId: String(platformMessageId),
      senderHandle: String(senderHandle),
      senderName: senderName ? String(senderName) : undefined,
      content: String(content),
      messageType: (messageType as never) || 'DIRECT',
      threadId: threadId ? String(threadId) : undefined,
    },
  });
  return res.status(201).json(msg);
});

router.post('/inbound/:id/reply', postLimit, async (req, res) => {
  const { content } = req.body as { content: string };
  if (!content) return res.status(400).json({ error: 'content required' });

  const msg = await prisma.socialInboundMessage.findUnique({
    where: { id: req.params.id },
    include: { account: true },
  });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  try {
    if (msg.platform === 'TWITTER' && msg.account.accessToken) {
      await twitterPost(msg.account.accessToken, content);
    }
    await prisma.socialInboundMessage.update({
      where: { id: msg.id },
      data: { autoReplyStatus: 'SENT', autoReplySentAt: new Date(), autoReplyContent: content, isRead: true },
    });
    return res.json({ sent: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/inbound/:id/ai-reply', postLimit, async (req, res) => {
  const msg = await prisma.socialInboundMessage.findUnique({
    where: { id: req.params.id },
    include: { account: true },
  });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const businessContext = process.env.BUSINESS_CONTEXT || 'Lead intelligence platform for business growth';
  const reply = await generateAutoReply(msg.platform, msg.content, msg.senderHandle, businessContext);
  return res.json({ suggestedReply: reply });
});

// ── Process all pending auto-replies ──────────────────────────────────────────

router.post('/inbound/process-auto-reply', async (_req, res) => {
  const result = await processInboundMessages();
  return res.json(result);
});

// ── Mark read ─────────────────────────────────────────────────────────────────

router.patch('/inbound/:id/read', async (req, res) => {
  await prisma.socialInboundMessage.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  return res.status(204).send();
});

export default router;
