'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCuratedStats,
  getCuratedByGenre,
  fetchGenres,
  verifyCuratedSong,
  updateCuratedSongGenre,
  deleteCuratedSong,
  getCuratedDiscovery,
  importToCurated
} from '@/lib/api';
import { useAdminAudio } from '../hooks/useAdminAudio';
import { StatCard } from '../components/StatCard';

const GROUP_LABELS: Record<string, string> = {
  portuguese: 'Português',
  brazilian: 'Brasileiro',
  united_states: 'United States',
  united_kingdom: 'United Kingdom',
  french: 'Francês',
  spanish: 'Espanhol',
  global_other: 'Mundo & Outros',
};

export function CuratedTab() {
  const [stats, setStats] = useState<any>(null);
  const [byGenre, setByGenre] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreSongs, setGenreSongs] = useState<any[]>([]);
  const [allGenres, setAllGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryTracks, setDiscoveryTracks] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [updatingGenre, setUpdatingGenre] = useState<string | null>(null);
  const [songsSearch, setSongsSearch] = useState('');

  // Use the custom audio hook
  const { playingTrackId, togglePreview, AudioPlayerOverlay, stopPreview } = useAdminAudio();

  const [importGenre, setImportGenre] = useState<string>('');

  useEffect(() => {
    if (selectedGenre) {
      setImportGenre(selectedGenre);
    }
  }, [selectedGenre]);

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

  const loadStats = useCallback(async () => {
    try {
      const s = await getCuratedStats();
      setStats(s);
      setByGenre(s.byGenre || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    fetchGenres().then(setAllGenres).catch(() => {});
  }, [loadStats]);

  const loadGenreSongs = async (genre: string) => {
    if (selectedGenre === genre) {
      setSelectedGenre(null);
      stopPreview();
      return;
    }
    setSelectedGenre(genre);
    setSongsSearch('');
    setSongsLoading(true);
    const songs = await getCuratedByGenre(genre);
    setGenreSongs(songs);
    setSongsLoading(false);
  };

  const toggleVerify = async (songId: string, currentlyVerified: boolean) => {
    await verifyCuratedSong(songId, !currentlyVerified);
    setGenreSongs(prev => prev.map(s => (s.id === songId ? { ...s, verified: !currentlyVerified } : s)));
    loadStats();
  };

  const changeGenre = async (songId: string, newGenre: string) => {
    setUpdatingGenre(songId);
    await updateCuratedSongGenre(songId, newGenre);
    setGenreSongs(prev => prev.map(s => (s.id === songId ? { ...s, genre: newGenre } : s)));
    setUpdatingGenre(null);
    loadStats();
  };

  const handleDeleteSong = async (songId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the curated list?`)) return;
    try {
      await deleteCuratedSong(songId);
      setGenreSongs(prev => prev.filter(s => s.id !== songId));
      if (playingTrackId === songId) {
        stopPreview();
      }
      loadStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete song');
    }
  };

  const loadDiscovery = async (genre?: string) => {
    setDiscoveryLoading(true);
    const tracks = await getCuratedDiscovery(genre);
    setDiscoveryTracks(tracks);
    setDiscoveryLoading(false);
  };

  const handleImport = async (songIds: string[], destGenre?: string) => {
    setImporting(prev => new Set([...prev, ...songIds]));
    await importToCurated(songIds, destGenre);
    setImporting(prev => {
      const next = new Set(prev);
      songIds.forEach(id => next.delete(id));
      return next;
    });
    loadDiscovery(selectedGenre || undefined);
    loadStats();
    if (selectedGenre) {
      const songs = await getCuratedByGenre(selectedGenre);
      setGenreSongs(songs);
    } else if (destGenre) {
      // If we imported to a specific genre folder, auto-expand it for review
      loadGenreSongs(destGenre);
    }
  };

  const filteredGenreSongs = useMemo(() => {
    if (!songsSearch.trim()) return genreSongs;
    const q = songsSearch.toLowerCase();
    return genreSongs.filter(
      s => s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
  }, [genreSongs, songsSearch]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-zinc-500 text-xs">Querying curated list...</p>
      </div>
    );
  }

  const verifiedPct = stats?.total ? ((stats.verified / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Dynamic hidden audio tag and overlay player from hook */}
      {AudioPlayerOverlay}

      {/* Curated status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Curated" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="✨" />
        <StatCard value={stats?.verified ?? '-'} label={`Verified (${verifiedPct}%)`} color="#10b981" glowColor="rgba(16,185,129,0.15)" icon="✓" />
        <StatCard value={stats?.unverified ?? '-'} label="Unverified" color="#f59e0b" glowColor="rgba(245,158,11,0.15)" icon="⌛" />
        <StatCard value={stats?.total_plays ?? '-'} label="Total Plays" color="var(--accent)" glowColor="rgba(0,206,201,0.15)" icon="🎵" />
        <StatCard value={stats?.genres ?? '-'} label="Genres" color="#8b5cf6" glowColor="rgba(139,92,246,0.15)" icon="📁" />
      </div>

      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Curated Songs by Genre</h3>
          <button
            onClick={() => {
              setShowDiscovery(!showDiscovery);
              if (!showDiscovery) loadDiscovery();
            }}
            className="text-xs px-3.5 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/25 transition-all font-semibold"
          >
            {showDiscovery ? 'Close Discovery Panel' : '🔍 Discovery Import Mode'}
          </button>
        </div>

        {/* Discovery Box */}
        {showDiscovery && (
          <div className="mb-6 bg-white/[0.01] rounded-2xl p-4 border border-white/5 animate-slide-up">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Discovery Queue</h4>
                <p className="text-xs text-zinc-500 mt-1">Import songs fetched from Deezer editorial/charts into the curated database.</p>
              </div>

              {/* Grouped Genre Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400 whitespace-nowrap font-medium">Import to Genre:</label>
                <select
                  value={importGenre}
                  onChange={e => setImportGenre(e.target.value)}
                  className="bg-surface border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="">-- Active Folder / Auto --</option>
                  {Object.entries(groupedGenres).map(([groupKey, genres]) => (
                    <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                      {genres.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {discoveryLoading ? (
              <p className="text-zinc-500 text-xs py-4">Scanning cache candidates...</p>
            ) : discoveryTracks.length === 0 ? (
              <p className="text-zinc-600 text-xs py-4 text-center">No outstanding cache candidates found. Try running some Live API tests first.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-white/5 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface/80 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                    <tr>
                      <th className="text-left py-2 px-4 w-24">
                        <button
                          onClick={() => handleImport(discoveryTracks.map(t => t.id), importGenre || undefined)}
                          className="text-[10px] text-[var(--accent)] hover:text-white transition-colors"
                          title="Import all displayed"
                        >
                          Import All
                        </button>
                      </th>
                      <th className="text-left py-2 px-2">Track</th>
                      <th className="text-left py-2 px-2">Artist</th>
                      <th className="text-left py-2 px-2 hidden sm:table-cell">Genre (Cache)</th>
                      <th className="text-right py-2 px-4">Deezer Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discoveryTracks.map((t: any) => (
                      <tr key={t.id} className="border-b border-white/[0.01] hover:bg-white/[0.01]">
                        <td className="py-2 px-4">
                          <button
                            onClick={() => handleImport([t.id], importGenre || undefined)}
                            disabled={importing.has(t.id)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/35 transition-all disabled:opacity-30"
                          >
                            {importing.has(t.id) ? '...' : 'Import'}
                          </button>
                        </td>
                        <td className="py-2 px-2 font-medium text-zinc-200 truncate max-w-[180px]">{t.name}</td>
                        <td className="py-2 px-2 text-zinc-400 truncate max-w-[140px]">{t.artist}</td>
                        <td className="py-2 px-2 hidden sm:table-cell text-zinc-500">{t.genre || t.genres?.[0] || '-'}</td>
                        <td className="py-2 px-4 text-right tabular-nums text-zinc-500 font-mono">#{t.rank?.toLocaleString() || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Curated list */}
        {byGenre.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center italic">No curated songs. Use the discovery mode to import some!</p>
        ) : (
          <div className="space-y-2">
            {byGenre.map((g: any) => (
              <div key={g.genre} className="border border-white/5 rounded-xl overflow-hidden bg-black/10">
                <button
                  onClick={() => loadGenreSongs(g.genre)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-white w-40 truncate">{g.genre.replace(/-/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${(g.total / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-12 text-right">{g.total}</span>
                  <span className="text-[10px] text-zinc-500 w-24 text-right font-medium">
                    {g.verified} / {g.total} verified
                  </span>
                  <span className="text-[10px] text-zinc-500 w-16 text-right tabular-nums">{g.total_plays} plays</span>
                  <svg
                    className={`w-3 h-3 text-zinc-500 transition-transform ${selectedGenre === g.genre ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {selectedGenre === g.genre && (
                  <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                    {/* Search filter input */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 text-xs">🔍</span>
                      <input
                        value={songsSearch}
                        onChange={e => setSongsSearch(e.target.value)}
                        placeholder={`Search within ${g.genre.replace(/-/g, ' ')}...`}
                        className="w-full pl-8 pr-3 py-1.5 bg-black/30 border border-white/5 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-all text-xs"
                      />
                    </div>

                    {songsLoading ? (
                      <p className="text-zinc-500 text-xs py-2">Loading...</p>
                    ) : filteredGenreSongs.length === 0 ? (
                      <p className="text-zinc-600 text-xs py-2 italic text-center">No curated tracks found.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-white/5 rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                            <tr>
                              <th className="text-left py-2 px-4 w-12 text-center">Preview</th>
                              <th className="text-left py-2 px-2">Track</th>
                              <th className="text-left py-2 px-2">Artist</th>
                              <th className="text-left py-2 px-2">Genre Override</th>
                              <th className="text-right py-2 px-2 w-16 hidden sm:table-cell">Plays</th>
                              <th className="text-center py-2 px-2 w-24">Verification</th>
                              <th className="text-right py-2 px-4 w-16">Remove</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGenreSongs.map((s: any) => {
                              const hasAudio = !!s.preview_url || s.has_preview;
                              return (
                                <tr key={s.id} className="border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors">
                                  <td className="py-2 px-4 text-center">
                                    {hasAudio && s.preview_url ? (
                                      <button
                                        onClick={() => togglePreview(s.id, s.preview_url)}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                          playingTrackId === s.id
                                            ? 'bg-[var(--accent)] text-black shadow-lg scale-105'
                                            : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                                        }`}
                                        title={playingTrackId === s.id ? 'Pause Preview' : 'Play Preview'}
                                      >
                                        {playingTrackId === s.id ? '⏸' : '▶'}
                                      </button>
                                    ) : (
                                      <span className="text-zinc-600 italic text-[10px]" title="No audio preview in cache">✗</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 font-semibold text-zinc-200 truncate max-w-[180px]">{s.name}</td>
                                  <td className="py-2 px-2 text-zinc-400 truncate max-w-[140px]">{s.artist}</td>
                                  <td className="py-2 px-2">
                                    <select
                                      value={s.genre}
                                      onChange={e => changeGenre(s.id, e.target.value)}
                                      disabled={updatingGenre === s.id}
                                      className="text-[10px] bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none focus:border-[var(--primary)]"
                                    >
                                      {Object.entries(groupedGenres).map(([groupKey, genres]) => (
                                        <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                                          {genres.map(g => (
                                            <option key={g.id} value={g.id}>{g.label}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 px-2 text-right font-bold tabular-nums text-zinc-400 hidden sm:table-cell">{s.played_count}</td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      onClick={() => toggleVerify(s.id, s.verified)}
                                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                        s.verified
                                          ? 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/35'
                                          : 'bg-zinc-500/10 text-zinc-400 border-white/5 hover:bg-zinc-500/20'
                                      }`}
                                    >
                                      {s.verified ? 'Verified' : 'Verify'}
                                    </button>
                                  </td>
                                  <td className="py-2 px-4 text-right">
                                    <button
                                      onClick={() => handleDeleteSong(s.id, s.name)}
                                      className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center mx-auto"
                                      title="Remove from Curation"
                                    >
                                      🗑
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
