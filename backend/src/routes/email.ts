import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma';
import { sendEmail, sendCampaign, generateEmailWithLLM, renderTemplate } from '../services/email';
import { chatCompletion } from '../services/groq';

const router = Router();
const emailRateLimit = rateLimit({ windowMs: 60_000, max: 60 });

// ── Email Templates CRUD ──────────────────────────────────────────────────────

router.get('/templates', async (_req, res) => {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
  return res.json({ templates });
});

router.get('/templates/:id', async (req, res) => {
  const t = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  return res.json(t);
});

router.post('/templates', async (req, res) => {
  const { name, subject, bodyHtml, bodyText, variables, category } = req.body as Record<string, unknown>;
  if (!name || !subject || !bodyHtml) return res.status(400).json({ error: 'name, subject, bodyHtml required' });
  const t = await prisma.emailTemplate.create({
    data: {
      name: String(name),
      subject: String(subject),
      bodyHtml: String(bodyHtml),
      bodyText: String(bodyText || ''),
      variables: (variables as never) || [],
      category: String(category || 'outreach'),
    },
  });
  return res.status(201).json(t);
});

router.put('/templates/:id', async (req, res) => {
  const t = await prisma.emailTemplate.update({
    where: { id: req.params.id },
    data: req.body as Record<string, unknown>,
  });
  return res.json(t);
});

router.delete('/templates/:id', async (req, res) => {
  await prisma.emailTemplate.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// ── LLM template generation ───────────────────────────────────────────────────

router.post('/templates/generate', async (req, res) => {
  const { purpose, businessType, tone, variables } = req.body as Record<string, string>;
  if (!purpose) return res.status(400).json({ error: 'purpose required' });

  const prompt = `Generate a professional business outreach email template.
Purpose: ${purpose}
Business type: ${businessType || 'general'}
Tone: ${tone || 'professional'}
Variables to use (wrap in {{}}): ${variables || 'businessName, ownerName, specialities'}

Return JSON: {
  "name": "template name",
  "subject": "email subject with {{variables}}",
  "bodyHtml": "<html body with {{variables}}>",
  "bodyText": "plain text with {{variables}}",
  "variables": ["businessName", "ownerName"]
}`;

  const resp = await chatCompletion([
    { role: 'system', content: 'You are an expert email marketer. Return only JSON.' },
    { role: 'user', content: prompt },
  ]);
  const match = resp.match(/\{[\s\S]*\}/);
  if (!match) return res.status(500).json({ error: 'LLM generation failed' });
  return res.json(JSON.parse(match[0]));
});

// ── Email preview ─────────────────────────────────────────────────────────────

router.post('/templates/:id/preview', async (req, res) => {
  const t = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  const vars = req.body as Record<string, string>;
  return res.json({
    subject: renderTemplate(t.subject, vars),
    bodyHtml: renderTemplate(t.bodyHtml, vars),
    bodyText: renderTemplate(t.bodyText, vars),
  });
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.get('/campaigns', async (_req, res) => {
  const campaigns = await prisma.emailCampaign.findMany({
    include: { template: { select: { name: true } }, _count: { select: { sends: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ campaigns });
});

router.post('/campaigns', async (req, res) => {
  const { name, templateId, leadFilter, scheduledAt } = req.body as Record<string, unknown>;
  if (!name || !templateId) return res.status(400).json({ error: 'name and templateId required' });
  const c = await prisma.emailCampaign.create({
    data: {
      name: String(name),
      templateId: String(templateId),
      leadFilter: (leadFilter as never) || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt as string) : undefined,
    },
  });
  return res.status(201).json(c);
});

router.post('/campaigns/:id/send', emailRateLimit, async (req, res) => {
  try {
    const result = await sendCampaign(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Single email send ─────────────────────────────────────────────────────────

router.post('/send', emailRateLimit, async (req, res) => {
  const { to, subject, bodyHtml, bodyText, leadId, fromName } = req.body as Record<string, string>;
  if (!to || !subject || !bodyHtml) return res.status(400).json({ error: 'to, subject, bodyHtml required' });
  try {
    const result = await sendEmail({ to, subject, bodyHtml, bodyText, leadId, fromName });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── LLM-personalized single send ──────────────────────────────────────────────

router.post('/send-ai', emailRateLimit, async (req, res) => {
  const { leadId, purpose, templateHint } = req.body as Record<string, string>;
  if (!leadId || !purpose) return res.status(400).json({ error: 'leadId and purpose required' });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  try {
    const { subject, bodyHtml, bodyText } = await generateEmailWithLLM(
      { businessName: lead.businessName || lead.company || '', ownerName: lead.ownerName || lead.name || '', specialities: lead.specialities || '' },
      purpose,
      templateHint,
    );
    const result = await sendEmail({ to: lead.businessEmail || lead.email, subject, bodyHtml, bodyText, leadId });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Email history ─────────────────────────────────────────────────────────────

router.get('/sends', async (req, res) => {
  const { leadId, campaignId } = req.query as Record<string, string>;
  const sends = await prisma.emailSend.findMany({
    where: { ...(leadId ? { leadId } : {}), ...(campaignId ? { campaignId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return res.json({ sends });
});

export default router;
