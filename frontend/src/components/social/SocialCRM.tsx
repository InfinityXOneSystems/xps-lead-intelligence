'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, Reply, Zap, Check, Eye, EyeOff, Twitter, Linkedin, Instagram, Facebook } from 'lucide-react';
import clsx from 'clsx';

interface InboundMessage {
  id: string;
  platform: string;
  senderHandle: string;
  senderName?: string;
  content: string;
  messageType: string;
  isRead: boolean;
  requiresReply: boolean;
  autoReplyStatus: string;
  autoReplyContent?: string;
  autoReplySentAt?: string;
  threadId?: string;
  createdAt: string;
  account: { handle: string; platform: string };
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  TWITTER: <Twitter className="w-3.5 h-3.5" />,
  LINKEDIN: <Linkedin className="w-3.5 h-3.5" />,
  INSTAGRAM: <Instagram className="w-3.5 h-3.5" />,
  FACEBOOK: <Facebook className="w-3.5 h-3.5" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  TWITTER: '#1DA1F2',
  LINKEDIN: '#0A66C2',
  INSTAGRAM: '#E1306C',
  FACEBOOK: '#1877F2',
};

const REPLY_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-300 bg-yellow-500/20',
  SENT: 'text-green-300 bg-green-500/20',
  SKIPPED: 'text-gray-400 bg-gray-500/20',
  FAILED: 'text-red-300 bg-red-500/20',
};

