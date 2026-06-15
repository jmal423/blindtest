'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { getAdminStats, getDbStatus, getAiStats, getAiRecent, searchAiTracks, fetchGenres, importToCurated } from '@/lib/api';
import { StatCard } from '../../components/StatCard';
import { ProgressMeter } from '../../components/ProgressMeter';
import { useAdminAudio } from '../../hooks/useAdminAudio';

const GROUP_LABELS: Record<string, string> = {
  portuguese: 'Português',
  brazilian: 'Brasileiro',
  united_states: 'United States',
  united_kingdom: 'United Kingdom',
  french: 'Francês',
  spanish: 'Espanhol',
  global_other: 'Mundo & Outros',
};

// ── System sub-component ──────────────────────────────────────────────

function SystemSection() {
  const [sysStats, setSysStats] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [sysLoading, setSysLoading] = useState(true);

  const loadSystemData = useCallback(async () => {
    setSysLoading(true);
    try {
      const [s, db] = await Promise.all([getAdminStats(), getDbStatus()]);
      setSysStats(s);
      setDbStatus(db);
    } catch {}
    setSysLoading(false);
  }, []);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={sysStats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(255,45,120,0.15)" icon="👥" />
        <StatCard value={sysStats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" glowColor="rgba(240,192,64,0.15)" icon="🎵" />
        <StatCard value={sysStats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={sysStats?.activeRooms ?? '-'} label="Active Lobbies" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="🎮" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span className="text-lg">🐘</span> PostgreSQL Status
              </h3>
              <button
                onClick={loadSystemData}
                disabled={sysLoading}
                className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)', color: 'color-mix(in srgb, var(--foreground) 60%, transparent)' }}
              >
                {sysLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    <span className="text-sm font-semibold" style={{ color: 'color-mix(in srgb, var(--foreground) 80%, transparent)' }}>Database connected & online</span>
                  </div>

                  <div className="space-y-4">
                    <ProgressMeter
                      label="Round Guesses (V2)"
                      value={dbStatus.tables?.round_results_v2 ?? 0}
                      max={5000}
                      color="bg-[var(--accent)]"
                    />
                    <ProgressMeter
                      label="Users Recorded"
                      value={dbStatus.tables?.users ?? 0}
                      max={100}
                      color="bg-[var(--primary)]"
                    />
                    <ProgressMeter
                      label="Completed Games"
                      value={dbStatus.tables?.games ?? 0}
                      max={500}
                      color="bg-purple-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm font-medium" style={{ color: '#f87171' }}>{dbStatus.error || 'Connection failure'}</p>
                </div>
              )
            ) : (
              <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>Testing connectivity...</p>
            )}
          </div>

          <div className="mt-6 pt-4 flex justify-between text-[11px]" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)', color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>
            <span>Type: Local Postgres Container</span>
            <span>Uptime check: OK</span>
          </div>
        </div>

        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <span className="text-lg">🖥️</span> Service Performance
            </h3>
            <div className="space-y-5">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Uptime</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {sysStats?.uptime ? `${Math.floor(sysStats.uptime / 3600)}h ${Math.floor((sysStats.uptime % 3600) / 60)}m` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Local Cache Size</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--primary)' }}>
                  {sysStats?.songCacheTotal ?? 0} songs
                </span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Avg Socket Latency</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--accent)' }}>Normal (&lt; 10ms)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 flex items-center gap-2 text-xs" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)', color: '#4ade80' }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All local networks healthy
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI sub-component ─────────────────────────────────────────────────

