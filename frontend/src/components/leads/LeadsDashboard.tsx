'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Search, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { api, Lead } from '@/lib/api';
import clsx from 'clsx';

const STATUS_COLORS: Record<Lead['status'], string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  CONTACTED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  QUALIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  CONVERTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
};

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scraping, setScraping] = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await api.leads.list();
      setLeads(data.leads);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.leads.scrape('demo');
      setTimeout(loadLeads, 2000);
    } catch (err) {
      console.error('Scrape failed:', err);
    } finally {
      setTimeout(() => setScraping(false), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.leads.delete(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = leads.filter(
    (l) =>
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {leads.length} total leads
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', scraping && 'animate-spin')} />
            {scraping ? 'Scraping…' : 'Scrape Leads'}
          </button>
          <button
            onClick={loadLeads}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">
              {search ? 'No leads match your search' : 'No leads yet. Try scraping!'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Name', 'Email', 'Company', 'Source', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {lead.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{lead.email}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {lead.company || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {lead.source || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[lead.status])}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
