'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Pencil, Trash2, Send, Eye, RefreshCw, Sparkles, X, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  category: string;
  isActive: boolean;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  template: { name: string };
  _count: { sends: number };
  createdAt: string;
}

const VARIABLES = ['businessName', 'ownerName', 'businessPhone', 'businessWebsite', 'specialities'];

export function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'campaigns'>('templates');
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genPurpose, setGenPurpose] = useState('');
  const [showGen, setShowGen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tResp, cResp] = await Promise.all([
        fetch(`${API}/api/email/templates`).then((r) => r.json()),
        fetch(`${API}/api/email/campaigns`).then((r) => r.json()),
      ]);
      setTemplates((tResp as { templates?: EmailTemplate[] }).templates || []);
      setCampaigns((cResp as { campaigns?: Campaign[] }).campaigns || []);
    } finally { setLoading(false); }
  }, [API]);

  useEffect(() => { load(); }, [load]);

  const generateTemplate = async () => {
    if (!genPurpose.trim()) return;
    setGenerating(true);
    try {
      const r = await fetch(`${API}/api/email/templates/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: genPurpose, businessType: 'B2B', tone: 'professional', variables: VARIABLES.join(', ') }),
      });
      const data = await r.json() as Partial<EmailTemplate>;
      setEditing({ id: '', name: data.name || 'New Template', subject: data.subject || '', bodyHtml: data.bodyHtml || '', bodyText: data.bodyText || '', category: 'outreach', isActive: true, updatedAt: new Date().toISOString() });
      setShowGen(false);
      setGenPurpose('');
    } finally { setGenerating(false); }
  };

  const saveTemplate = async () => {
    if (!editing) return;
    if (editing.id) {
      await fetch(`${API}/api/email/templates/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    } else {
      await fetch(`${API}/api/email/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    }
    setEditing(null);
    await load();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`${API}/api/email/templates/${id}`, { method: 'DELETE' });
    await load();
  };

  const previewTemplate = async (id: string) => {
    const r = await fetch(`${API}/api/email/templates/${id}/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'Acme Roofing', ownerName: 'John Smith', specialities: 'residential roofing' }),
    });
    const data = await r.json() as { bodyHtml: string };
    setPreviewHtml(data.bodyHtml);
  };

  const sendCampaign = async (id: string) => {
    if (!confirm('Send this campaign to all matching leads now?')) return;
    setSending(id);
    try {
      const r = await fetch(`${API}/api/email/campaigns/${id}/send`, { method: 'POST' });
      const data = await r.json() as { sent?: number; failed?: number };
      alert(`Campaign sent: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed`);
      await load();
    } finally { setSending(null); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,179,237,0.15)' }}>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" style={{ color: 'var(--electric-1)' }} />
          <h2 className="text-lg font-bold text-white">Email Outreach</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGen(!showGen)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.4)', color: '#b794f4' }}>
            <Sparkles className="w-3.5 h-3.5" />AI Generate
          </button>
          <button onClick={() => setEditing({ id: '', name: '', subject: '', bodyHtml: '', bodyText: '', category: 'outreach', isActive: true, updatedAt: '' })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--electric-1)' }}>
            <Plus className="w-3.5 h-3.5" />New Template
          </button>
        </div>
      </div>

      {showGen && (
        <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'rgba(123,47,247,0.2)', background: 'rgba(123,47,247,0.05)' }}>
          <input value={genPurpose} onChange={(e) => setGenPurpose(e.target.value)} placeholder="Describe the email (e.g. cold outreach for roofing contractors)" onKeyDown={(e) => e.key === 'Enter' && generateTemplate()} className="flex-1 px-3 py-1.5 text-sm rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(123,47,247,0.3)', color: 'white' }} />
          <button onClick={generateTemplate} disabled={generating || !genPurpose.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50" style={{ background: 'rgba(123,47,247,0.25)', border: '1px solid rgba(123,47,247,0.5)', color: '#b794f4' }}>
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={() => setShowGen(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex border-b" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
        {(['templates', 'campaigns'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className="px-5 py-3 text-sm font-medium capitalize transition-colors" style={{ color: activeTab === t ? 'var(--electric-1)' : 'rgba(255,255,255,0.4)', borderBottom: activeTab === t ? '2px solid var(--electric-1)' : '2px solid transparent' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
        ) : activeTab === 'templates' ? (
          <>
            {editing && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,179,237,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">{editing.id ? 'Edit Template' : 'New Template'}</h3>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map((v) => (
                      <button key={v} onClick={() => setEditing((p) => p ? { ...p, bodyHtml: p.bodyHtml + `{{${v}}}` } : p)} className="px-1.5 py-0.5 text-xs rounded" style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.3)', color: '#b794f4', fontFamily: 'monospace' }}>
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={editing.name} onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : p)} placeholder="Template name" className="w-full px-3 py-2 mb-2 text-sm rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                <input value={editing.subject} onChange={(e) => setEditing((p) => p ? { ...p, subject: e.target.value } : p)} placeholder="Subject — use {{businessName}}, {{ownerName}}" className="w-full px-3 py-2 mb-2 text-sm rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                <textarea value={editing.bodyHtml} onChange={(e) => setEditing((p) => p ? { ...p, bodyHtml: e.target.value } : p)} placeholder="HTML body — use {{businessName}}, {{ownerName}}, {{specialities}}, etc." rows={8} className="w-full px-3 py-2 mb-3 text-sm rounded-lg font-mono resize-y" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                <div className="flex gap-2">
                  <button onClick={saveTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(104,211,145,0.2)', border: '1px solid rgba(104,211,145,0.4)', color: '#68d391' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />Save
                  </button>
                  {editing.id && (
                    <button onClick={() => previewTemplate(editing.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.2)', color: 'var(--electric-1)' }}>
                      <Eye className="w-3.5 h-3.5" />Preview
                    </button>
                  )}
                  <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white/40 hover:text-white/70">
                    <X className="w-3.5 h-3.5" />Cancel
                  </button>
                </div>
              </div>
            )}
            {previewHtml && (
              <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,179,237,0.2)' }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                  <span className="text-xs font-medium text-white/60">Email Preview</span>
                  <button onClick={() => setPreviewHtml(null)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
                </div>
                <iframe srcDoc={previewHtml} className="w-full h-64 bg-white" title="Email Preview" sandbox="allow-same-origin" />
              </div>
            )}
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{t.name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.subject}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(99,179,237,0.1)', color: 'rgba(255,255,255,0.5)' }}>{t.category}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button onClick={() => previewTemplate(t.id)} className="p-1.5 rounded-lg text-white/30 hover:text-blue-300 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditing(t)} className="p-1.5 rounded-lg text-white/30 hover:text-blue-300 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && !editing && <div className="text-center py-10 text-white/30 text-sm">No templates yet — generate one with AI or create manually</div>}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Template: {c.template.name} · {c._count.sends} sent</p>
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded mt-1 inline-block', {
                    'bg-yellow-500/20 text-yellow-300': c.status === 'DRAFT',
                    'bg-blue-500/20 text-blue-300': c.status === 'SENDING',
                    'bg-green-500/20 text-green-300': c.status === 'SENT',
                  })}>{c.status}</span>
                </div>
                {c.status !== 'SENT' && (
                  <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50" style={{ background: 'rgba(104,211,145,0.15)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}>
                    {sending === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending === c.id ? 'Sending…' : 'Send Campaign'}
                  </button>
                )}
              </div>
            ))}
            {campaigns.length === 0 && <div className="text-center py-10 text-white/30 text-sm">No campaigns yet</div>}
          </div>
        )}
      </div>
    </div>
  );
}
