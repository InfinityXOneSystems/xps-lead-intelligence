import { v4 as uuidv4 } from 'uuid';
import { chatWithTools, ChatMessage } from './groq';
import { ALL_TOOLS, executeTool, ToolCallResult } from './agent-tools';
import { prisma } from '../db/prisma';
import { cacheGet, cacheSet } from './redis';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are XPS Lead Intelligence Orchestrator — a fully autonomous AI agent with direct access to GitHub, leads management, and system tools.

Your capabilities via tools:
- **GitHub**: List/read repos, read/write files, manage issues and PRs, trigger workflows, search code, manage releases. You have full GitHub App access via the XPS Orchestrator App.
- **Leads**: List, create, and autonomously scrape leads from any source.
- **System**: Check connector status and system health.

How to operate:
1. Always think through the task step by step.
2. Use tools aggressively — you can chain multiple tool calls to complete complex tasks.
3. After each tool result, decide whether more tool calls are needed or if you can give a final answer.
4. When writing code or files via github_write_file, write complete, working code.
5. When creating GitHub issues, write detailed, actionable descriptions.
6. Always report what actions you took and what the results were.

You are proactive, autonomous, and thorough. Never just describe what you could do — do it.`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallResult[];
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  toolCalls: ToolCallResult[];
  steps: number;
}

// ─── Agentic loop ─────────────────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 8; // safety limit on autonomous tool execution rounds

export async function processAgentMessage(
  userMessage: string,
  sessionId?: string,
): Promise<AgentResponse> {
  const sid = sessionId || uuidv4();

  // Load or create session
  let session = await prisma.agentSession.findUnique({ where: { sessionId: sid } });
  if (!session) {
    session = await prisma.agentSession.create({
      data: { sessionId: sid, messages: [], context: {} },
    });
  }

  const sessionMessages = (session.messages as unknown as AgentMessage[]) || [];

  // Build LLM conversation history
  const conversation: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sessionMessages.flatMap((m): ChatMessage[] => [
      { role: 'user', content: m.content },
      { role: 'assistant', content: m.toolCalls
        ? `${m.content}\n[Tool calls: ${m.toolCalls.map((t) => t.tool).join(', ')}]`
        : m.content },
    ]),
    { role: 'user', content: userMessage },
  ];

  const allToolCalls: ToolCallResult[] = [];
  let steps = 0;
  let finalText = '';

  // Agentic loop: LLM decides to call tools → execute → feed result back → repeat
  while (steps < MAX_TOOL_ROUNDS) {
    steps++;
    const response = await chatWithTools(conversation, ALL_TOOLS);

    if (response.toolCalls && response.toolCalls.length > 0) {
      // Execute all requested tool calls in parallel
      const results = await Promise.all(
        response.toolCalls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch { /* bad json — skip */ }
          return executeTool(tc.function.name, args);
        }),
      );
      allToolCalls.push(...results);

      // Feed tool results back into conversation
      if (response.message) {
        conversation.push({ role: 'assistant', content: response.message });
      }
      for (const result of results) {
        const resultText = result.error
          ? `Tool ${result.tool} failed: ${result.error}`
          : `Tool ${result.tool} result: ${JSON.stringify(result.output, null, 2).slice(0, 4000)}`;
        conversation.push({ role: 'user', content: resultText });
      }
      continue; // loop back for next LLM decision
    }

    // No more tool calls — final answer
    finalText = response.message || 'Task completed.';
    break;
  }

  if (!finalText) {
    finalText = `Completed ${steps} steps with ${allToolCalls.length} tool calls.`;
  }

  // Persist updated session
  const updatedMessages: AgentMessage[] = [
    ...sessionMessages,
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: finalText, timestamp: new Date().toISOString(), toolCalls: allToolCalls },
  ];

  await prisma.agentSession.update({
    where: { sessionId: sid },
    data: { messages: updatedMessages as unknown as never },
  });

  // Also log as AgentTask for audit trail
  await prisma.agentTask.create({
    data: {
      sessionId: sid,
      input: userMessage,
      output: finalText,
      toolCalls: allToolCalls as unknown as never,
      steps,
      status: 'COMPLETED',
    },
  });

  await cacheSet(`session:${sid}`, JSON.stringify(updatedMessages), 3600);

  return { sessionId: sid, message: finalText, toolCalls: allToolCalls, steps };
}

export async function getSessionHistory(sessionId: string): Promise<AgentMessage[]> {
  const cached = await cacheGet(`session:${sessionId}`);
  if (cached) return JSON.parse(cached) as AgentMessage[];

  const session = await prisma.agentSession.findUnique({ where: { sessionId } });
  return (session?.messages as unknown as AgentMessage[]) || [];
}

export async function getTaskHistory(sessionId?: string) {
  return prisma.agentTask.findMany({
    where: sessionId ? { sessionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

