'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RefreshCw, ChevronDown, ChevronRight, Zap, Terminal } from 'lucide-react';
import { api, ToolCallResult } from '@/lib/api';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallResult[];
  steps?: number;
}

function ToolCallBadge({ tool, durationMs, error }: { tool: string; durationMs: number; error?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
      style={{
        background: error ? 'rgba(252,129,129,0.1)' : 'rgba(99,179,237,0.08)',
        border: `1px solid ${error ? 'rgba(252,129,129,0.3)' : 'rgba(99,179,237,0.2)'}`,
        color: error ? '#fc8181' : 'var(--electric-1)',
      }}>
      <Zap className="w-2.5 h-2.5" />
      {tool}
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>{durationMs}ms</span>
    </span>
  );
}

const SUGGESTIONS = [
  'List all GitHub repos I have access to',
  'Create a GitHub issue about adding dark mode',
  'List all leads in the database',
  'Show me my Docker containers',
  'Create a sandbox React app called my-app',
  'Generate a metrics dashboard component',
];

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.agent.chat(text, sessionId);
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.message,
        timestamp: new Date().toISOString(),
        toolCalls: res.toolCalls,
        steps: res.steps,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  };

  const toggleTools = (idx: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,179,237,0.15)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-electric"
            style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.25), rgba(123,47,247,0.25))', border: '1px solid rgba(99,179,237,0.3)' }}>
            <Bot className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white">XPS Orchestrator</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {sessionId ? `Session: ${sessionId.slice(0, 8)}…` : 'GitHub · Docker MCP · Sandbox · Leads'}
            </p>
          </div>
        </div>
        <button onClick={() => { setMessages([]); setSessionId(undefined); }}
          title="New session" className="p-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.15), rgba(123,47,247,0.15))', border: '1px solid rgba(99,179,237,0.2)' }}>
              <Bot className="w-7 h-7 text-blue-300" />
            </div>
            <p className="font-medium text-white text-sm mb-1">XPS Orchestrator ready</p>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Autonomous AI agent · GitHub App · Docker MCP · Sandbox · Lead Intelligence
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:brightness-125"
                  style={{ background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.2)', color: 'var(--electric-1)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex gap-3 animate-fade-in', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0')}
              style={msg.role === 'user'
                ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }
                : { background: 'linear-gradient(135deg, rgba(99,179,237,0.25), rgba(123,47,247,0.25))', border: '1px solid rgba(99,179,237,0.3)' }}>
              {msg.role === 'user' ? <User className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} /> : <Bot className="w-4 h-4 text-blue-300" />}
            </div>

            <div className={clsx('flex flex-col gap-1.5 max-w-2xl', msg.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={clsx('rounded-2xl px-4 py-3 text-sm', msg.role === 'user' ? 'rounded-tr-sm' : 'card-metallic rounded-tl-sm')}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white' }
                  : { color: 'white' }}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className="text-xs mt-1.5 opacity-40">{new Date(msg.timestamp).toLocaleTimeString()}</p>
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="w-full">
                  <button onClick={() => toggleTools(i)}
                    className="flex items-center gap-1.5 text-xs mb-1.5 hover:opacity-80"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <Terminal className="w-3 h-3" />
                    {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? 's' : ''}
                    {msg.steps ? ` · ${msg.steps} steps` : ''}
                    {expandedTools.has(i) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  {expandedTools.has(i) && (
                    <div className="flex flex-wrap gap-1.5 pl-2 border-l" style={{ borderColor: 'rgba(99,179,237,0.2)' }}>
                      {msg.toolCalls.map((tc, j) => (
                        <ToolCallBadge key={j} tool={tc.tool} durationMs={tc.durationMs} error={tc.error} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.25), rgba(123,47,247,0.25))', border: '1px solid rgba(99,179,237,0.3)' }}>
              <Bot className="w-4 h-4 text-blue-300" />
            </div>
            <div className="card-metallic rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--electric-1)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Agent executing…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(99,179,237,0.1)', background: 'var(--bg-surface)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to do anything — GitHub, code generation, Docker, leads…"
            rows={1}
            className="flex-1 resize-none text-sm px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(99,179,237,0.2)',
              borderRadius: 10,
              color: 'white',
              outline: 'none',
              minHeight: 44,
              maxHeight: 120,
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))' }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Enter to send · Shift+Enter for new line · Agent has {25}+ tools
        </p>
      </div>
    </div>
  );
}