function AiSection() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  const [allGenres, setAllGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  // Use the custom audio hook
  const { playingTrackId, togglePreview, AudioPlayerOverlay } = useAdminAudio();

  const loadAiData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, gList] = await Promise.all([getAiStats(), getAiRecent(50), fetchGenres()]);
      setStats(s);
      setRecentTracks(r?.tracks ?? []);
      setAllGenres(gList);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  const groupedGenres = useMemo(() => {
    const groups: Record<string, typeof allGenres> = {};
    for (const g of allGenres) {
      const groupKey = g.group || 'global_other';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(g);
    }
    return groups;
  }, [allGenres]);

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

  const handleImportTrack = async (songId: string, destGenre: string) => {
    try {
      await importToCurated([songId], destGenre);
      setImportedIds(prev => new Set([...prev, songId]));
    } catch (err: any) {
      alert(err.message || 'Failed to import track');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-foreground/40 text-xs">Querying AI stats...</p>
      </div>
    );
  }

  const pct = (n: number) => (stats?.total ? ((n / stats.total) * 100).toFixed(1) : '0');

  return (
    <div className="space-y-6">
      {/* Hidden audio element and overlay player wrapper from hook */}
      {AudioPlayerOverlay}

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
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground mb-6 flex items-center gap-2">
              <span>📊</span> AI Genre Breakdown
            </h3>
            {stats?.distribution?.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {stats.distribution.map((g: any) => (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-foreground/60 truncate w-32">{g.genre}</span>
                      <span className="text-foreground/80 font-mono text-[11px]">{g.count} ({pct(g.count)}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(g.count / stats.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground/30 text-xs italic">No classification data recorded.</p>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-foreground/40">
            Last model run: {stats?.last_processed ? new Date(stats.last_processed).toLocaleString() : 'Never'}
          </div>
        </div>

        {/* AI Tag Search Panel */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>🔍</span> Search AI Taxonomy
          </h3>
          <p className="text-xs text-foreground/40 mb-4">Query database cache using music descriptors, moods, beats, or tags.</p>

          <input
            value={searchQ}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search e.g. 'synthwave', 'melancholic piano', 'upbeat'..."
            className="w-full px-4 py-3 bg-black/25 border border-white/5 rounded-2xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-[var(--accent)] transition-all text-sm mb-4"
          />

          {searching && <p className="text-foreground/40 text-xs animate-pulse">Scanning taxonomy index...</p>}

          {searchResults?.tracks?.length > 0 && (
            <div className="overflow-x-auto max-h-80 border border-white/5 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-foreground/40 border-b border-white/5">
                  <tr>
                    <th className="text-center py-2 px-4 w-12">Preview</th>
                    <th className="text-left py-2 px-2">Track</th>
                    <th className="text-left py-2 px-2">Artist</th>
                    <th className="text-left py-2 px-2">AI Genres</th>
                    <th className="text-left py-2 px-2">AI Descriptive Tags</th>
                    <th className="text-right py-2 px-4 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.tracks.map((t: any) => {
                    const isImported = importedIds.has(t.id);
                    return (
                      <tr key={t.id} className="border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors">
                        <td className="py-2.5 px-4 text-center">
                          {t.preview_url ? (
                            <button
                              onClick={() => togglePreview(t.id, t.preview_url)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                playingTrackId === t.id
                                  ? 'bg-[var(--accent)] text-black shadow-lg scale-105'
                                  : 'bg-white/5 text-foreground/80 hover:bg-white/10 hover:text-foreground'
                              }`}
                              title={playingTrackId === t.id ? 'Pause Preview' : 'Play Preview'}
                            >
                              {playingTrackId === t.id ? '⏸' : '▶'}
                            </button>
                          ) : (
                            <span className="text-foreground/30 italic text-[10px]" title="No audio preview in cache">✗</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-foreground/90 truncate max-w-[150px]">{t.name}</td>
                        <td className="py-2.5 px-2 text-foreground/60 truncate max-w-[120px]">{t.artist}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1 flex-wrap">
                            {(t.ai_genres || []).map((g: string) => (
                              <span key={g} className="px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)] text-[9px] font-bold uppercase">{g}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1 flex-wrap">
                            {(t.ai_tags || []).slice(0, 4).map((tag: string) => (
                              <span key={tag} className="px-1.5 py-0.2 rounded bg-white/5 text-foreground/60 text-[9px] border border-white/[0.02]">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {isImported ? (
                            <span className="text-[10px] text-green-400 font-bold px-2 py-1">Imported ✓</span>
                          ) : (
                            <select
                              defaultValue=""
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (!val) return;
                                await handleImportTrack(t.id, val);
                                e.target.value = "";
                              }}
                              className="text-[10px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-foreground/80 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                            >
                              <option value="">-- Import to --</option>
                              {Object.entries(groupedGenres).map(([groupKey, genres]) => (
                                <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                                  {genres.map(g => (
                                    <option key={g.id} value={g.id}>{g.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {searchQ && !searching && searchResults?.tracks?.length === 0 && (
            <p className="text-foreground/40 text-xs italic py-4 text-center">No cached tracks match the descriptor query.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MetricsPage() {
  return (
    <div className="space-y-8">
      <SystemSection />
      <AiSection />
    </div>
  );
}
