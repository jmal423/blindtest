'use client';

import { useState, useEffect } from 'react';
import {
  fetchGenres,
  getDbStatus,
  testDeezer,
  testDeezerGenre,
  testGenre
} from '@/lib/api';
import { useAdminAudio } from '../../hooks/useAdminAudio';

const API_SOURCES = [
  { id: 'deezer', label: 'Deezer Core API', desc: 'Queries official charts and searches.' },
];

export default function ApiTesterPage() {
  const [deezerResult, setDeezerResult] = useState<any>(null);
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);

  const [genreList, setGenreList] = useState<{ id: string; label: string }[]>([]);
  const [genre, setGenre] = useState('pop');
  const [count, setCount] = useState(30);
  const [source, setSource] = useState('deezer');
  const [results, setResults] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [error, setError] = useState('');

  // Use custom audio hook
  const { playingTrackId, togglePreview, AudioPlayerOverlay, stopPreview } = useAdminAudio();

  useEffect(() => {
    fetchGenres().then(setGenreList).catch(() => {});
    getDbStatus().then(setDbStatus).catch(() => {});
  }, []);

  const runConnectivity = () => {
    setDeezerLoading(true);
    testDeezer()
      .then(setDeezerResult)
      .catch(() => setDeezerResult({ error: 'Connectivity failed' }))
      .finally(() => setDeezerLoading(false));
  };

  const runTester = async () => {
    setTesterLoading(true);
    setError('');
    setResults(null);
    stopPreview();
    try {
      const res = source === 'deezer' ? await testDeezerGenre(genre, count) : await testGenre(genre, count);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Live query failed');
    }
    setTesterLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Dynamic hidden audio tag and overlay player from hook */}
      {AudioPlayerOverlay}

      {/* Connectivity cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-foreground mb-4">Deezer Live Endpoints</h3>
            {deezerResult ? (
              <div className="space-y-2 text-xs font-mono">
                {deezerResult.error ? (
                  <p className="text-red-400">{deezerResult.error}</p>
                ) : (
                  (deezerResult.tests || []).map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/[0.01] pb-1.5">
                      <span className="text-foreground/40">{t.label || t.endpoint}</span>
                      <span className={t.ok ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {t.ok ? `${t.ms || t.latencyMs}ms ✓` : 'Offline ✗'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-foreground/40 text-xs italic">No latency metrics recorded.</p>
            )}
          </div>
          <button
            onClick={runConnectivity}
            disabled={deezerLoading}
            className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 text-foreground font-semibold text-xs rounded-xl border border-white/10 transition-colors disabled:opacity-50"
          >
            {deezerLoading ? 'Pinging endpoints...' : 'Ping Deezer API'}
          </button>
        </div>

        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-foreground mb-4">Internal postgresql</h3>
            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40">Database Driver</span>
                    <span>Postgres Client Pool</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40">Status</span>
                    <span className="text-green-400 font-bold">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40">User records</span>
                    <span className="text-foreground/80 font-bold">{dbStatus.tables?.users ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/40">Classifications</span>
                    <span className="text-foreground/80 font-bold">{dbStatus.tables?.classifications ?? 0}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-400 font-mono">{dbStatus.error || 'Failed'}</p>
              )
            ) : (
              <p className="text-foreground/40 text-xs italic">Checking database status...</p>
            )}
          </div>
          <div className="text-xs text-foreground/40 pt-3 border-t border-white/5">
            Active connection pool size: 10
          </div>
        </div>
      </div>

      {/* Genre Tester and Audio Player */}
      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
        <div className="mb-4">
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground">Live Genre API Tester</h3>
          <p className="text-xs text-foreground/40 mt-1">Directly query Deezer music catalog for specific genres, list ranks, and verify audio clips.</p>
        </div>

        <div className="flex flex-wrap items-end gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl mb-6">
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] text-foreground/40 uppercase font-bold tracking-wider block mb-1.5">Query Source</label>
            <div className="flex gap-1">
              {API_SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSource(s.id);
                    setResults(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                    source === s.id
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg'
                      : 'bg-white/5 border-white/5 text-foreground/60 hover:text-foreground'
                  }`}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-foreground/40 uppercase font-bold tracking-wider block mb-1.5">Genre</label>
            <select
              value={genre}
              onChange={e => {
                setGenre(e.target.value);
                setResults(null);
              }}
              className="bg-surface border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--primary)]"
            >
              {genreList.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-foreground/40 uppercase font-bold tracking-wider block mb-1.5">Quantity</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={100}
                value={count}
                onChange={e => {
                  setCount(Number(e.target.value));
                  setResults(null);
                }}
                className="w-24 accent-[var(--primary)] h-1.5 cursor-pointer"
              />
              <span className="text-xs text-foreground/60 font-bold font-mono w-6 tabular-nums">{count}</span>
            </div>
          </div>

          <button
            onClick={runTester}
            disabled={testerLoading}
            className="px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary)]/10"
          >
            {testerLoading ? 'Fetching Live API...' : 'Fetch Catalog'}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs py-3">{error}</p>}

        {/* Results grid */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs font-semibold text-foreground/40 border-b border-white/5 pb-2">
              <span>Found: {results.count ?? results.tracks?.length} tracks</span>
              {results.previewCount != null && <span className="text-green-400">{results.previewCount} with audio previews</span>}
              {results.latencyMs != null && <span className="text-foreground/30">Response time: {results.latencyMs}ms</span>}
            </div>

            <div className="overflow-y-auto max-h-96 border border-white/5 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-foreground/40 border-b border-white/5">
                  <tr>
                    <th className="text-right py-3 px-4 w-16">Rank</th>
                    <th className="text-left py-3 px-2">Track Title</th>
                    <th className="text-left py-3 px-2 hidden sm:table-cell">Artist</th>
                    <th className="text-center py-3 px-4 w-24">Live Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {(results.tracks || []).map((t: any, i: number) => {
                    const hasAudio = !!t.previewUrl || !!t.preview;
                    const audioUrl = t.previewUrl || t.preview;
                    const trackId = t.id || `test-${i}`;
                    const isPlaying = playingTrackId === trackId;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors ${
                          t.rank >= 1000000 ? 'bg-purple-500/5' : t.rank >= 100000 ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-right font-mono text-foreground/40">
                          {t.rank > 0 ? `#${t.rank.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-foreground/90 truncate max-w-[200px]">{t.name || t.title}</td>
                        <td className="py-2.5 px-2 text-foreground/60 hidden sm:table-cell truncate max-w-[200px]">{t.artist}</td>
                        <td className="py-2.5 px-4 text-center">
                          {hasAudio && audioUrl ? (
                            <button
                              onClick={() => togglePreview(trackId, audioUrl)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                isPlaying
                                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/20 shadow-lg'
                                  : 'bg-white/5 border-white/5 text-foreground/80 hover:bg-white/10'
                              }`}
                            >
                              {isPlaying ? '⏸ Pause' : '▶ Play'}
                            </button>
                          ) : (
                            <span className="text-foreground/30 italic text-[10px]">No audio</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
