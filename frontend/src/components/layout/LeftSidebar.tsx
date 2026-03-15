'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Bot,
  BarChart3,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ActiveSection } from './AppLayout';
import clsx from 'clsx';

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'leads', label: 'Leads', icon: <Users className="w-5 h-5" /> },
  { id: 'agent', label: 'Agent', icon: <Bot className="w-5 h-5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'connectors', label: 'Connectors', icon: <Plug className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
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
        'flex flex-col bg-[#1a1a2e] text-white transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
              activeSection === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
            )}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-3 text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-t border-white/10"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
