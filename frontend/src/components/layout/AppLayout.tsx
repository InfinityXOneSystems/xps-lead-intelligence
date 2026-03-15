'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Zap } from 'lucide-react';
import { LeftSidebar } from './LeftSidebar';
import { CenterEditor } from './CenterEditor';
import { RightToolbar } from './RightToolbar';

export type ActiveSection = 'dashboard' | 'leads' | 'agent' | 'analytics' | 'connectors' | 'settings';

export function AppLayout() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e] text-white shadow-md z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg tracking-tight">XPS Lead Intelligence</span>
        </div>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-300" />
          ) : (
            <Moon className="w-5 h-5 text-blue-300" />
          )}
        </button>
      </header>

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} />
        <CenterEditor activeSection={activeSection} />
        <RightToolbar activeSection={activeSection} onNavigate={setActiveSection} />
      </div>
    </div>
  );
}
