import Groq from 'groq-sdk';
import type { ToolDefinition } from './agent-tools';

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }
  return groqClient;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatWithToolsResponse {
  message: string;
  toolCalls?: ToolCallRequest[];
}

// Simple text completion (no tools)
export async function chatCompletion(
  messages: ChatMessage[],
  model = 'llama3-8b-8192',
): Promise<string> {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    messages,
    model,
    temperature: 0.7,
    max_tokens: 2048,
  });
  return completion.choices[0]?.message?.content || '';
}

// Tool-calling completion — returns either tool calls or a final text response
export async function chatWithTools(
  messages: ChatMessage[],
  tools: ToolDefinition[],
  model = 'llama3-8b-8192',
): Promise<ChatWithToolsResponse> {
  const client = getGroqClient();

  const completion = await client.chat.completions.create({
    messages,
    model,
    tools: tools as Groq.Chat.Completions.ChatCompletionTool[],
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 4096,
  });

  const choice = completion.choices[0];
  if (!choice) return { message: '' };

  const toolCalls = choice.message?.tool_calls as ToolCallRequest[] | undefined;
  const content = choice.message?.content || '';

  if (toolCalls && toolCalls.length > 0) {
    return { message: content, toolCalls };
  }

  return { message: content };
}

