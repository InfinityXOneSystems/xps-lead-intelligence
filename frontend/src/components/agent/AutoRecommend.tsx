'use client';

import { useEffect, useState, useCallback } from 'react';
import { Zap, RefreshCw, ChevronRight } from 'lucide-react';

interface Recommendation {
  id: string;
  text: string;
  category: 'action' | 'question' | 'insight' | 'tool';
  priority: 'high' | 'medium' | 'low';
}

interface AutoRecommendProps {
  activeSection: string;
  recentMessages: string[];
  onSelect: (text: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  action: 'rgba(99,179,237,0.15)',
  question: 'rgba(104,211,145,0.12)',
  insight: 'rgba(246,224,94,0.12)',
  tool: 'rgba(123,47,247,0.15)',
};
const CATEGORY_BORDER: Record<string, string> = {
  action: 'rgba(99,179,237,0.3)',
  question: 'rgba(104,211,145,0.25)',
  insight: 'rgba(246,224,94,0.25)',
  tool: 'rgba(123,47,247,0.3)',
};

export function AutoRecommend({ activeSection, recentMessages, onSelect }: AutoRecommendProps) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/outreach/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: activeSection, messages: recentMessages }),
      });
      const data = await r.json() as { recommendations?: Recommendation[] };
      if (data.recommendations?.length) setRecs(data.recommendations);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [API, activeSection, recentMessages]);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  if (recs.length === 0 && !loading) return null;

  return (
    <div className="px-4 py-2 border-t" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3 h-3" style={{ color: 'var(--electric-2)' }} />
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Suggestions</span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />}
        {!loading && (
          <button onClick={fetchRecs} className="ml-auto text-xs text-white/25 hover:text-white/50 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {recs.slice(0, 4).map((rec) => (
          <button
            key={rec.id}
            onClick={() => onSelect(rec.text)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:brightness-125 text-left"
            style={{
              background: CATEGORY_COLORS[rec.category] || 'rgba(255,255,255,0.05)',
              border: `1px solid ${CATEGORY_BORDER[rec.category] || 'rgba(255,255,255,0.1)'}`,
              color: 'rgba(255,255,255,0.75)',
              maxWidth: 220,
            }}
          >
            <span className="truncate">{rec.text}</span>
            <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}
