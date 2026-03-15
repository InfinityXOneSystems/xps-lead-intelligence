'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Zap, CheckCircle, Settings } from 'lucide-react';
import { LeftSidebar } from './LeftSidebar';
import { CenterEditor } from './CenterEditor';
import { RightToolbar } from './RightToolbar';
import { useAuth } from '@/contexts/AuthContext';

export type ActiveSection =
  | 'dashboard'
  | 'leads'
  | 'scraper'
  | 'outreach'
  | 'agent'
  | 'analytics'
  | 'connectors'
  | 'settings'
  | 'github'
  | 'editor'
  | 'sandbox'
  | 'social'
  | 'social-crm';

export function AppLayout() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const { theme, setTheme } = useTheme();
  const { auth, anyConnected } = useAuth();
  // Prevent SSR/client theme mismatch (next-themes) from causing hydration error
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const connectedAccounts = [auth.google, auth.github, auth.railway].filter((a) => a?.connected).length;

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 relative z-10"
        style={{
          background: 'linear-gradient(90deg, #0a0a14 0%, #10101e 50%, #0a0a14 100%)',
          borderBottom: '1px solid rgba(99,179,237,0.25)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="animate-electric w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #fff 0%, var(--electric-1) 50%, var(--metallic-2) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            XPS Lead Intelligence
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {anyConnected ? (
            <button
              onClick={() => setActiveSection('settings')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(72,199,142,0.1)', border: '1px solid rgba(72,199,142,0.3)', color: '#48c78e' }}>
              <CheckCircle className="w-3 h-3" />
              {connectedAccounts} account{connectedAccounts !== 1 ? 's' : ''} connected
            </button>
          ) : (
            <button
              onClick={() => setActiveSection('settings')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', color: '#ffa500' }}>
              <Settings className="w-3 h-3" />
              Connect accounts
            </button>
          )}

          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--electric-1)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Agent Online
          </span>

          {/* suppressHydrationWarning prevents the SSR/CSR theme icon mismatch from crashing React state */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            aria-label="Toggle theme"
            suppressHydrationWarning>
            {mounted && (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar activeSection={activeSection} onNavigate={setActiveSection} />
        <CenterEditor activeSection={activeSection} />
        <RightToolbar activeSection={activeSection} onNavigate={setActiveSection} />
      </div>
    </div>
  );
}
