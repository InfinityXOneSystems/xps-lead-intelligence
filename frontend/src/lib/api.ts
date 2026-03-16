const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'xps_session_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ? (options.headers as Record<string, string>) : {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((error as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetchApi<{ status: string; timestamp: string; features?: string[] }>('/api/health'),

  agent: {
    chat: (message: string, sessionId?: string) =>
      fetchApi<{ sessionId: string; message: string; toolCalls?: ToolCallResult[]; steps?: number }>('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ message, sessionId }),
      }),
    getSession: (sessionId: string) =>
      fetchApi<{ sessionId: string; messages: unknown[] }>(`/api/agent/session/${sessionId}`),
  },

  leads: {
    list: () => fetchApi<{ leads: Lead[]; total: number }>('/api/leads'),
    get: (id: string) => fetchApi<Lead>(`/api/leads/${id}`),
    create: (data: Partial<Lead>) =>
      fetchApi<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Lead>) =>
      fetchApi<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<void>(`/api/leads/${id}`, { method: 'DELETE' }),
    scrape: (source: string) =>
      fetchApi<{ jobId: string; message: string }>('/api/leads/scrape', {
        method: 'POST', body: JSON.stringify({ source }),
      }),
    listJobs: () => fetchApi<{ jobs: ScrapingJob[] }>('/api/leads/jobs/list'),
  },

  connectors: {
    list: () => fetchApi<{ connectors: Connector[] }>('/api/connectors'),
    connect: (type: string, config?: Record<string, unknown>) =>
      fetchApi<{ connector: Connector; message: string }>(`/api/connectors/${type}/connect`, {
        method: 'POST', body: JSON.stringify({ config }),
      }),
    disconnect: (type: string) =>
      fetchApi<{ connector: Connector; message: string }>(`/api/connectors/${type}/disconnect`, {
        method: 'POST',
      }),
  },

  admin: {
    getConfig: () => fetchApi<{ config: Record<string, unknown> }>('/api/admin/config'),
    updateConfig: (config: Record<string, unknown>) =>
      fetchApi<{ updated: number }>('/api/admin/config', {
        method: 'PUT', body: JSON.stringify(config),
      }),
  },

  // ── GitHub App ──────────────────────────────────────────────────────────────
  github: {
    getApp: () =>
      fetchApi<{ configured: boolean; app?: { name: string; html_url: string } }>('/api/github/app'),
    listRepos: () =>
      fetchApi<{ repos: GitHubRepo[]; total: number }>('/api/github/repos'),
    searchRepos: (q: string) =>
      fetchApi<{ results: GitHubRepo[] }>(`/api/github/repos/search?q=${encodeURIComponent(q)}`),
    listIssues: (owner: string, repo: string, state = 'open') =>
      fetchApi<{ issues: GitHubIssue[]; total: number }>(`/api/github/repos/${owner}/${repo}/issues?state=${state}`),
    createIssue: (owner: string, repo: string, title: string, body: string, labels?: string[]) =>
      fetchApi<GitHubIssue>(`/api/github/repos/${owner}/${repo}/issues`, {
        method: 'POST', body: JSON.stringify({ title, body, labels }),
      }),
    listPRs: (owner: string, repo: string, state = 'open') =>
      fetchApi<{ prs: unknown[]; total: number }>(`/api/github/repos/${owner}/${repo}/pulls?state=${state}`),
    getFile: (owner: string, repo: string, path: string, ref?: string) =>
      fetchApi<{ content: string; sha: string }>(`/api/github/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`),
    listWorkflows: (owner: string, repo: string) =>
      fetchApi<{ workflows: unknown[] }>(`/api/github/repos/${owner}/${repo}/actions/workflows`),
    getWorkflowRuns: (owner: string, repo: string, workflowId?: string) =>
      fetchApi<{ runs: GitHubWorkflowRun[] }>(`/api/github/repos/${owner}/${repo}/actions/runs${workflowId ? `?workflow_id=${workflowId}` : ''}`),
    triggerWorkflow: (owner: string, repo: string, workflowId: string, ref: string, inputs?: Record<string, string>) =>
      fetchApi<{ triggered: boolean }>(`/api/github/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
        method: 'POST', body: JSON.stringify({ ref, inputs }),
      }),
    searchCode: (q: string) =>
      fetchApi<{ results: unknown[] }>(`/api/github/search/code?q=${encodeURIComponent(q)}`),
    getEvents: (limit = 20) =>
      fetchApi<{ events: unknown[] }>(`/api/github/events?limit=${limit}`),
  },

  // ── XPS Orchestrator ────────────────────────────────────────────────────────
  xps: {
    status: () =>
      fetchApi<{ status: string; capabilities: Record<string, unknown>; tools: { name: string; description: string }[] }>('/api/xps/status'),
    execute: (task: string, sessionId?: string) =>
      fetchApi<{ sessionId: string; message: string; toolCalls: ToolCallResult[]; steps: number }>('/api/xps/execute', {
        method: 'POST', body: JSON.stringify({ task, sessionId }),
      }),
    listTools: () =>
      fetchApi<{ tools: { name: string; description: string; parameters: unknown }[]; total: number }>('/api/xps/tools'),
    executeTool: (toolName: string, args: Record<string, unknown>) =>
      fetchApi<ToolCallResult>(`/api/xps/tools/${toolName}`, {
        method: 'POST', body: JSON.stringify(args),
      }),
    getTasks: (sessionId?: string) =>
      fetchApi<{ tasks: AgentTask[] }>(`/api/xps/tasks${sessionId ? `?sessionId=${sessionId}` : ''}`),
    getSessions: () =>
      fetchApi<{ sessions: { sessionId: string; createdAt: string; updatedAt: string }[] }>('/api/xps/sessions'),
  },

  // ── Auth ─────────────────────────────────────────────────────────────────────
  auth: {
    status: () =>
      fetchApi<{ authenticated: boolean; accounts: Record<string, unknown> }>('/api/auth/status'),
    googleUrl: () =>
      fetchApi<{ url: string }>('/api/auth/google/url'),
    githubUrl: () =>
      fetchApi<{ url: string }>('/api/auth/github/url'),
    railwayToken: (token: string) =>
      fetchApi<{ success: boolean; token: string; user: Record<string, string>; message: string }>('/api/auth/railway', {
        method: 'POST', body: JSON.stringify({ token }),
      }),
    logout: (provider?: string) =>
      fetchApi<{ success: boolean }>('/api/auth/logout', {
        method: 'POST', body: JSON.stringify({ provider }),
      }),
    verify: (token: string) =>
      fetchApi<{ valid: boolean; payload: Record<string, unknown> }>('/api/auth/verify', {
        method: 'POST', body: JSON.stringify({ token }),
      }),
  },

  // ── Leads Stats ──────────────────────────────────────────────────────────────
  leadStats: () =>
    fetchApi<{ total: number; byStatus: Record<string, number>; avgScore: number; topSources: string[] }>('/api/leads/stats'),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCallResult {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface Lead {
  id: string;
  email: string;
  ownerName?: string;
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  yearsInBusiness?: number;
  specialities?: string;
  name?: string;
  company?: string;
  phone?: string;
  website?: string;
  source?: string;
  leadScore: number;
  scoreGrade?: { label: string; color: string };
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED';
  outreachStatus: 'NOT_CONTACTED' | 'EMAIL_SENT' | 'REPLIED' | 'MEETING_SCHEDULED' | 'CLOSED_WON' | 'CLOSED_LOST';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapingJob {
  id: string;
  source: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  results?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Connector {
  id: string;
  type: 'GITHUB' | 'RAILWAY' | 'GPT' | 'GOOGLE' | 'XPS';
  name: string;
  config: Record<string, unknown>;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastChecked?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubRepo {
  id?: number;
  full_name: string;
  name?: string;
  description: string | null;
  private?: boolean;
  html_url: string;
  default_branch?: string;
  language: string | null;
  stargazers_count?: number;
  open_issues_count?: number;
  updated_at?: string | null;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  labels: { name?: string }[];
  created_at: string;
  updated_at: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

export interface AgentTask {
  id: string;
  sessionId: string;
  input: string;
  output: string;
  toolCalls: ToolCallResult[];
  steps: number;
  status: string;
  createdAt: string;
}
