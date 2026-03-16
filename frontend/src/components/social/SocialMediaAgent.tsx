'use client';

import { useState, useEffect, useCallback } from 'react';
import { Share2, Plus, Send, RefreshCw, Sparkles, Twitter, Linkedin, Instagram, Facebook, Youtube, X, CheckCircle2, Clock, Zap, Settings } from 'lucide-react';
import clsx from 'clsx';

interface SocialAccount {
  id: string;
  platform: 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE';
  handle: string;
  isActive: boolean;
  autoPost: boolean;
  autoReply: boolean;
  _count: { posts: number; inboundMessages: number };
}

interface SocialPost {
  id: string;
  content: string;
  platform: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  publishedAt?: string;
  scheduledAt?: string;
  error?: string;
  account: { handle: string; platform: string };
  createdAt: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  TWITTER: <Twitter className="w-4 h-4" />,
  LINKEDIN: <Linkedin className="w-4 h-4" />,
  INSTAGRAM: <Instagram className="w-4 h-4" />,
  FACEBOOK: <Facebook className="w-4 h-4" />,
  YOUTUBE: <Youtube className="w-4 h-4" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  TWITTER: '#1DA1F2',
  LINKEDIN: '#0A66C2',
  INSTAGRAM: '#E1306C',
  FACEBOOK: '#1877F2',
  YOUTUBE: '#FF0000',
};

