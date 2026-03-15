'use client';

/**
 * Real Settings page with OAuth login buttons for Google, GitHub, and Railway.
 * When accounts are connected, platform features auto-activate.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Save, CheckCircle, XCircle, Loader2, LogIn, LogOut,
  Chrome, Github, Zap, AlertCircle, RefreshCw, ExternalLink,
  Settings2, Link2, User,
} from 'lucide-react';
import { api, Connector } from '@/lib/api';
import { useAuth, AccountInfo } from '@/contexts/AuthContext';

interface AdminSettingsProps {
  initialTab?: 'accounts' | 'connectors' | 'config';
}

const RAILWAY_PROJECT_ID = '0361239a-54f7-4db8-8350-d7931d2b9260';
const RAILWAY_PROJECT_NAME = 'Lead Intelligence';
const RAILWAY_PROJECT_URL = `https://railway.app/project/${RAILWAY_PROJECT_ID}`;

const CONNECTOR_TYPES = [
  { type: 'GITHUB', label: 'GitHub App', description: 'Connect GitHub App for repos, issues, PRs, CI/CD' },
  {
    type: 'RAILWAY',
    label: 'Railway',
    description: `Deploy and manage Railway — Project: ${RAILWAY_PROJECT_NAME}`,
    projectUrl: RAILWAY_PROJECT_URL,
    projectId: RAILWAY_PROJECT_ID,
  },
  { type: 'GPT', label: 'GPT Actions', description: 'OpenAI GPT custom actions integration' },
  { type: 'GOOGLE', label: 'Google Workspace', description: 'Google Sheets, Calendar, Gmail' },
  { type: 'XPS', label: 'XPS Orchestrator', description: 'XPS orchestration platform' },
];

// ─── Account card ─────────────────────────────────────────────────────────────

interface AccountCardProps {
  provider: 'google' | 'github' | 'railway';
  info?: AccountInfo;
  onLogin: () => void;
  onLogout: () => void;
  busy: boolean;
  icon: React.ReactNode;
  name: string;
  description: string;
  loginLabel: string;
  color: string;
  railwayToken?: string;
  onRailwayTokenChange?: (v: string) => void;
}

function AccountCard({
  provider, info, onLogin, onLogout, busy,
  icon, name, description, loginLabel, color,
  railwayToken, onRailwayTokenChange,
}: AccountCardProps) {
  const connected = info?.connected;
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: connected ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: connected ? `${color}22` : 'rgba(255,255,255,0.06)', border: `1px solid ${connected ? color + '40' : 'rgba(255,255,255,0.1)'}` }}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white text-sm">{name}</p>
              {connected ? (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(72,199,142,0.15)', color: '#48c78e', border: '1px solid rgba(72,199,142,0.3)' }}>
                  <CheckCircle className="w-2.5 h-2.5" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <XCircle className="w-2.5 h-2.5" /> Not connected
                </span>
              )}
            </div>
            {connected && (info.userName || info.userEmail) ? (
              <div className="flex items-center gap-2 mt-0.5">
                {info.userAvatar && <img src={info.userAvatar} alt="" className="w-4 h-4 rounded-full" />}
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {info.userName}{info.userLogin ? ` (@${info.userLogin})` : ''}{info.userEmail ? ` · ${info.userEmail}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{description}</p>
            )}
          </div>
        </div>
        {connected ? (
          <button onClick={onLogout} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Disconnect
          </button>
        ) : (
          <button onClick={onLogin} disabled={busy || (provider === 'railway' && !railwayToken?.trim())}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: color, color: 'white' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            {loginLabel}
          </button>
        )}
      </div>
      {provider === 'railway' && !connected && (
        <div className="px-5 pb-5">
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Get token from{' '}
            <a href="https://railway.app/account/tokens" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color }}>railway.app/account/tokens ↗</a>
          </p>
          <input type="password" value={railwayToken || ''} onChange={(e) => onRailwayTokenChange?.(e.target.value)}
            placeholder="Paste Railway API token…"
            onKeyDown={(e) => { if (e.key === 'Enter' && railwayToken?.trim()) onLogin(); }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
        </div>
      )}
      {connected && info?.connectedAt && (
        <div className="px-5 pb-4 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Connected {new Date(info.connectedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminSettings({ initialTab = 'accounts' }: AdminSettingsProps) {
  const { auth, loading: authLoading, loginGoogle, loginGithub, loginRailway, logout, refresh } = useAuth();
  const [tab, setTab] = useState<'accounts' | 'connectors' | 'config'>(initialTab);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loginBusy, setLoginBusy] = useState<string | null>(null);
  const [railwayToken, setRailwayToken] = useState('');

  const showMsg = (text: string, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [connData, cfgData] = await Promise.all([api.connectors.list(), api.admin.getConfig()]);
      setConnectors(connData.connectors);
      setConfig(Object.fromEntries(Object.entries(cfgData.config).map(([k, v]) => [k, String(v)])));
    } catch { /* ignore when backend offline */ } finally { setDataLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleGoogleLogin = async () => {
    setLoginBusy('google');
    try { await loginGoogle(); }
    catch (err) { showMsg(`Google: ${err instanceof Error ? err.message : 'Add GOOGLE_CLIENT_ID to Railway env vars'}`, false); setLoginBusy(null); }
  };

  const handleGithubLogin = async () => {
    setLoginBusy('github');
    try { await loginGithub(); }
    catch (err) { showMsg(`GitHub: ${err instanceof Error ? err.message : 'Add GITHUB_OAUTH_CLIENT_ID to Railway env vars'}`, false); setLoginBusy(null); }
  };

  const handleRailwayLogin = async () => {
    setLoginBusy('railway');
    try {
      const result = await loginRailway(railwayToken);
      if (result.success) { setRailwayToken(''); showMsg(result.message, true); }
      else showMsg(result.message, false);
    } catch (err) { showMsg(`Railway: ${err instanceof Error ? err.message : 'Connection failed'}`, false); }
    finally { setLoginBusy(null); }
  };

  const handleLogout = async (provider: 'google' | 'github' | 'railway') => {
    setLoginBusy(provider);
    try { await logout(provider); showMsg(`${provider} disconnected`, true); }
    catch { showMsg(`Failed to disconnect ${provider}`, false); }
    finally { setLoginBusy(null); }
  };

  const handleConnect = async (type: string) => {
    try { await api.connectors.connect(type); await loadData(); showMsg(`${type} connected`, true); }
    catch (err) { showMsg(`Failed: ${err instanceof Error ? err.message : 'Error'}`, false); }
  };

  const handleDisconnect = async (type: string) => {
    try { await api.connectors.disconnect(type); await loadData(); showMsg(`${type} disconnected`, true); }
    catch { showMsg(`Failed to disconnect ${type}`, false); }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try { await api.admin.updateConfig(config); showMsg('Configuration saved', true); }
    catch { showMsg('Failed to save configuration', false); }
    finally { setSaving(false); }
  };

  const getConnectorStatus = (type: string) => connectors.find((c) => c.type === type);

  const TABS = [
    { id: 'accounts', label: 'Accounts', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'connectors', label: 'Connectors', icon: <Link2 className="w-3.5 h-3.5" /> },
    { id: 'config', label: 'Config', icon: <Settings2 className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Connect accounts to enable all platform features
          </p>
        </div>
        <button onClick={refresh} title="Refresh status" className="p-2 rounded-lg transition-all hover:opacity-80" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
            style={tab === id
              ? { background: 'rgba(99,179,237,0.15)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.25)' }
              : { color: 'rgba(255,255,255,0.4)' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Status message */}
      {message && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={message.ok
            ? { background: 'rgba(72,199,142,0.1)', color: '#48c78e', border: '1px solid rgba(72,199,142,0.2)' }
            : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          {message.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* ── Accounts ─────────────────────────────────────────────────────────── */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 text-sm"
            style={{ background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.2)' }}>
            <p className="font-medium text-white mb-1.5 flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--electric-1)' }} />
              Connect accounts to unlock all features
            </p>
            <ul className="space-y-1 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <li>• <strong className="text-white">Google</strong> → Gmail outreach, Sheets CRM export, Calendar follow-ups</li>
              <li>• <strong className="text-white">GitHub</strong> → Repos, issues, PRs, Actions — project tracking</li>
              <li>• <strong className="text-white">Railway</strong> → Deploy services, view logs, manage environment vars</li>
            </ul>
          </div>

          {authLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
          ) : (
            <>
              <AccountCard provider="google" info={auth.google} onLogin={handleGoogleLogin}
                onLogout={() => handleLogout('google')} busy={loginBusy === 'google'}
                icon={<Chrome className="w-5 h-5" style={{ color: '#4285F4' }} />}
                name="Google Account" description="Gmail, Sheets, Calendar"
                loginLabel="Sign in with Google" color="#4285F4" />

              <AccountCard provider="github" info={auth.github} onLogin={handleGithubLogin}
                onLogout={() => handleLogout('github')} busy={loginBusy === 'github'}
                icon={<Github className="w-5 h-5 text-white" />}
                name="GitHub Account" description="Repos, issues, pull requests, CI/CD"
                loginLabel="Sign in with GitHub" color="#24292e" />

              <AccountCard provider="railway" info={auth.railway} onLogin={handleRailwayLogin}
                onLogout={() => handleLogout('railway')} busy={loginBusy === 'railway'}
                icon={<Zap className="w-5 h-5" style={{ color: '#B845ED' }} />}
                name="Railway Account" description="Deploy services, view logs, manage env"
                loginLabel="Connect Railway" color="#B845ED"
                railwayToken={railwayToken} onRailwayTokenChange={setRailwayToken} />

              <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="font-medium text-white mb-1">OAuth Setup (Required for Google &amp; GitHub)</p>
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Add to Railway service environment variables:
                  {' '}<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,
                  {' '}<code>GITHUB_OAUTH_CLIENT_ID</code>, <code>GITHUB_OAUTH_CLIENT_SECRET</code>,
                  {' '}<code>JWT_SECRET</code>, <code>BACKEND_URL</code>.
                </p>
                <a href={RAILWAY_PROJECT_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2" style={{ color: '#B845ED' }}>
                  <ExternalLink className="w-3 h-3" /> Open Railway Dashboard
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Connectors ───────────────────────────────────────────────────────── */}
      {tab === 'connectors' && (
        <div className="space-y-3">
          {dataLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
          ) : (
            CONNECTOR_TYPES.map(({ type, label, description, projectUrl, projectId }) => {
              const connector = getConnectorStatus(type);
              const isConnected = connector?.status === 'CONNECTED';
              return (
                <div key={type} className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', border: isConnected ? '1px solid rgba(99,179,237,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: isConnected ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.05)', color: isConnected ? 'var(--electric-1)' : 'rgba(255,255,255,0.4)' }}>
                      {label[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-white text-sm">{label}</p>
                        {isConnected
                          ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#48c78e' }} />
                          : <XCircle className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />}
                      </div>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{description}</p>
                      {projectUrl && (
                        <a href={projectUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--electric-1)' }}>
                          <ExternalLink className="w-2.5 h-2.5" /> View ({projectId?.slice(0, 8)}…)
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => isConnected ? handleDisconnect(type) : handleConnect(type)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={isConnected
                      ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                      : { background: 'rgba(99,179,237,0.15)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.25)' }}>
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Config ───────────────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="space-y-5">
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-medium text-white text-sm mb-4">API Keys</h3>
            <div className="space-y-3">
              {[
                { key: 'groq_api_key', label: 'Groq API Key', placeholder: 'gsk_…', href: 'https://console.groq.com/keys' },
                { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-…', href: 'https://platform.openai.com/api-keys' },
                { key: 'github_token', label: 'GitHub Personal Access Token', placeholder: 'ghp_…', href: 'https://github.com/settings/tokens' },
              ].map(({ key, label, placeholder, href }) => (
                <div key={key}>
                  <label className="flex items-center justify-between text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <span>{label}</span>
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--electric-1)' }}>Get key ↗</a>
                  </label>
                  <input type="password" value={config[key] || ''} placeholder={placeholder}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-medium text-white text-sm mb-3">Railway Project</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Railway Token</label>
                <input type="password" value={config['railway_token'] || ''} placeholder="Token from Accounts tab or manual"
                  onChange={(e) => setConfig((p) => ({ ...p, railway_token: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
              </div>
              <div className="flex gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>Project: <strong className="text-white">{RAILWAY_PROJECT_NAME}</strong></span>
                <span>ID: <code>{RAILWAY_PROJECT_ID.slice(0, 8)}…</code></span>
              </div>
              <a href={RAILWAY_PROJECT_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs" style={{ color: '#B845ED' }}>
                <ExternalLink className="w-3 h-3" /> Open Railway Dashboard
              </a>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-medium text-white text-sm mb-4">System</h3>
            <div className="space-y-3">
              {[
                { key: 'xps_orchestrator_url', label: 'XPS Orchestrator URL', placeholder: 'https://…' },
                { key: 'google_client_id', label: 'Google Client ID', placeholder: '…apps.googleusercontent.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</label>
                  <input type="text" value={config[key] || ''} placeholder={placeholder}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSaveConfig} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--electric-1), var(--electric-2))', color: 'white' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}

