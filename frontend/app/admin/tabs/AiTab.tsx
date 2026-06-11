'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAiStats, getAiRecent, searchAiTracks } from '@/lib/api';
import { StatCard } from '../components/StatCard';

export function AiTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  const loadAiData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getAiStats(), getAiRecent(50)]);
      setStats(s);
      setRecentTracks(r?.tracks ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await searchAiTracks(q);
      setSearchResults(res);
    } catch {
      setSearchResults(null);
    }
    setSearching(false);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-zinc-500 text-xs">Querying AI stats...</p>
      </div>
    );
  }

  const pct = (n: number) => (stats?.total ? ((n / stats.total) * 100).toFixed(1) : '0');

  return (
    <div className="space-y-6">
      {/* AI stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Enriched" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="🧠" />
        <StatCard value={stats?.processed ?? '-'} label="Processed" color="#10b981" glowColor="rgba(16,185,129,0.15)" icon="✓" />
        <StatCard value={stats?.unprocessed ?? '-'} label="Queue Size" color="#f59e0b" glowColor="rgba(245,158,11,0.15)" icon="⌛" />
        <StatCard value={stats?.errors ?? '-'} label="Failures" color="#ef4444" glowColor="rgba(239,68,68,0.15)" icon="✗" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Genre distribution */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span>📊</span> AI Genre Breakdown
            </h3>
            {stats?.distribution?.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {stats.distribution.map((g: any) => (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400 truncate w-32">{g.genre}</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{g.count} ({pct(g.count)}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(g.count / stats.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-600 text-xs italic">No classification data recorded.</p>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-zinc-500">
            Last model run: {stats?.last_processed ? new Date(stats.last_processed).toLocaleString() : 'Never'}
          </div>
        </div>

        {/* AI Tag Search Panel */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>🔍</span> Search AI Taxonomy
          </h3>
          <p className="text-xs text-zinc-500 mb-4">Query database cache using music descriptors, moods, beats, or tags.</p>

          <input
            value={searchQ}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search e.g. 'synthwave', 'melancholic piano', 'upbeat'..."
            className="w-full px-4 py-3 bg-black/25 border border-white/5 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] transition-all text-sm mb-4"
          />

          {searching && <p className="text-zinc-500 text-xs animate-pulse">Scanning taxonomy index...</p>}

          {searchResults?.tracks?.length > 0 && (
            <div className="overflow-x-auto max-h-80 border border-white/5 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-left py-2 px-4">Track</th>
                    <th className="text-left py-2 px-2">Artist</th>
                    <th className="text-left py-2 px-2">AI Genres</th>
                    <th className="text-left py-2 px-4">AI Descriptive Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.tracks.map((t: any) => (
                    <tr key={t.id} className="border-b border-white/[0.01] hover:bg-white/[0.01]">
                      <td className="py-2.5 px-4 font-semibold text-zinc-200">{t.name}</td>
                      <td className="py-2.5 px-2 text-zinc-400">{t.artist}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {(t.ai_genres || []).map((g: string) => (
                            <span key={g} className="px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)] text-[9px] font-bold uppercase">{g}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {(t.ai_tags || []).slice(0, 4).map((tag: string) => (
                            <span key={tag} className="px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 text-[9px] border border-white/[0.02]">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {searchQ && !searching && searchResults?.tracks?.length === 0 && (
            <p className="text-zinc-500 text-xs italic py-4 text-center">No cached tracks match the descriptor query.</p>
          )}
        </div>
      </div>
    </div>
  );
}
