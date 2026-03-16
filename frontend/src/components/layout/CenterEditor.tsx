'use client';

import { useEffect, useState } from 'react';
import { ActiveSection } from './AppLayout';
import { LeadsCRM } from '../leads/LeadsCRM';
import { LiveScraper } from '../leads/LiveScraper';
import { AgentChat } from '../agent/AgentChat';
import { AdminSettings } from '../admin/AdminSettings';
import { DashboardHome } from '../dashboard/DashboardHome';
import { VisualEditor } from '../editor/VisualEditor';
import { GitHubPanel } from '../github/GitHubPanel';
import { SandboxPanel } from '../sandbox/SandboxPanel';
import { EmailTemplates } from '../email/EmailTemplates';
import { SocialMediaAgent } from '../social/SocialMediaAgent';
import { SocialCRM } from '../social/SocialCRM';
import { api } from '@/lib/api';
import { TrendingUp, Users, Zap } from 'lucide-react';

interface CenterEditorProps {
  activeSection: ActiveSection;
}

export function CenterEditor({ activeSection }: CenterEditorProps) {
  return (
    <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-deep)' }}>
      {activeSection === 'dashboard'   && <DashboardHome />}
      {activeSection === 'leads'       && <LeadsCRM />}
      {activeSection === 'scraper'     && <LiveScraper />}
      {activeSection === 'outreach'    && <EmailTemplates />}
      {activeSection === 'agent'       && <AgentChat />}
      {activeSection === 'analytics'   && <AnalyticsSection />}
      {activeSection === 'social'      && <SocialMediaAgent />}
      {activeSection === 'social-crm'  && <SocialCRM />}
      {activeSection === 'connectors'  && <AdminSettings initialTab="connectors" />}
      {activeSection === 'settings'    && <AdminSettings initialTab="accounts" />}
      {activeSection === 'github'      && <GitHubPanel />}
      {activeSection === 'editor'      && <VisualEditor />}
      {activeSection === 'sandbox'     && <SandboxPanel />}
    </main>
  );
}

interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  avgScore: number;
  topSources: string[];
}

function AnalyticsSection() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leadStats()
      .then((s) => setStats(s))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total Leads',
      value: loading ? '…' : (stats?.total ?? 0).toString(),
      color: 'var(--electric-1)',
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: 'Avg Lead Score',
      value: loading ? '…' : stats ? Math.round(stats.avgScore).toString() : '—',
      color: 'var(--electric-2)',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: 'Conversion Rate',
      value: loading ? '…' : stats && stats.total > 0
        ? `${Math.round(((stats.byStatus['CONVERTED'] || 0) / stats.total) * 100)}%`
        : '—',
      color: 'var(--electric-3)',
      icon: <TrendingUp className="w-5 h-5" />,
    },
  ];

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-white mb-2">Analytics</h2>
      <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Live lead pipeline metrics</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {cards.map(({ label, value, color, icon }) => (
          <div key={label} className="card-metallic p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
              <span style={{ color }}>{icon}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Status breakdown */}
          <div className="card-metallic p-5">
            <h3 className="text-sm font-medium text-white mb-4">Lead Status</h3>
            <div className="space-y-2">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{status}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round((count / Math.max(stats.total, 1)) * 80)}px`, background: 'var(--electric-1)' }} />
                    <span className="text-xs text-white font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top sources */}
          <div className="card-metallic p-5">
            <h3 className="text-sm font-medium text-white mb-4">Top Sources</h3>
            <div className="space-y-2">
              {stats.topSources.slice(0, 5).map((src) => (
                <div key={src} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--electric-2)' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{src}</span>
                </div>
              ))}
              {stats.topSources.length === 0 && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No leads scraped yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

