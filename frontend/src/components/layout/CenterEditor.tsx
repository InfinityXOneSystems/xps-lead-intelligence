'use client';

import { ActiveSection } from './AppLayout';
import { LeadsDashboard } from '../leads/LeadsDashboard';
import { AgentChat } from '../agent/AgentChat';
import { AdminSettings } from '../admin/AdminSettings';
import { DashboardHome } from '../dashboard/DashboardHome';

interface CenterEditorProps {
  activeSection: ActiveSection;
}

export function CenterEditor({ activeSection }: CenterEditorProps) {
  return (
    <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
      {activeSection === 'dashboard' && <DashboardHome />}
      {activeSection === 'leads' && <LeadsDashboard />}
      {activeSection === 'agent' && <AgentChat />}
      {activeSection === 'analytics' && <AnalyticsPlaceholder />}
      {activeSection === 'connectors' && <AdminSettings initialTab="connectors" />}
      {activeSection === 'settings' && <AdminSettings initialTab="config" />}
    </main>
  );
}

function AnalyticsPlaceholder() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['Total Leads', 'Conversion Rate', 'Active Jobs'].map((title) => (
          <div
            key={title}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
