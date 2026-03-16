'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Search, Trash2, Edit2, ExternalLink, Mail, Phone,
  Star, Download, TrendingUp, ChevronUp, ChevronDown, Filter, X, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import clsx from 'clsx';

interface CRMLead {
  id: string;
  businessName?: string;
  ownerName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  yearsInBusiness?: number;
  specialities?: string;
  leadScore: number;
  scoreGrade?: { label: string; color: string };
  status: string;
  outreachStatus: string;
  source?: string;
  createdAt: string;
  _count?: { emailSends: number; calendarEvents: number };
  email: string;
}

const OUTREACH_COLORS: Record<string, string> = {
  NOT_CONTACTED: 'rgba(99,179,237,0.15)',
  EMAIL_SENT: 'rgba(246,224,94,0.15)',
  REPLIED: 'rgba(104,211,145,0.15)',
  MEETING_SCHEDULED: 'rgba(123,47,247,0.2)',
  CLOSED_WON: 'rgba(104,211,145,0.25)',
  CLOSED_LOST: 'rgba(252,129,129,0.15)',
};

const OUTREACH_LABELS: Record<string, string> = {
  NOT_CONTACTED: 'Not Contacted',
  EMAIL_SENT: 'Email Sent',
  REPLIED: 'Replied',
  MEETING_SCHEDULED: 'Meeting Scheduled',
  CLOSED_WON: 'Won ✓',
  CLOSED_LOST: 'Lost',
};

type SortField = 'leadScore' | 'businessName' | 'yearsInBusiness' | 'createdAt';
type SortDir = 'asc' | 'desc';

