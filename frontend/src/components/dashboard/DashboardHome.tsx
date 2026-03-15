'use client';

import { useEffect, useState } from 'react';
import { Users, Zap, Activity, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

export function DashboardHome() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [leadCount, setLeadCount] = useState<number | null>(null);

  useEffect(() => {
    api.health()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));

    api.leads.list()
      .then((data) => setLeadCount(data.total))
      .catch(() => setLeadCount(0));
  }, []);

  const stats = [
    {
      title: 'Total Leads',
      value: leadCount !== null ? String(leadCount) : '…',
      icon: <Users className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'API Status',
      value: apiStatus === 'checking' ? '…' : apiStatus === 'online' ? 'Online' : 'Offline',
      icon: <Activity className={`w-6 h-6 ${apiStatus === 'online' ? 'text-green-500' : 'text-red-500'}`} />,
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Active Agents',
      value: '1',
      icon: <Zap className="w-6 h-6 text-purple-500" />,
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Connectors',
      value: '5',
      icon: <CheckCircle className="w-6 h-6 text-orange-500" />,
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to XPS Lead Intelligence Platform
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className={`rounded-xl p-6 ${stat.bg} border border-transparent`}
          >
            <div className="flex items-center justify-between mb-3">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Start</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Navigate to <strong>Leads</strong> to manage your lead pipeline
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Use <strong>Agent</strong> to chat with the AI orchestrator
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Go to <strong>Connectors</strong> to set up integrations
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Visit <strong>Settings</strong> to configure API keys
          </li>
        </ul>
      </div>
    </div>
  );
}