export function SocialMediaAgent() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compose' | 'posts' | 'accounts'>('compose');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ platform: 'TWITTER', handle: '', accessToken: '' });

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aResp, pResp] = await Promise.all([
        fetch(`${API}/api/social/accounts`).then((r) => r.json()),
        fetch(`${API}/api/social/posts`).then((r) => r.json()),
      ]);
      const accts = (aResp as { accounts?: SocialAccount[] }).accounts || [];
      setAccounts(accts);
      setPosts((pResp as { posts?: SocialPost[] }).posts || []);
      if (accts.length > 0 && !selectedAccount) setSelectedAccount(accts[0].id);
    } finally { setLoading(false); }
  }, [API, selectedAccount]);

  useEffect(() => { load(); }, [load]);

  const generateContent = async () => {
    if (!genTopic.trim() || !selectedAccount) return;
    const account = accounts.find((a) => a.id === selectedAccount);
    if (!account) return;
    setGenerating(true);
    try {
      const r = await fetch(`${API}/api/social/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: account.platform, topic: genTopic, tone: 'professional', includeHashtags: true }),
      });
      const data = await r.json() as { content: string; hashtags: string[] };
      setContent(data.content + (data.hashtags?.length ? '\n' + data.hashtags.join(' ') : ''));
    } finally { setGenerating(false); }
  };

  const publish = async () => {
    if (!content.trim() || !selectedAccount) return;
    setPublishing(true);
    try {
      await fetch(`${API}/api/social/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, content, ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      setContent('');
      setScheduledAt('');
      setGenTopic('');
      await load();
      setActiveTab('posts');
    } finally { setPublishing(false); }
  };

  const addAccount = async () => {
    if (!newAccount.handle || !newAccount.platform) return;
    await fetch(`${API}/api/social/accounts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount),
    });
    setShowAddAccount(false);
    setNewAccount({ platform: 'TWITTER', handle: '', accessToken: '' });
    await load();
  };

  const processAutoReplies = async () => {
    const r = await fetch(`${API}/api/social/inbound/process-auto-reply`, { method: 'POST' });
    const data = await r.json() as { processed?: number; replied?: number };
    alert(`Processed ${data.processed} messages, sent ${data.replied} auto-replies`);
  };

  const processScheduled = async () => {
    const r = await fetch(`${API}/api/social/posts/process-scheduled`, { method: 'POST' });
    const data = await r.json() as { published?: number; failed?: number };
    alert(`Published ${data.published} posts, ${data.failed} failed`);
    await load();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,179,237,0.15)' }}>
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5" style={{ color: 'var(--electric-1)' }} />
          <h2 className="text-lg font-bold text-white">Social Media Agent</h2>
          {accounts.length > 0 && (
            <div className="flex items-center gap-1">
              {accounts.map((a) => (
                <span key={a.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ background: `${PLATFORM_COLORS[a.platform]}20`, color: PLATFORM_COLORS[a.platform], border: `1px solid ${PLATFORM_COLORS[a.platform]}40` }}>
                  {PLATFORM_ICONS[a.platform]}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={processScheduled} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(246,224,94,0.1)', border: '1px solid rgba(246,224,94,0.3)', color: '#f6e05e' }}>
            <Clock className="w-3.5 h-3.5" />Process Scheduled
          </button>
          <button onClick={processAutoReplies} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}>
            <Zap className="w-3.5 h-3.5" />Auto-Reply
          </button>
          <button onClick={() => setShowAddAccount(!showAddAccount)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--electric-1)' }}>
            <Plus className="w-3.5 h-3.5" />Connect Account
          </button>
        </div>
      </div>

      {showAddAccount && (
        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(99,179,237,0.1)', background: 'rgba(99,179,237,0.03)' }}>
          <p className="text-xs font-semibold text-white/60 mb-2">Connect Social Account</p>
          <div className="flex items-center gap-2">
            <select value={newAccount.platform} onChange={(e) => setNewAccount((p) => ({ ...p, platform: e.target.value }))} className="px-2 py-1.5 text-xs rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,179,237,0.2)', color: 'white' }}>
              {['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={newAccount.handle} onChange={(e) => setNewAccount((p) => ({ ...p, handle: e.target.value }))} placeholder="@handle or username" className="px-3 py-1.5 text-xs rounded-lg flex-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,179,237,0.2)', color: 'white' }} />
            <input value={newAccount.accessToken} onChange={(e) => setNewAccount((p) => ({ ...p, accessToken: e.target.value }))} placeholder="Access token (from platform OAuth)" type="password" className="px-3 py-1.5 text-xs rounded-lg flex-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,179,237,0.2)', color: 'white' }} />
            <button onClick={addAccount} className="px-3 py-1.5 text-xs rounded-lg" style={{ background: 'rgba(104,211,145,0.2)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}><CheckCircle2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowAddAccount(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Access tokens come from each platform&apos;s OAuth flow. See <strong>Connectors</strong> → configure Google/Twitter/LinkedIn credentials.</p>
        </div>
      )}

      <div className="flex border-b" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
        {(['compose', 'posts', 'accounts'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className="px-5 py-3 text-sm font-medium capitalize transition-colors" style={{ color: activeTab === t ? 'var(--electric-1)' : 'rgba(255,255,255,0.4)', borderBottom: activeTab === t ? '2px solid var(--electric-1)' : '2px solid transparent' }}>
            {t} {t === 'accounts' && accounts.length > 0 && `(${accounts.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
        ) : activeTab === 'compose' ? (
          <div className="max-w-2xl">
            {accounts.length === 0 ? (
              <div className="text-center py-20">
                <Share2 className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--electric-1)' }} />
                <p className="text-white/40 text-sm mb-2">No social accounts connected</p>
                <button onClick={() => setShowAddAccount(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--electric-1)' }}>Connect an Account</button>
              </div>
            ) : (
              <>
                {/* Account selector */}
                <div className="flex items-center gap-2 mb-4">
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => setSelectedAccount(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: selectedAccount === a.id ? `${PLATFORM_COLORS[a.platform]}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedAccount === a.id ? `${PLATFORM_COLORS[a.platform]}60` : 'rgba(255,255,255,0.08)'}`, color: selectedAccount === a.id ? PLATFORM_COLORS[a.platform] : 'rgba(255,255,255,0.5)' }}>
                      {PLATFORM_ICONS[a.platform]}@{a.handle}
                    </button>
                  ))}
                </div>

                {/* AI generate */}
                <div className="flex items-center gap-2 mb-3">
                  <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateContent()} placeholder="Topic for AI to write about…" className="flex-1 px-3 py-2 text-sm rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(123,47,247,0.2)', color: 'white' }} />
                  <button onClick={generateContent} disabled={generating || !genTopic.trim()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-50" style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.4)', color: '#b794f4' }}>
                    {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {generating ? 'Writing…' : 'Generate'}
                  </button>
                </div>

                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post or use AI to generate…" rows={6} className="w-full px-3 py-2 text-sm rounded-lg resize-y mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.2)', color: 'white' }} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Schedule:</label>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="px-2 py-1 text-xs rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">{content.length} chars</span>
                    <button onClick={publish} disabled={publishing || !content.trim() || !selectedAccount} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-all" style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.25), rgba(123,47,247,0.25))', border: '1px solid rgba(99,179,237,0.4)', color: 'white' }}>
                      {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {publishing ? 'Posting…' : scheduledAt ? 'Schedule' : 'Post Now'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'posts' ? (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.status === 'PUBLISHED' ? 'rgba(104,211,145,0.15)' : p.status === 'FAILED' ? 'rgba(252,129,129,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span style={{ color: PLATFORM_COLORS[p.platform] }}>{PLATFORM_ICONS[p.platform]}</span>
                    <span className="text-xs text-white/40">@{p.account.handle}</span>
                  </div>
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded flex-shrink-0', {
                    'bg-green-500/20 text-green-300': p.status === 'PUBLISHED',
                    'bg-yellow-500/20 text-yellow-300': p.status === 'SCHEDULED',
                    'bg-red-500/20 text-red-300': p.status === 'FAILED',
                    'bg-gray-500/20 text-gray-300': p.status === 'DRAFT',
                  })}>{p.status}</span>
                </div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{p.content}</p>
                {p.error && <p className="text-xs text-red-400 mt-1">{p.error}</p>}
                <p className="text-xs text-white/25 mt-1">{p.publishedAt ? `Published ${new Date(p.publishedAt).toLocaleString()}` : p.scheduledAt ? `Scheduled ${new Date(p.scheduledAt).toLocaleString()}` : new Date(p.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {posts.length === 0 && <div className="text-center py-20 text-white/30 text-sm">No posts yet</div>}
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${PLATFORM_COLORS[a.platform]}25` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: PLATFORM_COLORS[a.platform] }}>{PLATFORM_ICONS[a.platform]}</span>
                    <span className="font-medium text-white">@{a.handle}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${PLATFORM_COLORS[a.platform]}20`, color: PLATFORM_COLORS[a.platform] }}>{a.platform}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>{a._count.posts} posts</span>
                    <span>{a._count.inboundMessages} messages</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 text-white/50">
                    <input type="checkbox" checked={a.autoPost} readOnly className="rounded" />
                    Auto-post
                  </label>
                  <label className="flex items-center gap-1.5 text-white/50">
                    <input type="checkbox" checked={a.autoReply} readOnly className="rounded" />
                    Auto-reply
                  </label>
                  <span className={clsx('px-1.5 py-0.5 rounded', a.isActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{a.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            ))}
            {accounts.length === 0 && <div className="text-center py-20 text-white/30 text-sm">No accounts connected yet</div>}
          </div>
        )}
      </div>
    </div>
  );
}
