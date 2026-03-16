'use client';

import { Bot, Users, RefreshCw, Plus, Zap, Github, Code2, Box } from 'lucide-react';
import { ActiveSection } from './AppLayout';

interface RightToolbarProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
}

export function RightToolbar({ activeSection, onNavigate }: RightToolbarProps) {
  const actions = [
    { icon: <Bot className="w-4 h-4" />,      label: 'Agent',    section: 'agent' as ActiveSection,   color: 'linear-gradient(135deg, #00d2ff, #7b2ff7)' },
    { icon: <Code2 className="w-4 h-4" />,    label: 'Editor',   section: 'editor' as ActiveSection,  color: 'linear-gradient(135deg, #7b2ff7, #ff6b35)' },
    { icon: <Github className="w-4 h-4" />,   label: 'GitHub',   section: 'github' as ActiveSection,  color: 'linear-gradient(135deg, #00d2ff, #6b7280)' },
    { icon: <Box className="w-4 h-4" />,      label: 'Sandbox',  section: 'sandbox' as ActiveSection, color: 'linear-gradient(135deg, #ff6b35, #7b2ff7)' },
    { icon: <Users className="w-4 h-4" />,    label: 'Leads',    section: 'leads' as ActiveSection,   color: 'linear-gradient(135deg, #68d391, #00d2ff)' },
    { icon: <RefreshCw className="w-4 h-4" />, label: 'Refresh', section: null,                        color: 'rgba(255,255,255,0.15)' },
  ];

  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-3 flex-shrink-0"
      style={{ background: 'var(--bg-surface)', borderLeft: '1px solid rgba(99,179,237,0.12)' }}>
      {/* Electric indicator */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-electric"
        style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.25)' }}>
        <Zap className="w-4 h-4" style={{ color: 'var(--electric-1)' }} />
      </div>
      <div className="w-7 border-t" style={{ borderColor: 'rgba(99,179,237,0.15)' }} />

      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => a.section ? onNavigate(a.section) : window.location.reload()}
          title={a.label}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105"
          style={{
            background: activeSection === a.section ? a.color : 'rgba(255,255,255,0.06)',
            border: `1px solid ${activeSection === a.section ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
          }}>
          {a.icon}
        </button>
      ))}

      <div className="flex-1" />
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white' }}
        title={`Current: ${activeSection}`}>
        {activeSection[0].toUpperCase()}
      </div>
    </aside>
  );
}
