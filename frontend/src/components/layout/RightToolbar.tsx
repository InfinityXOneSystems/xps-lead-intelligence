'use client';

import { Bot, Users, RefreshCw, Plus, Zap } from 'lucide-react';
import { ActiveSection } from './AppLayout';

interface RightToolbarProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  color: string;
}

export function RightToolbar({ activeSection, onNavigate }: RightToolbarProps) {
  const quickActions: QuickAction[] = [
    {
      icon: <Bot className="w-4 h-4" />,
      label: 'Ask Agent',
      action: () => onNavigate('agent'),
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: 'View Leads',
      action: () => onNavigate('leads'),
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      icon: <Plus className="w-4 h-4" />,
      label: 'Add Lead',
      action: () => onNavigate('leads'),
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      icon: <RefreshCw className="w-4 h-4" />,
      label: 'Refresh',
      action: () => window.location.reload(),
      color: 'bg-gray-500 hover:bg-gray-600',
    },
  ];

  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-3 bg-gray-100 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/30">
        <Zap className="w-4 h-4 text-blue-500" />
      </div>
      <div className="w-8 border-t border-gray-300 dark:border-gray-600" />
      {quickActions.map((action) => (
        <button
          key={action.label}
          onClick={action.action}
          title={action.label}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-white transition-colors ${action.color}`}
        >
          {action.icon}
        </button>
      ))}
      <div className="flex-1" />
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
        title="Current: Dashboard"
      >
        {activeSection[0].toUpperCase()}
      </div>
    </aside>
  );
}
