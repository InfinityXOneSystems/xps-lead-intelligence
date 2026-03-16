'use client';

import { useEffect, useState } from 'react';
import { Users, Zap, Activity, CheckCircle, Github, Box, Code2, Cpu } from 'lucide-react';
import { api } from '@/lib/api';

export function DashboardHome() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [xpsStatus, setXpsStatus] = useState<{ toolCount?: number; llm?: string } | null>(null);

  useEffect(() => {
    api.health()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));

    api.leads.list()
      .then((data) => setLeadCount(data.total))
      .catch(() => setLeadCount(0));

    api.xps.status()
      .then((s) => setXpsStatus({ toolCount: (s.tools || []).length, llm: s.capabilities?.llm as string }))
      .catch(() => null);
  }, []);

  const stats = [
    {
      title: 'Total Leads',
      value: leadCount !== null ? String(leadCount) : '…',
      icon: <Users className="w-5 h-5" />,
      color: 'var(--electric-1)',
    },
    {
      title: 'API Status',
      value: apiStatus === 'checking' ? '…' : apiStatus === 'online' ? 'Online' : 'Offline',
      icon: <Activity className="w-5 h-5" />,
      color: apiStatus === 'online' ? '#68d391' : '#fc8181',
    },
    {
      title: 'Agent Tools',
      value: xpsStatus?.toolCount ? String(xpsStatus.toolCount) : '…',
      icon: <Zap className="w-5 h-5" />,
      color: 'var(--electric-2)',
    },
    {
      title: 'Connectors',
      value: '5',
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'var(--electric-3)',
    },
  ];

  const capabilities = [
    { icon: <Github className="w-4 h-4" />, label: 'GitHub App', desc: 'Repos, issues, PRs, workflows, code', color: 'var(--electric-1)' },
    { icon: <Box className="w-4 h-4" />, label: 'Docker MCP', desc: 'Local machine access via socket gateway', color: 'var(--electric-2)' },
    { icon: <Code2 className="w-4 h-4" />, label: 'AI Editor', desc: 'Lovable/V0-style component generation', color: '#68d391' },
    { icon: <Cpu className="w-4 h-4" />, label: 'Sandbox', desc: 'Spin up full apps in Docker in minutes', color: 'var(--electric-3)' },
  ];

  return (
    <div className="p-8" style={{ color: 'white' }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          XPS Lead Intelligence Platform · Autonomous AI Agent
          {xpsStatus?.llm && <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.25)', color: 'var(--electric-1)' }}>
            {xpsStatus.llm}
          </span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.title} className="card-metallic p-5">
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: stat.color }}>{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Capabilities */}
      <div className="card-electric p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 text-white">Platform Capabilities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {capabilities.map((cap) => (
            <div key={cap.label} className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="mt-0.5 flex-shrink-0" style={{ color: cap.color }}>{cap.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{cap.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <div className="card-metallic p-6">
        <h2 className="text-sm font-semibold mb-3 text-white">Quick Start</h2>
        <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {[
            { dot: 'var(--electric-1)', text: <>Go to <strong className="text-white">Agent</strong> — ask it to list your GitHub repos, create issues, or generate code</> },
            { dot: 'var(--electric-2)', text: <>Open <strong className="text-white">AI Editor</strong> — describe a UI component in natural language, see it live</> },
            { dot: '#68d391',            text: <>Use <strong className="text-white">Sandbox</strong> — spin up a full Next.js/React/Node app in Docker in one click</> },
            { dot: 'var(--electric-3)', text: <>Check <strong className="text-white">Connectors</strong> — configure GitHub App, Railway, Google credentials</> },
          ].map(({ dot, text }, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: dot }} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
