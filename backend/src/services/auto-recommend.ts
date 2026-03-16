/**
 * Auto-Recommend service — real LLM-powered context-aware suggestions.
 * Analyzes conversation history and current section to generate relevant
 * actionable recommendations for the user.
 */

import { chatCompletion } from './groq';
import { cacheGet, cacheSet } from './redis';

export interface Recommendation {
  id: string;
  text: string;
  category: 'action' | 'question' | 'insight' | 'tool';
  priority: 'high' | 'medium' | 'low';
}

const SECTION_CONTEXTS: Record<string, string> = {
  agent: 'AI Agent chat interface — the user is working with the autonomous XPS agent',
  leads: 'Leads CRM — viewing business leads with scores, contact info, and outreach status',
  scraper: 'Live web scraper — actively scraping business directories for leads',
  outreach: 'Email outreach — managing email campaigns and follow-up scheduling',
  social: 'Social media agent — managing autonomous social media posting and engagement',
  'social-crm': 'Social CRM — managing inbound social media messages and replies',
  dashboard: 'Main dashboard — overview of all system metrics',
  github: 'GitHub panel — managing repositories, issues, and workflows',
  editor: 'AI Visual Editor — building UI components through natural language',
  sandbox: 'Sandbox — creating and managing Docker app environments',
};

export async function generateRecommendations(
  activeSection: string,
  recentMessages: string[],
  leadCount?: number,
  pendingEmails?: number,
  pendingMessages?: number,
): Promise<Recommendation[]> {
  const cacheKey = `recs:${activeSection}:${recentMessages.slice(-2).join('|').slice(0, 100)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as Recommendation[];

  const sectionContext = SECTION_CONTEXTS[activeSection] || activeSection;
  const conversationContext = recentMessages.length > 0
    ? `Recent conversation:\n${recentMessages.slice(-4).map((m, i) => `${i % 2 === 0 ? 'User' : 'Agent'}: ${m.slice(0, 120)}`).join('\n')}`
    : 'No recent conversation.';

  const statsContext = [
    leadCount !== undefined ? `${leadCount} leads in database` : '',
    pendingEmails ? `${pendingEmails} emails pending` : '',
    pendingMessages ? `${pendingMessages} social messages need replies` : '',
  ].filter(Boolean).join(', ');

  const prompt = `You are a proactive AI assistant for a lead intelligence platform. 
Current section: ${sectionContext}
${conversationContext}
${statsContext ? `System stats: ${statsContext}` : ''}

Generate 4-5 specific, actionable recommendations for what the user should do next.
Focus on the current context. Be concrete and specific — not generic.

Return JSON array:
[
  { "id": "1", "text": "specific action or question", "category": "action|question|insight|tool", "priority": "high|medium|low" }
]`;

  try {
    const response = await chatCompletion(
      [{ role: 'user', content: prompt }],
      'llama3-8b-8192', // Fast model for recommendations
    );
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No array in response');
    const recs = JSON.parse(match[0]) as Recommendation[];
    await cacheSet(cacheKey, JSON.stringify(recs), 120); // Cache 2 minutes
    return recs;
  } catch {
    // Return sensible defaults per section
    return getDefaultRecommendations(activeSection, leadCount, pendingEmails, pendingMessages);
  }
}

function getDefaultRecommendations(
  section: string,
  leadCount?: number,
  pendingEmails?: number,
  pendingMessages?: number,
): Recommendation[] {
  const defaults: Record<string, Recommendation[]> = {
    agent: [
      { id: '1', text: 'Scrape roofing contractors in Dallas TX', category: 'action', priority: 'high' },
      { id: '2', text: 'Export all leads to Google Sheets', category: 'action', priority: 'high' },
      { id: '3', text: 'Send outreach campaign to top-scored leads', category: 'action', priority: 'medium' },
      { id: '4', text: 'Generate a follow-up email template', category: 'tool', priority: 'medium' },
    ],
    leads: [
      { id: '1', text: leadCount ? `Score and rank your ${leadCount} leads by priority` : 'Start scraping to get leads', category: 'action', priority: 'high' },
      { id: '2', text: 'Export CRM data to Google Sheets', category: 'action', priority: 'high' },
      { id: '3', text: 'Create an email campaign for high-score leads (70+)', category: 'action', priority: 'medium' },
      { id: '4', text: 'Schedule Google Calendar follow-ups for qualified leads', category: 'action', priority: 'medium' },
    ],
    scraper: [
      { id: '1', text: 'Scrape HVAC businesses in Phoenix AZ: yelp:hvac:Phoenix AZ', category: 'action', priority: 'high' },
      { id: '2', text: 'Scrape plumbers in Houston TX: yellowpages:plumbers:Houston TX', category: 'action', priority: 'high' },
      { id: '3', text: 'Run parallel scrape across multiple cities', category: 'action', priority: 'medium' },
      { id: '4', text: 'Auto-score scraped leads after import', category: 'action', priority: 'medium' },
    ],
    outreach: [
      { id: '1', text: pendingEmails ? `Send ${pendingEmails} pending emails now` : 'Create your first email campaign', category: 'action', priority: 'high' },
      { id: '2', text: 'Generate a personalized outreach template with LLM', category: 'tool', priority: 'high' },
      { id: '3', text: 'Schedule follow-up reminders in Google Calendar', category: 'action', priority: 'medium' },
      { id: '4', text: 'Set up automated follow-up sequences', category: 'action', priority: 'medium' },
    ],
    social: [
      { id: '1', text: 'Generate and schedule 5 LinkedIn posts this week', category: 'action', priority: 'high' },
      { id: '2', text: 'Set up auto-reply for incoming messages', category: 'action', priority: 'high' },
      { id: '3', text: pendingMessages ? `Reply to ${pendingMessages} pending social messages` : 'Connect your social accounts in Settings', category: 'action', priority: 'high' },
      { id: '4', text: 'Create a content calendar for the month', category: 'action', priority: 'medium' },
    ],
    'social-crm': [
      { id: '1', text: pendingMessages ? `Process ${pendingMessages} unanswered messages` : 'No pending messages', category: 'action', priority: 'high' },
      { id: '2', text: 'Enable autonomous auto-reply for new messages', category: 'action', priority: 'high' },
      { id: '3', text: 'Create reply templates for common inquiries', category: 'tool', priority: 'medium' },
    ],
  };
  return defaults[section] || defaults.agent;
}
