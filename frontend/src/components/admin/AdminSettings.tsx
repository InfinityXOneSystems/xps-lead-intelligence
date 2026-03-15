'use client';

import { useEffect, useState } from 'react';
import { Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api, Connector } from '@/lib/api';
import clsx from 'clsx';

interface AdminSettingsProps {
  initialTab?: 'connectors' | 'config';
}

const CONNECTOR_TYPES = [
  { type: 'GITHUB', label: 'GitHub', description: 'Connect to GitHub repositories and CI/CD' },
  { type: 'RAILWAY', label: 'Railway', description: 'Deploy and manage Railway services' },
  { type: 'GPT', label: 'GPT Actions', description: 'OpenAI GPT custom actions integration' },
  { type: 'GOOGLE', label: 'Google', description: 'Google Workspace and Analytics' },
  { type: 'XPS', label: 'XPS Orchestrator', description: 'XPS orchestration platform' },
];

export function AdminSettings({ initialTab = 'connectors' }: AdminSettingsProps) {
  const [tab, setTab] = useState<'connectors' | 'config'>(initialTab);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [connData, cfgData] = await Promise.all([
        api.connectors.list(),
        api.admin.getConfig(),
      ]);
      setConnectors(connData.connectors);
      setConfig(
        Object.fromEntries(
          Object.entries(cfgData.config).map(([k, v]) => [k, String(v)])
        )
      );
    } catch (err) {
      console.error('Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      await api.connectors.connect(type);
      await loadData();
      setMessage(`${type} connected successfully`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Failed to connect ${type}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDisconnect = async (type: string) => {
    try {
      await api.connectors.disconnect(type);
      await loadData();
      setMessage(`${type} disconnected`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Failed to disconnect ${type}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.admin.updateConfig(config);
      setMessage('Configuration saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save configuration');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getConnectorStatus = (type: string): Connector | undefined =>
    connectors.find((c) => c.type === type);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tab === 'connectors' ? 'Connectors' : 'Settings'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {tab === 'connectors' ? 'Manage external service integrations' : 'System configuration'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {(['connectors', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize',
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Status message */}
      {message && (
        <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : tab === 'connectors' ? (
        <div className="grid grid-cols-1 gap-4">
          {CONNECTOR_TYPES.map(({ type, label, description }) => {
            const connector = getConnectorStatus(type);
            const isConnected = connector?.status === 'CONNECTED';

            return (
              <div
                key={type}
                className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                      isConnected
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {label[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
                      {isConnected ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                    {connector?.lastChecked && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Last checked: {new Date(connector.lastChecked).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => isConnected ? handleDisconnect(type) : handleConnect(type)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isConnected
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  {isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">API Keys</h3>
            <div className="space-y-4">
              {[
                { key: 'groq_api_key', label: 'Groq API Key', placeholder: 'gsk_...' },
                { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-...' },
                { key: 'github_token', label: 'GitHub Token', placeholder: 'ghp_...' },
                { key: 'railway_token', label: 'Railway Token', placeholder: 'railway_...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={config[key] || ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">System Settings</h3>
            <div className="space-y-4">
              {[
                { key: 'xps_orchestrator_url', label: 'XPS Orchestrator URL', placeholder: 'https://...' },
                { key: 'google_client_id', label: 'Google Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={config[key] || ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}
