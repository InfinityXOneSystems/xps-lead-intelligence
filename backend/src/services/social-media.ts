/**
 * Real Social Media service — Twitter API v2, LinkedIn API, Instagram Graph API.
 * All real API calls, no mocks. Tokens stored in SocialAccount DB records.
 */

import * as https from 'https';
import { prisma } from '../db/prisma';
import { chatCompletion } from './groq';

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function apiPost(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function apiGet(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(body); }
      });
    });
    req.on('error', reject);
  });
}

// ─── Twitter API v2 ───────────────────────────────────────────────────────────

export async function twitterPost(
  accessToken: string,
  content: string,
): Promise<{ id: string; text: string }> {
  const resp = await apiPost(
    'https://api.twitter.com/2/tweets',
    { text: content },
    { Authorization: `Bearer ${accessToken}` },
  ) as { data?: { id: string; text: string }; errors?: { message: string }[] };
  if (resp.errors?.length) throw new Error(resp.errors[0].message);
  return resp.data!;
}

export async function twitterReply(
  accessToken: string,
  content: string,
  inReplyToId: string,
): Promise<{ id: string }> {
  const resp = await apiPost(
    'https://api.twitter.com/2/tweets',
    { text: content, reply: { in_reply_to_tweet_id: inReplyToId } },
    { Authorization: `Bearer ${accessToken}` },
  ) as { data?: { id: string }; errors?: { message: string }[] };
  if (resp.errors?.length) throw new Error(resp.errors[0].message);
  return resp.data!;
}

export async function twitterGetDMs(bearerToken: string, userId: string): Promise<unknown[]> {
  const resp = await apiGet(
    `https://api.twitter.com/2/dm_conversations?participant_id=${userId}&expansions=participant_ids`,
    { Authorization: `Bearer ${bearerToken}` },
  ) as { data?: unknown[] };
  return resp.data || [];
}

// ─── LinkedIn API ─────────────────────────────────────────────────────────────

export async function linkedinPost(
  accessToken: string,
  authorUrn: string,
  content: string,
): Promise<{ id: string }> {
  const resp = await apiPost(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  ) as { id?: string; serviceErrorCode?: number; message?: string };
  if (resp.message) throw new Error(resp.message);
  return { id: resp.id || 'unknown' };
}

// ─── Instagram Graph API ─────────────────────────────────────────────────────

export async function instagramPost(
  accessToken: string,
  igUserId: string,
  caption: string,
  imageUrl?: string,
): Promise<{ id: string }> {
  // Step 1: Create media container
  const mediaParams = new URLSearchParams({
    caption,
    access_token: accessToken,
    ...(imageUrl ? { image_url: imageUrl, media_type: 'IMAGE' } : {}),
  });
  const containerResp = await apiGet(
    `https://graph.facebook.com/v18.0/${igUserId}/media?${mediaParams}`,
    {},
  ) as { id?: string; error?: { message: string } };
  if (containerResp.error) throw new Error(containerResp.error.message);

  // Step 2: Publish
  const publishParams = new URLSearchParams({
    creation_id: containerResp.id!,
    access_token: accessToken,
  });
  const publishResp = await apiGet(
    `https://graph.facebook.com/v18.0/${igUserId}/media_publish?${publishParams}`,
    {},
  ) as { id?: string; error?: { message: string } };
  if (publishResp.error) throw new Error(publishResp.error.message);
  return { id: publishResp.id! };
}

// ─── LLM content generation ───────────────────────────────────────────────────

export async function generateSocialContent(
  platform: string,
  topic: string,
  tone: string = 'professional',
  includeHashtags = true,
): Promise<{ content: string; hashtags: string[] }> {
  const maxChars = platform === 'TWITTER' ? 280 : platform === 'LINKEDIN' ? 3000 : 2200;

  const resp = await chatCompletion([
    {
      role: 'system',
      content: 'You are a social media content expert. Return only JSON.',
    },
    {
      role: 'user',
      content: `Create a ${platform} post about: "${topic}"
Tone: ${tone}
Max characters: ${maxChars}
Include hashtags: ${includeHashtags}

Return JSON: { "content": "...", "hashtags": ["#tag1", "#tag2"] }`,
    },
  ]);

  try {
    const match = resp.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    return JSON.parse(match[0]) as { content: string; hashtags: string[] };
  } catch {
    return { content: topic, hashtags: [] };
  }
}

export async function generateAutoReply(
  platform: string,
  inboundMessage: string,
  senderHandle: string,
  businessContext: string,
): Promise<string> {
  const resp = await chatCompletion([
    { role: 'system', content: 'You are a professional social media community manager. Write helpful, on-brand replies. Be concise and friendly.' },
    {
      role: 'user',
      content: `Platform: ${platform}
Sender: @${senderHandle}
Their message: "${inboundMessage}"
Business context: ${businessContext}

Write a professional reply (max 200 chars for Twitter, 500 for others). Return ONLY the reply text, no quotes.`,
    },
  ]);
  return resp.trim().replace(/^["']|["']$/g, '');
}

// ─── Autonomous post scheduler ─────────────────────────────────────────────────

export async function processScheduledPosts(): Promise<{ published: number; failed: number }> {
  const now = new Date();
  const scheduled = await prisma.socialPost.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    include: { account: true },
  });

  let published = 0;
  let failed = 0;

  for (const post of scheduled) {
    try {
      const token = post.account.accessToken;
      if (!token) throw new Error('No access token');

      let platformPostId: string | undefined;

      switch (post.platform) {
        case 'TWITTER':
          platformPostId = (await twitterPost(token, post.content)).id;
          break;
        case 'LINKEDIN': {
          const profileData = post.account.profileData as { urn?: string };
          platformPostId = (await linkedinPost(token, profileData.urn || '', post.content)).id;
          break;
        }
        case 'INSTAGRAM': {
          const igData = post.account.profileData as { userId?: string };
          platformPostId = (await instagramPost(token, igData.userId || '', post.content)).id;
          break;
        }
      }

      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), platformPostId },
      });
      published++;
    } catch (err) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'FAILED', error: String(err) },
      });
      failed++;
    }
  }

  return { published, failed };
}

// ─── Autonomous inbound message reply ─────────────────────────────────────────

export async function processInboundMessages(): Promise<{ processed: number; replied: number }> {
  const pending = await prisma.socialInboundMessage.findMany({
    where: { autoReplyStatus: 'PENDING', requiresReply: true },
    include: { account: true },
    take: 20,
  });

  let processed = 0;
  let replied = 0;

  for (const msg of pending) {
    processed++;
    try {
      const businessContext = process.env.BUSINESS_CONTEXT || 'We are a lead intelligence platform helping businesses grow.';
      const reply = await generateAutoReply(
        msg.platform,
        msg.content,
        msg.senderHandle,
        businessContext,
      );

      const token = msg.account.accessToken;
      if (!token) throw new Error('No access token');

      if (msg.platform === 'TWITTER' && msg.platformMessageId) {
        await twitterReply(token, reply, msg.platformMessageId);
      }

      await prisma.socialInboundMessage.update({
        where: { id: msg.id },
        data: {
          autoReplyStatus: 'SENT',
          autoReplySentAt: new Date(),
          autoReplyContent: reply,
          isRead: true,
        },
      });
      replied++;
    } catch (err) {
      await prisma.socialInboundMessage.update({
        where: { id: msg.id },
        data: { autoReplyStatus: 'FAILED' },
      });
      console.error('Auto-reply failed:', err);
    }
  }

  return { processed, replied };
}
