'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Globe, Play, StopCircle, RefreshCw, Zap, Eye,
  CheckCircle2, XCircle, Clock, Download,
} from 'lucide-react';
import clsx from 'clsx';

interface ScrapingJob {
  id: string;
  source: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  results?: { leadsFound?: number; leadsSaved?: number; error?: string };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const PRESET_SOURCES = [
  { label: 'Yelp: Roofers in Dallas', value: 'yelp:roofing:Dallas TX' },
  { label: 'Yelp: HVAC in Phoenix', value: 'yelp:hvac:Phoenix AZ' },
  { label: 'YP: Plumbers in Houston', value: 'yp:plumbers:Houston TX' },
  { label: 'YP: Contractors in Chicago', value: 'yp:contractors:Chicago IL' },
  { label: 'Yelp: Electricians in LA', value: 'yelp:electricians:Los Angeles CA' },
  { label: 'Multi: Landscaping in Miami', value: 'multi:landscaping:Miami FL' },
];

export function LiveScraper() {
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const loadJobs = async () => {
    try {
      const r = await fetch(`${API}/api/leads/jobs/list?limit=30`);
      const data = await r.json() as { jobs: ScrapingJob[] };
      setJobs(data.jobs || []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadJobs();
    // Poll for job updates every 3s while any job is running
    pollRef.current = setInterval(() => {
      loadJobs();
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const launchScrape = async () => {
    const allSources = [
      ...selectedPresets,
      ...sources.split('\n').map((s) => s.trim()).filter(Boolean),
    ];
    if (!allSources.length) return;

    setLaunching(true);
    try {
      if (allSources.length === 1) {
        await fetch(`${API}/api/leads/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: allSources[0] }),
        });
      } else {
        await fetch(`${API}/api/outreach/scrape/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources: allSources }),
        });
      }
      setSources('');
      setSelectedPresets([]);
      await loadJobs();
    } finally { setLaunching(false); }
  };

  const runningCount = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'PENDING').length;
  const totalSaved = jobs.reduce((acc, j) => acc + (j.results?.leadsSaved || 0), 0);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(99,179,237,0.15)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" style={{ color: 'var(--electric-1)' }} />
            <h2 className="text-lg font-bold text-white">Live Web Scraper</h2>
            {runningCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium animate-pulse" style={{ background: 'rgba(104,211,145,0.15)', border: '1px solid rgba(104,211,145,0.3)', color: '#68d391' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />{runningCount} running
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{totalSaved} leads saved</span>
            <button onClick={loadJobs} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Scrape real business directories — Yelp, Yellow Pages, direct URLs. All data normalized and scored automatically.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: scrape launcher */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r p-4" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quick Presets</p>
          <div className="space-y-1.5 mb-4">
            {PRESET_SOURCES.map((preset) => {
              const selected = selectedPresets.includes(preset.value);
              return (
                <button key={preset.value} onClick={() => setSelectedPresets((p) => selected ? p.filter((v) => v !== preset.value) : [...p, preset.value])}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all"
                  style={{ background: selected ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selected ? 'rgba(99,179,237,0.4)' : 'rgba(255,255,255,0.06)'}`, color: selected ? 'var(--electric-1)' : 'rgba(255,255,255,0.6)' }}>
                  <div className="flex items-center gap-1.5">
                    {selected && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                    {preset.label}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Sources</p>
          <textarea
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            placeholder={'yelp:restaurants:New York\nyp:plumbers:Dallas TX\nurl:https://business.com'}
            rows={4}
            className="w-full px-3 py-2 text-xs rounded-lg resize-none mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,179,237,0.2)', color: 'white', fontFamily: 'monospace' }}
          />

          <button onClick={launchScrape} disabled={launching || (!selectedPresets.length && !sources.trim())}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.25), rgba(123,47,247,0.25))', border: '1px solid rgba(99,179,237,0.4)', color: 'white' }}>
            {launching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {launching ? 'Launching…' : `Launch ${selectedPresets.length + sources.split('\n').filter((s) => s.trim()).length || ''} Job(s)`}
          </button>

          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-semibold mb-2 text-white/50">Source Formats</p>
            <p className="text-xs font-mono text-white/40 leading-relaxed">
              yelp:query:City ST<br />
              yp:query:City ST<br />
              multi:query:City ST<br />
              url:https://site.com
            </p>
          </div>
        </div>

        {/* Right: job list */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--electric-1)' }} />
              <p className="text-white/30 text-sm">No scraping jobs yet</p>
              <p className="text-white/20 text-xs mt-1">Select presets or enter custom sources, then click Launch</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: ScrapingJob }) {
  const isRunning = job.status === 'RUNNING' || job.status === 'PENDING';
  const durationMs = job.completedAt && job.startedAt
    ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
    : null;

  return (
    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${job.status === 'COMPLETED' ? 'rgba(104,211,145,0.2)' : job.status === 'FAILED' ? 'rgba(252,129,129,0.2)' : 'rgba(99,179,237,0.15)'}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--electric-1)' }} />}
          {job.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
          {job.status === 'FAILED' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
          {job.status === 'PENDING' && <Clock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 animate-pulse" />}
          <span className="text-xs font-medium text-white truncate">{job.source}</span>
        </div>
        <span className={clsx('text-xs px-2 py-0.5 rounded-full flex-shrink-0', {
          'bg-blue-500/20 text-blue-300': isRunning,
          'bg-green-500/20 text-green-300': job.status === 'COMPLETED',
          'bg-red-500/20 text-red-300': job.status === 'FAILED',
        })}>{job.status}</span>
      </div>
      <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {job.results?.leadsFound !== undefined && (
          <span><Zap className="w-3 h-3 inline mr-1 text-yellow-400" />{job.results.leadsFound} found, {job.results.leadsSaved} saved</span>
        )}
        {job.results?.error && <span className="text-red-400 truncate">{job.results.error}</span>}
        {durationMs && <span><Clock className="w-3 h-3 inline mr-1" />{(durationMs / 1000).toFixed(1)}s</span>}
        <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
      </div>
      {isRunning && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, var(--electric-1), var(--electric-2))' }} />
        </div>
      )}
    </div>
  );
}