export function LeadsCRM() {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [sortField, setSortField] = useState<SortField>('leadScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CRMLead>>({});
  const [stats, setStats] = useState<{ total: number; avgScore: number } | null>(null);
  const [scrapeSource, setScrapeSource] = useState('');
  const [showScrapeInput, setShowScrapeInput] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsData, statsData] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/leads?orderBy=score`).then((r) => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/leads/stats`).then((r) => r.json()),
      ]);
      setLeads(leadsData.leads || []);
      setStats(statsData);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScrape = async () => {
    const source = scrapeSource || 'yelp:businesses:United States';
    setScraping(true);
    setShowScrapeInput(false);
    try {
      await api.leads.scrape(source);
      setTimeout(load, 3000);
    } finally {
      setTimeout(() => setScraping(false), 3000);
    }
  };

  const handleScoreAll = async () => {
    setScoring(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/outreach/leads/score-all`, { method: 'POST' });
      await load();
    } finally { setScoring(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    await api.leads.delete(id);
    setLeads((p) => p.filter((l) => l.id !== id));
  };

  const handleEdit = (lead: CRMLead) => {
    setEditId(lead.id);
    setEditData({ businessName: lead.businessName, ownerName: lead.ownerName, businessPhone: lead.businessPhone, businessEmail: lead.businessEmail, businessWebsite: lead.businessWebsite, yearsInBusiness: lead.yearsInBusiness, specialities: lead.specialities });
  };

  const handleSave = async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData),
    });
    setEditId(null);
    await load();
  };

  const handleExport = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/outreach/leads/export/csv`, '_blank');
  };

  const sorted = [...leads]
    .filter((l) =>
      !search ||
      [l.businessName, l.ownerName, l.businessPhone, l.businessEmail, l.specialities, l.email]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      let va: string | number | undefined = a[sortField];
      let vb: string | number | undefined = b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,179,237,0.15)' }}>
        <div>
          <h2 className="text-lg font-bold text-white">Leads CRM</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {stats ? `${stats.total} leads · avg score ${stats.avgScore}` : `${leads.length} leads`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleScoreAll} disabled={scoring} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all" style={{ background: 'rgba(123,47,247,0.15)', border: '1px solid rgba(123,47,247,0.4)', color: '#b794f4' }}>
            <TrendingUp className={clsx('w-3.5 h-3.5', scoring && 'animate-spin')} />
            {scoring ? 'Scoring…' : 'Score All'}
          </button>
          {showScrapeInput ? (
            <div className="flex items-center gap-1">
              <input value={scrapeSource} onChange={(e) => setScrapeSource(e.target.value)} placeholder="yelp:roofers:Dallas TX" className="text-xs px-2 py-1.5 rounded-lg w-48" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,179,237,0.3)', color: 'white' }} />
              <button onClick={handleScrape} disabled={scraping} className="px-2 py-1.5 text-xs rounded-lg" style={{ background: 'rgba(104,211,145,0.2)', border: '1px solid rgba(104,211,145,0.4)', color: '#68d391' }}>
                {scraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setShowScrapeInput(false)} className="p-1.5 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setShowScrapeInput(true)} disabled={scraping} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all" style={{ background: 'rgba(104,211,145,0.15)', border: '1px solid rgba(104,211,145,0.4)', color: '#68d391' }}>
              <RefreshCw className={clsx('w-3.5 h-3.5', scraping && 'animate-spin')} />
              {scraping ? 'Scraping…' : 'Scrape'}
            </button>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all" style={{ background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', color: 'var(--electric-1)' }}>
            <Download className="w-3.5 h-3.5" />CSV
          </button>
          <button onClick={load} className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-white/70">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(99,179,237,0.1)' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className="w-full pl-9 pr-4 py-2 text-xs rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,179,237,0.15)', color: 'white' }} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--electric-1)' }} /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            {search ? 'No leads match your search' : 'No leads yet — start scraping!'}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead style={{ background: 'rgba(255,255,255,0.03)' }} className="sticky top-0">
              <tr>
                {[
                  { label: '#', width: 40 },
                  { label: 'Business Name', field: 'businessName' as SortField, width: 160 },
                  { label: 'Owner', field: undefined, width: 120 },
                  { label: 'Phone', width: 120 },
                  { label: 'Email', width: 160 },
                  { label: 'Website', width: 120 },
                  { label: 'Yrs', field: 'yearsInBusiness' as SortField, width: 50 },
                  { label: 'Specialities', width: 160 },
                  { label: 'Score', field: 'leadScore' as SortField, width: 70 },
                  { label: 'Outreach', width: 110 },
                  { label: '', width: 70 },
                ].map(({ label, field, width }) => (
                  <th key={label} style={{ width, minWidth: width, textAlign: 'left', padding: '8px 10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em', borderBottom: '1px solid rgba(99,179,237,0.1)', cursor: field ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                    onClick={() => field && toggleSort(field)}>
                    <span className="flex items-center gap-1">{label}{field && <SortIcon field={field} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead, idx) => {
                const isEditing = editId === lead.id;
                const gradeLetter = lead.scoreGrade?.label || (lead.leadScore >= 70 ? 'A' : lead.leadScore >= 50 ? 'B' : 'C');
                const gradeColor = lead.scoreGrade?.color || (lead.leadScore >= 70 ? '#68d391' : lead.leadScore >= 50 ? '#63b3ed' : '#f6e05e');
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/[0.02] transition-colors">
                    {/* Index */}
                    <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.25)' }}>{idx + 1}</td>
                    {/* Business Name */}
                    <td style={{ padding: '6px 10px' }}>
                      {isEditing ? <input value={editData.businessName || ''} onChange={(e) => setEditData((p) => ({ ...p, businessName: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : <span className="font-medium text-white">{lead.businessName || '—'}</span>}
                    </td>
                    {/* Owner */}
                    <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.7)' }}>
                      {isEditing ? <input value={editData.ownerName || ''} onChange={(e) => setEditData((p) => ({ ...p, ownerName: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : lead.ownerName || '—'}
                    </td>
                    {/* Phone */}
                    <td style={{ padding: '6px 10px' }}>
                      {isEditing ? <input value={editData.businessPhone || ''} onChange={(e) => setEditData((p) => ({ ...p, businessPhone: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : lead.businessPhone ? (
                        <a href={`tel:${lead.businessPhone}`} className="flex items-center gap-1 hover:text-blue-300 transition-colors" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          <Phone className="w-3 h-3 flex-shrink-0" />{lead.businessPhone}
                        </a>
                      ) : <span className="text-white/25">—</span>}
                    </td>
                    {/* Email */}
                    <td style={{ padding: '6px 10px' }}>
                      {isEditing ? <input value={editData.businessEmail || ''} onChange={(e) => setEditData((p) => ({ ...p, businessEmail: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : (lead.businessEmail || lead.email) ? (
                        <a href={`https://mail.google.com/mail/?view=cm&to=${lead.businessEmail || lead.email}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-300 transition-colors truncate max-w-[150px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          <Mail className="w-3 h-3 flex-shrink-0" />{lead.businessEmail || lead.email}
                        </a>
                      ) : <span className="text-white/25">—</span>}
                    </td>
                    {/* Website */}
                    <td style={{ padding: '6px 10px' }}>
                      {isEditing ? <input value={editData.businessWebsite || ''} onChange={(e) => setEditData((p) => ({ ...p, businessWebsite: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : lead.businessWebsite ? (
                        <a href={lead.businessWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-300 transition-colors truncate max-w-[110px]" style={{ color: 'rgba(99,179,237,0.8)' }}>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          {lead.businessWebsite.replace(/^https?:\/\//, '')}
                        </a>
                      ) : <span className="text-white/25">—</span>}
                    </td>
                    {/* Years */}
                    <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                      {isEditing ? <input type="number" value={editData.yearsInBusiness || ''} onChange={(e) => setEditData((p) => ({ ...p, yearsInBusiness: parseInt(e.target.value) || undefined }))} className="w-full px-1 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : lead.yearsInBusiness ?? '—'}
                    </td>
                    {/* Specialities */}
                    <td style={{ padding: '6px 10px', maxWidth: 160 }}>
                      {isEditing ? <input value={editData.specialities || ''} onChange={(e) => setEditData((p) => ({ ...p, specialities: e.target.value }))} className="w-full px-2 py-1 text-xs rounded bg-white/10 border border-white/20 text-white" /> : <span className="text-white/50 truncate block">{lead.specialities || '—'}</span>}
                    </td>
                    {/* Score */}
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span className="flex items-center justify-center gap-1">
                        <span className="font-bold text-sm" style={{ color: gradeColor }}>{gradeLetter}</span>
                        <span className="text-white/40">{lead.leadScore}</span>
                      </span>
                    </td>
                    {/* Outreach Status */}
                    <td style={{ padding: '6px 10px' }}>
                      <span className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap" style={{ background: OUTREACH_COLORS[lead.outreachStatus] || 'rgba(99,179,237,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {OUTREACH_LABELS[lead.outreachStatus] || lead.outreachStatus}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '6px 10px' }}>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSave(lead.id)} className="p-1 rounded hover:bg-green-500/20 text-green-400"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-red-500/20 text-red-400"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(lead)} className="p-1 rounded text-white/30 hover:text-blue-300 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(lead.id)} className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