export function SocialCRM() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboundMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterNeedsReply, setFilterNeedsReply] = useState(false);
  const [processing, setProcessing] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUnread) params.set('unread', 'true');
      if (filterNeedsReply) params.set('requiresReply', 'true');
      const r = await fetch(`${API}/api/social/inbound?${params}`);
      const data = await r.json() as { messages?: InboundMessage[] };
      setMessages(data.messages || []);
    } finally { setLoading(false); }
  }, [API, filterUnread, filterNeedsReply]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    await fetch(`${API}/api/social/inbound/${id}/read`, { method: 'PATCH' });
    setMessages((p) => p.map((m) => m.id === id ? { ...m, isRead: true } : m));
  };

  const getSuggestedReply = async (msg: InboundMessage) => {
    setSuggesting(true);
    try {
      const r = await fetch(`${API}/api/social/inbound/${msg.id}/ai-reply`, { method: 'POST' });
      const data = await r.json() as { suggestedReply: string };
      setReplyText(data.suggestedReply);
    } finally { setSuggesting(false); }
  };

  const sendReply = async (id: string) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await fetch(`${API}/api/social/inbound/${id}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText }),
      });
      setReplyText('');
      await load();
    } finally { setReplying(false); }
  };

  const processAllAutoReplies = async () => {
    setProcessing(true);
    try {
      const r = await fetch(`${API}/api/social/inbound/process-auto-reply`, { method: 'POST' });
      const data = await r.json() as { processed?: number; replied?: number };
      alert(`Processed ${data.processed ?? 0} messages, sent ${data.replied ?? 0} auto-replies`);
      await load();
    } finally { setProcessing(false); }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;
  const needsReplyCount = messages.filter((m) => m.requiresReply && m.autoReplyStatus === 'PENDING').length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,179,237,0.15)' }}>
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5" style={{ color: 'var(--electric-1)' }} />
          <h2 className="text-lg font-bold text-white">Social CRM</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/25 text-blue-300">{unreadCount} unread</span>}
            {needsReplyCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 animate-pulse">{needsReplyCount} need reply</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setFilterUnread(!filterUnread); }} className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all', filterUnread ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-white/40 hover:text-white/70 border border-transparent')}>
            <EyeOff className="w-3 h-3" />Unread
          </button>
          <button onClick={() => setFilterNeedsReply(!filterNeedsReply)} className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all', filterNeedsReply ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'text-white/40 hover:text-white/70 border border-transparent')}>
            <Reply className="w-3 h-3" />Needs Reply
          </button>
          <button onClick={processAllAutoReplies} disabled={processing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}>
            {processing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Auto-Reply All
          </button>
          <button onClick={load} className="p-1.5 text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Message list */}
        <div className={clsx('flex-shrink-0 overflow-y-auto border-r', selected ? 'w-72' : 'flex-1')} style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-white/30 text-sm">No inbound messages yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {messages.map((msg) => (
                <button key={msg.id} onClick={() => { setSelected(msg); if (!msg.isRead) markRead(msg.id); }} className={clsx('w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.02]', selected?.id === msg.id ? 'bg-white/[0.03]' : '', !msg.isRead ? 'border-l-2' : '')} style={{ borderLeftColor: !msg.isRead ? 'var(--electric-1)' : 'transparent' }}>
                  <div className="flex items-start gap-2">
                    <span style={{ color: PLATFORM_COLORS[msg.platform] || 'var(--electric-1)' }} className="mt-0.5 flex-shrink-0">
                      {PLATFORM_ICONS[msg.platform] || <MessageSquare className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={clsx('text-xs font-semibold', msg.isRead ? 'text-white/60' : 'text-white')}>@{msg.senderHandle}</span>
                        <span className="text-xs text-white/25 flex-shrink-0">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className={clsx('text-xs truncate', msg.isRead ? 'text-white/40' : 'text-white/70')}>{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-1 py-0.5 rounded text-white/30 bg-white/5">{msg.messageType}</span>
                        <span className={clsx('text-xs px-1 py-0.5 rounded', REPLY_STATUS_COLORS[msg.autoReplyStatus] || 'text-white/30')}>
                          {msg.autoReplyStatus === 'SENT' ? 'Replied' : msg.autoReplyStatus === 'PENDING' && msg.requiresReply ? 'Needs Reply' : msg.autoReplyStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread view */}
        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ color: PLATFORM_COLORS[selected.platform] }}>{PLATFORM_ICONS[selected.platform]}</span>
                  <span className="font-medium text-white text-sm">@{selected.senderHandle}</span>
                  {selected.senderName && <span className="text-xs text-white/40">{selected.senderName}</span>}
                </div>
                <p className="text-xs text-white/30 mt-0.5">{new Date(selected.createdAt).toLocaleString()} · {selected.messageType}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/60 p-1"><span className="text-lg">×</span></button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Inbound message */}
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${PLATFORM_COLORS[selected.platform]}20` }}>
                  <span style={{ color: PLATFORM_COLORS[selected.platform] }}>{PLATFORM_ICONS[selected.platform]}</span>
                </div>
                <div className="flex-1 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-semibold text-white/60 mb-1">@{selected.senderHandle}</p>
                  <p className="text-sm text-white">{selected.content}</p>
                </div>
              </div>

              {/* Auto-reply if sent */}
              {selected.autoReplyContent && (
                <div className="flex items-start gap-2 justify-end">
                  <div className="flex-1 max-w-sm p-3 rounded-xl" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.2)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--electric-1)' }}>Auto-reply · {selected.autoReplySentAt ? new Date(selected.autoReplySentAt).toLocaleTimeString() : ''}</p>
                    <p className="text-sm text-white/80">{selected.autoReplyContent}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Reply composer */}
            <div className="p-4 border-t" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => getSuggestedReply(selected)} disabled={suggesting} className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg" style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.3)', color: '#b794f4' }}>
                  {suggesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {suggesting ? 'Writing…' : 'AI Suggest Reply'}
                </button>
              </div>
              <div className="flex gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply…" rows={3} className="flex-1 px-3 py-2 text-sm rounded-lg resize-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.2)', color: 'white' }} />
                <button onClick={() => sendReply(selected.id)} disabled={replying || !replyText.trim()} className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg disabled:opacity-50 text-xs font-medium transition-all" style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.2), rgba(123,47,247,0.2))', border: '1px solid rgba(99,179,237,0.3)', color: 'white' }}>
                  {replying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Reply className="w-4 h-4" />}
                  {replying ? 'Sending' : 'Reply'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
