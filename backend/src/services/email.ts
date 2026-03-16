/**
 * Real email service using Nodemailer + Gmail OAuth2.
 * Sends real emails — no simulation.
 * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in env.
 */

import nodemailer from 'nodemailer';
import { prisma } from '../db/prisma';
import { chatCompletion } from './groq';
import { stripHtml } from '../utils/sanitize';

// ─── Transport creation ────────────────────────────────────────────────────────

function createTransport() {
  // Gmail OAuth2 (preferred)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER || process.env.GOOGLE_USER_EMAIL,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
  }
  // SMTP fallback (for SendGrid, SMTP2Go, Mailgun, etc.)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  throw new Error('Email not configured. Set GOOGLE_CLIENT_ID+SECRET+REFRESH_TOKEN or SMTP_HOST+USER+PASS in .env');
}

// ─── Template rendering ────────────────────────────────────────────────────────

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

export async function generateEmailWithLLM(
  leadData: Record<string, string>,
  purpose: string,
  templateHint?: string,
): Promise<{ subject: string; bodyHtml: string; bodyText: string }> {
  const prompt = `You are a professional business development email writer. Write a personalized outreach email.

Business: ${leadData.businessName || 'the business'}
Owner: ${leadData.ownerName || 'Business Owner'}
Industry: ${leadData.specialities || 'general business'}
${templateHint ? `Base template hint: ${templateHint}` : ''}
Purpose: ${purpose}

Requirements:
- Professional, concise, personalized
- Clear value proposition
- Specific call-to-action
- 150-200 words max

Return a JSON object with exactly these keys:
{
  "subject": "email subject line",
  "bodyHtml": "full HTML email body",
  "bodyText": "plain text version"
}`;

  const response = await chatCompletion([
    { role: 'system', content: 'You are an email writing expert. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in LLM response');
    return JSON.parse(jsonMatch[0]) as { subject: string; bodyHtml: string; bodyText: string };
  } catch {
    return {
      subject: `Quick note for ${leadData.businessName || 'your business'}`,
      bodyHtml: `<p>Hi ${leadData.ownerName || 'there'},</p><p>${purpose}</p><p>Best regards</p>`,
      bodyText: `Hi ${leadData.ownerName || 'there'},\n\n${purpose}\n\nBest regards`,
    };
  }
}

// ─── Send a single email ──────────────────────────────────────────────────────

export interface SendEmailOpts {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  replyTo?: string;
  leadId?: string;
  campaignId?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ messageId: string }> {
  const transport = createTransport();
  const fromAddress = process.env.GMAIL_USER || process.env.SMTP_USER || 'noreply@xps.ai';
  const fromName = opts.fromName || process.env.EMAIL_FROM_NAME || 'XPS Lead Intelligence';

  const info = await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: opts.to,
    replyTo: opts.replyTo || fromAddress,
    subject: opts.subject,
    html: opts.bodyHtml,
    text: opts.bodyText || stripHtml(opts.bodyHtml),
  });

  // Record in DB
  if (opts.leadId) {
    await prisma.emailSend.create({
      data: {
        leadId: opts.leadId,
        campaignId: opts.campaignId,
        toEmail: opts.to,
        subject: opts.subject,
        status: 'SENT',
        messageId: info.messageId,
        sentAt: new Date(),
      },
    });
    await prisma.lead.update({
      where: { id: opts.leadId },
      data: { outreachStatus: 'EMAIL_SENT' },
    });
  }

  return { messageId: info.messageId };
}

// ─── Mass campaign send ────────────────────────────────────────────────────────

export interface CampaignSendResult {
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendCampaign(campaignId: string): Promise<CampaignSendResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING' },
  });

  // Load leads matching filter
  const filter = campaign.leadFilter as Record<string, unknown>;
  const leads = await prisma.lead.findMany({
    where: {
      outreachStatus: 'NOT_CONTACTED',
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.minScore ? { leadScore: { gte: filter.minScore as number } } : {}),
    },
    take: (filter.limit as number) || 500,
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send with small delay between each to avoid rate limits
  for (const lead of leads) {
    try {
      const vars: Record<string, string> = {
        businessName: lead.businessName || lead.company || '',
        ownerName: lead.ownerName || lead.name || 'there',
        businessPhone: lead.businessPhone || lead.phone || '',
        businessWebsite: lead.businessWebsite || lead.website || '',
        specialities: lead.specialities || '',
      };
      const subject = renderTemplate(campaign.template.subject, vars);
      const bodyHtml = renderTemplate(campaign.template.bodyHtml, vars);
      const bodyText = renderTemplate(campaign.template.bodyText, vars);

      await sendEmail({
        to: lead.businessEmail || lead.email,
        subject,
        bodyHtml,
        bodyText,
        leadId: lead.id,
        campaignId,
      });
      sent++;
      // Rate limiting: 1 email per 100ms
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      failed++;
      errors.push(`${lead.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENT', sentAt: new Date() },
  });

  return { sent, failed, errors };
}
