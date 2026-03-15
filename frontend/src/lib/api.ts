const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetchApi<{ status: string; timestamp: string }>('/api/health'),

  agent: {
    chat: (message: string, sessionId?: string) =>
      fetchApi<{ sessionId: string; message: string }>('/api/agent/chat', {
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
        method: 'POST',
        body: JSON.stringify({ source }),
      }),
    listJobs: () => fetchApi<{ jobs: ScrapingJob[] }>('/api/leads/jobs/list'),
  },

  connectors: {
    list: () => fetchApi<{ connectors: Connector[] }>('/api/connectors'),
    connect: (type: string, config?: Record<string, unknown>) =>
      fetchApi<{ connector: Connector; message: string }>(
        `/api/connectors/${type}/connect`,
        { method: 'POST', body: JSON.stringify({ config }) }
      ),
    disconnect: (type: string) =>
      fetchApi<{ connector: Connector; message: string }>(
        `/api/connectors/${type}/disconnect`,
        { method: 'POST' }
      ),
  },

  admin: {
    getConfig: () => fetchApi<{ config: Record<string, unknown> }>('/api/admin/config'),
    updateConfig: (config: Record<string, unknown>) =>
      fetchApi<{ updated: number }>('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
  },
};

export interface Lead {
  id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  website?: string;
  source?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED';
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
