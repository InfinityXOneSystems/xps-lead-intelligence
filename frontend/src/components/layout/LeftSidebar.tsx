'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Users, Bot, BarChart3, Plug, Settings,
  ChevronLeft, ChevronRight, Github, Code2, Box,
} from 'lucide-react';
import { ActiveSection } from './AppLayout';
import clsx from 'clsx';

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ReactNode;
  dividerBefore?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'leads',      label: 'Leads',      icon: <Users className="w-4 h-4" /> },
  { id: 'agent',      label: 'Agent',      icon: <Bot className="w-4 h-4" /> },
  { id: 'analytics',  label: 'Analytics',  icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'github',     label: 'GitHub',     icon: <Github className="w-4 h-4" />, dividerBefore: true },
  { id: 'editor',     label: 'AI Editor',  icon: <Code2 className="w-4 h-4" /> },
  { id: 'sandbox',    label: 'Sandbox',    icon: <Box className="w-4 h-4" /> },
  { id: 'connectors', label: 'Connectors', icon: <Plug className="w-4 h-4" />, dividerBefore: true },
  { id: 'settings',   label: 'Settings',   icon: <Settings className="w-4 h-4" /> },
];

interface LeftSidebarProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
}

export function LeftSidebar({ activeSection, onNavigate }: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'flex flex-col flex-shrink-0 transition-all duration-300',
        collapsed ? 'w-14' : 'w-52',
      )}
      style={{
        background: 'linear-gradient(180deg, #0d0d1f 0%, #10101e 100%)',
        borderRight: '1px solid rgba(99,179,237,0.15)',
      }}
    >
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <div key={item.id}>
              {item.dividerBefore && (
                <div className="mx-3 my-2 border-t" style={{ borderColor: 'rgba(99,179,237,0.1)' }} />
              )}
              <button
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150 relative',
                  isActive ? 'text-white' : 'text-white/50 hover:text-white/80',
                )}
                style={isActive ? {
                  background: 'linear-gradient(90deg, rgba(99,179,237,0.15) 0%, rgba(123,47,247,0.08) 100%)',
                } : undefined}
              >
                {/* Electric active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                    style={{ background: 'linear-gradient(180deg, var(--electric-1), var(--electric-2))' }}
                  />
                )}
                <span className={clsx('flex-shrink-0', isActive ? 'text-blue-300' : '')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-3 transition-colors"
        style={{
          borderTop: '1px solid rgba(99,179,237,0.1)',
          color: 'rgba(255,255,255,0.3)',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}

