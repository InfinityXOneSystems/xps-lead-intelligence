import { v4 as uuidv4 } from 'uuid';
import { chatCompletion, ChatMessage } from './groq';
import { prisma } from '../db/prisma';
import { cacheGet, cacheSet } from './redis';

const SYSTEM_PROMPT = `You are XPS Lead Intelligence Orchestrator, an autonomous AI agent for lead intelligence and business development.

You can help with:
- Searching and qualifying leads
- Analyzing company information
- Managing CRM workflows
- Connecting to external services (GitHub, Railway, Google, etc.)
- Generating outreach strategies
- Analyzing market trends

When asked to perform an action, describe what you would do and provide structured results.
Always be professional, concise, and actionable in your responses.`;

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
    result?: unknown;
  };
}

export async function processAgentMessage(
  userMessage: string,
  sessionId?: string
): Promise<AgentResponse> {
  const sid = sessionId || uuidv4();

  // Load or create session
  let session = await prisma.agentSession.findUnique({
    where: { sessionId: sid },
  });

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        sessionId: sid,
        messages: [],
        context: {},
      },
    });
  }

  const sessionMessages = (session.messages as unknown as AgentMessage[]) || [];

  // Build messages for LLM
  const llmMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sessionMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  // Get LLM response
  const responseText = await chatCompletion(llmMessages);

  // Update session
  const updatedMessages: AgentMessage[] = [
    ...sessionMessages,
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: responseText, timestamp: new Date().toISOString() },
  ];

  await prisma.agentSession.update({
    where: { sessionId: sid },
    data: { messages: updatedMessages as unknown as never },
  });

  // Cache recent session
  await cacheSet(`session:${sid}`, JSON.stringify(updatedMessages), 3600);

  return {
    sessionId: sid,
    message: responseText,
  };
}

export async function getSessionHistory(sessionId: string): Promise<AgentMessage[]> {
  // Try cache first
  const cached = await cacheGet(`session:${sessionId}`);
  if (cached) {
    return JSON.parse(cached) as AgentMessage[];
  }

  const session = await prisma.agentSession.findUnique({
    where: { sessionId },
  });

  return (session?.messages as unknown as AgentMessage[]) || [];
}
