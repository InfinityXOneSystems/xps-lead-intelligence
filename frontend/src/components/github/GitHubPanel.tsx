'use client';

import { useState, useEffect } from 'react';
import { Github, GitBranch, GitPullRequest, AlertCircle, Workflow, RefreshCw, Loader2, ExternalLink, Code2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Repo { full_name: string; description: string | null; html_url: string; stargazers_count?: number; language: string | null; default_branch?: string; }
interface Issue { number: number; title: string; state: string; html_url: string; user: { login: string } | null; created_at: string; }
interface WorkflowRun { id: number; name: string; status: string; conclusion: string | null; created_at: string; html_url: string; }

type GHTab = 'repos' | 'issues' | 'workflows' | 'events';

export function GitHubPanel() {
  const [tab, setTab] = useState<GHTab>('repos');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [appInfo, setAppInfo] = useState<{ configured: boolean; app?: { name: string; html_url: string } } | null>(null);

  useEffect(() => {
    api.github.getApp().then(setAppInfo).catch(() => setAppInfo({ configured: false }));
  }, []);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const data = await api.github.listRepos();
      setRepos(data.repos || []);
    } catch { setRepos([]); }
    finally { setLoading(false); }
  };

  const loadIssues = async () => {
    if (!selectedRepo) return;
    const [owner, repo] = selectedRepo.split('/');
    setLoading(true);
    try {
      const data = await api.github.listIssues(owner, repo);
      setIssues(data.issues || []);
    } catch { setIssues([]); }
    finally { setLoading(false); }
  };

  const loadWorkflowRuns = async () => {
    if (!selectedRepo) return;
    const [owner, repo] = selectedRepo.split('/');
    setLoading(true);
    try {
      const data = await api.github.getWorkflowRuns(owner, repo);
      setRuns(data.runs || []);
    } catch { setRuns([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'repos') loadRepos();
    else if (tab === 'issues') loadIssues();
    else if (tab === 'workflows') loadWorkflowRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedRepo]);

  const tabs: { id: GHTab; label: string; icon: React.ReactNode }[] = [
    { id: 'repos',     label: 'Repositories', icon: <Github className="w-3.5 h-3.5" /> },
    { id: 'issues',    label: 'Issues',        icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { id: 'workflows', label: 'Workflows',     icon: <Workflow className="w-3.5 h-3.5" /> },
  ];

  const statusColor = (s: string | null) => {
    if (s === 'success') return '#68d391';
    if (s === 'failure') return '#fc8181';
    if (s === 'in_progress') return '#63b3ed';
    return 'rgba(255,255,255,0.4)';
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)', color: 'white' }}>
      {/* Header */}
      <div className="px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,179,237,0.15)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.2), rgba(123,47,247,0.2))', border: '1px solid rgba(99,179,237,0.3)' }}>
              <Github className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">GitHub Integration</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {appInfo?.configured ? `App: ${appInfo.app?.name || 'XPS Orchestrator'}` : 'Configure GITHUB_APP_ID to connect'}
              </p>
            </div>
          </div>
          {appInfo?.configured && (
            <span className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Connected
            </span>
          )}
        </div>
      </div>

      {/* Repo selector */}
      {(tab === 'issues' || tab === 'workflows') && (
        <div className="px-5 py-3 flex-shrink-0 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
          <GitBranch className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="flex-1 text-sm py-1.5 px-2 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.2)', color: 'white', outline: 'none' }}>
            <option value="">Select a repository…</option>
            {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-5 pt-3 gap-1 flex-shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all"
            style={tab === t.id
              ? { background: 'rgba(99,179,237,0.15)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.3)' }
              : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
            {t.icon} {t.label}
          </button>
        ))}
        <button onClick={() => {
          if (tab === 'repos') loadRepos();
          else if (tab === 'issues') loadIssues();
          else loadWorkflowRuns();
        }}
          className="ml-auto p-1.5 rounded-md" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--electric-1)' }} />
          </div>
        )}

        {/* Repos */}
        {!loading && tab === 'repos' && (
          <div className="space-y-3">
            {repos.length === 0 && (
              <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {appInfo?.configured ? 'No repositories found' : 'Configure GitHub App credentials in Settings'}
              </div>
            )}
            {repos.map((r) => (
              <button key={r.full_name} onClick={() => { setSelectedRepo(r.full_name); setTab('issues'); }}
                className="card-metallic w-full text-left p-4 block transition-all hover:brightness-110">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{r.full_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.language && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,179,237,0.1)', color: 'var(--electric-1)', border: '1px solid rgba(99,179,237,0.2)' }}>{r.language}</span>}
                    <ExternalLink className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} onClick={(e) => { e.stopPropagation(); window.open(r.html_url, '_blank'); }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Issues */}
        {!loading && tab === 'issues' && (
          <div className="space-y-2">
            {issues.length === 0 && (
              <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {selectedRepo ? 'No open issues' : 'Select a repository first'}
              </div>
            )}
            {issues.map((i) => (
              <a key={i.number} href={i.html_url} target="_blank" rel="noopener noreferrer"
                className="card-metallic block p-3 transition-all hover:brightness-110">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: i.state === 'open' ? '#68d391' : '#fc8181' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{i.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      #{i.number} · {i.user?.login} · {new Date(i.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Workflow Runs */}
        {!loading && tab === 'workflows' && (
          <div className="space-y-2">
            {runs.length === 0 && (
              <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {selectedRepo ? 'No workflow runs' : 'Select a repository first'}
              </div>
            )}
            {runs.map((r) => (
              <a key={r.id} href={r.html_url} target="_blank" rel="noopener noreferrer"
                className="card-metallic block p-3 transition-all hover:brightness-110">
                <div className="flex items-center gap-3">
                  <Workflow className="w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor(r.conclusion) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{r.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {r.status} {r.conclusion ? `· ${r.conclusion}` : ''} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${statusColor(r.conclusion)}18`, color: statusColor(r.conclusion), border: `1px solid ${statusColor(r.conclusion)}44` }}>
                    {r.conclusion || r.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
