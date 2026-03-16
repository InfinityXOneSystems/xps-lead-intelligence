'use client';

import { useState, useEffect } from 'react';
import { Box, Plus, Play, Square, Trash2, ExternalLink, Loader2, RefreshCw, Terminal } from 'lucide-react';
import { api } from '@/lib/api';

type Template = 'nextjs' | 'react' | 'node' | 'express';
interface Sandbox { id: string; name: string; template: string; status: string; hostPort: number | null; previewUrl: string | null; createdAt: string; metadata: Record<string, unknown>; }

const TEMPLATES: { id: Template; label: string; desc: string; icon: string }[] = [
  { id: 'nextjs',   label: 'Next.js',  desc: 'Full-stack React with SSR',    icon: '▲' },
  { id: 'react',    label: 'React',    desc: 'Client-side React app',         icon: '⚛' },
  { id: 'express',  label: 'Express',  desc: 'Node.js REST API',              icon: '🚀' },
  { id: 'node',     label: 'Node.js',  desc: 'Bare Node.js environment',      icon: '🟢' },
];

export function SandboxPanel() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<Template>('nextjs');
  const [description, setDescription] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentLog, setAgentLog] = useState('');

  const loadSandboxes = async () => {
    setLoading(true);
    try {
      const data = await api.xps.executeTool('sandbox_list', {});
      setSandboxes((data.output as Sandbox[]) || []);
    } catch { setSandboxes([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadSandboxes(); }, []);

  const createSandbox = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.xps.executeTool('sandbox_create', {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        template,
        description,
      });
      setShowNew(false);
      setName('');
      setDescription('');
      await loadSandboxes();
    } catch (err) {
      console.error('Create sandbox error:', err);
    } finally { setCreating(false); }
  };

  const stopSandbox = async (id: string) => {
    try {
      await api.xps.executeTool('sandbox_stop', { sandbox_id: id });
      await loadSandboxes();
    } catch (err) { console.error(err); }
  };

  const runAgentInSandbox = async (sandbox: Sandbox) => {
    if (!agentPrompt.trim()) return;
    setAgentLoading(true);
    setAgentLog('');
    try {
      const res = await api.xps.execute(
        `In sandbox container ${sandbox.name} (id: ${sandbox.id}, port: ${sandbox.hostPort}): ${agentPrompt}`,
      );
      setAgentLog(res.message);
    } catch (err) {
      setAgentLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setAgentLoading(false); }
  };

  const statusColors: Record<string, string> = {
    RUNNING: '#68d391', CREATING: '#63b3ed', STOPPED: 'rgba(255,255,255,0.3)', ERROR: '#fc8181',
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)', color: 'white' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,179,237,0.15)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.2), rgba(123,47,247,0.2))', border: '1px solid rgba(99,179,237,0.3)' }}>
            <Box className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">App Sandbox</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Create full apps in minutes via Docker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSandboxes} className="p-1.5 rounded-md" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all"
            style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white' }}>
            <Plus className="w-3.5 h-3.5" /> New Sandbox
          </button>
        </div>
      </div>

      {/* New sandbox form */}
      {showNew && (
        <div className="card-electric mx-4 mt-4 p-5 flex-shrink-0">
          <h3 className="font-semibold text-sm mb-4">Create New Sandbox</h3>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="sandbox-name (lowercase, no spaces)"
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.2)', color: 'white', outline: 'none' }} />
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className="p-3 rounded-lg text-left transition-all"
                  style={template === t.id
                    ? { background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.4)' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-lg mb-1">{t.icon}</div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.desc}</div>
                </button>
              ))}
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this sandbox be used for? (optional)"
              rows={2} className="w-full px-3 py-2 text-sm rounded-lg resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.2)', color: 'white', outline: 'none' }} />
            <div className="flex gap-2">
              <button onClick={createSandbox} disabled={!name.trim() || creating}
                className="flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white' }}>
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Play className="w-4 h-4" /> Create Sandbox</>}
              </button>
              <button onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sandbox list */}
      <div className="flex-1 overflow-auto p-5">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} />
          </div>
        )}
        {!loading && sandboxes.length === 0 && (
          <div className="text-center py-16">
            <Box className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No sandboxes yet. Create one to get started.</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Requires Docker to be running locally</p>
          </div>
        )}
        <div className="space-y-3">
          {sandboxes.map((sb) => (
            <div key={sb.id} className="card-metallic p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{sb.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColors[sb.status] || 'rgba(255,255,255,0.1)'}18`, color: statusColors[sb.status], border: `1px solid ${statusColors[sb.status]}44` }}>
                      {sb.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(123,47,247,0.15)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(123,47,247,0.2)' }}>
                      {sb.template}
                    </span>
                  </div>
                  {sb.previewUrl && (
                    <a href={sb.previewUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ color: 'var(--electric-1)' }}>
                      <ExternalLink className="w-3 h-3" /> {sb.previewUrl}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {sb.status === 'RUNNING' && (
                    <button onClick={() => stopSandbox(sb.id)} title="Stop"
                      className="p-1.5 rounded-md" style={{ color: '#fc8181' }}>
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {/* Agent-in-sandbox */}
              {sb.status === 'RUNNING' && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex gap-2">
                    <input value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)}
                      placeholder="Tell the agent what to do in this sandbox…"
                      className="flex-1 text-xs px-2.5 py-1.5 rounded-md"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,179,237,0.15)', color: 'white', outline: 'none' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void runAgentInSandbox(sb); }} />
                    <button onClick={() => void runAgentInSandbox(sb)} disabled={agentLoading || !agentPrompt.trim()}
                      className="px-2.5 py-1.5 text-xs rounded-md disabled:opacity-40 flex items-center gap-1"
                      style={{ background: 'rgba(99,179,237,0.15)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.25)' }}>
                      {agentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
                      Run
                    </button>
                  </div>
                  {agentLog && (
                    <pre className="mt-2 text-xs p-2 rounded-md overflow-auto max-h-24"
                      style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {agentLog}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
