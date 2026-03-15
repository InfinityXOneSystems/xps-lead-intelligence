'use client';

import { ActiveSection } from './AppLayout';
import { LeadsDashboard } from '../leads/LeadsDashboard';
import { AgentChat } from '../agent/AgentChat';
import { AdminSettings } from '../admin/AdminSettings';
import { DashboardHome } from '../dashboard/DashboardHome';
import { VisualEditor } from '../editor/VisualEditor';
import { GitHubPanel } from '../github/GitHubPanel';
import { SandboxPanel } from '../sandbox/SandboxPanel';

interface CenterEditorProps {
  activeSection: ActiveSection;
}

export function CenterEditor({ activeSection }: CenterEditorProps) {
  return (
    <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-deep)' }}>
      {activeSection === 'dashboard'  && <DashboardHome />}
      {activeSection === 'leads'      && <LeadsDashboard />}
      {activeSection === 'agent'      && <AgentChat />}
      {activeSection === 'analytics'  && <AnalyticsSection />}
      {activeSection === 'connectors' && <AdminSettings initialTab="connectors" />}
      {activeSection === 'settings'   && <AdminSettings initialTab="config" />}
      {activeSection === 'github'     && <GitHubPanel />}
      {activeSection === 'editor'     && <VisualEditor />}
      {activeSection === 'sandbox'    && <SandboxPanel />}
    </main>
  );
}

function AnalyticsSection() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-white mb-6">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Total Leads', value: '—', color: 'var(--electric-1)' },
          { label: 'Conversion Rate', value: '—', color: 'var(--electric-2)' },
          { label: 'Active Jobs', value: '—', color: 'var(--electric-3)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-metallic p-6">
            <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

