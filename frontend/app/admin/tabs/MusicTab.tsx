'use client';

import { useState, useEffect } from 'react';
import { getSongCache } from '@/lib/api';

export function MusicTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSongCache()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-foreground/40 text-xs">Loading local cache stats...</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const totalPlays = data?.plays ?? 0;
  const genreList = data?.genres ?? [];
  const genreCount = data?.genreCount ?? 0;
  const played = data?.played ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-[var(--primary)]">{total.toLocaleString()}</p>
          <p className="text-foreground/40 text-[10px] uppercase tracking-wider font-semibold mt-1">Cached Tracks</p>
        </div>
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-[var(--accent)]">{totalPlays.toLocaleString()}</p>
          <p className="text-foreground/40 text-[10px] uppercase tracking-wider font-semibold mt-1">Total Hits</p>
        </div>
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-purple-400">{genreCount}</p>
          <p className="text-foreground/40 text-[10px] uppercase tracking-wider font-semibold mt-1">Classified Genres</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Played cached songs */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg flex flex-col">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground">Top Played Cache</h3>
            <span className="text-[10px] font-mono text-foreground/40">{played.length} unique songs</span>
          </div>
          <div className="overflow-y-auto max-h-[500px] flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr className="text-foreground/40 border-b border-white/5 text-xs">
                  <th className="text-left py-3 px-6 w-12">#</th>
                  <th className="text-left py-3 px-2">Track & Artist</th>
                  <th className="text-left py-3 px-2 hidden sm:table-cell">Genres</th>
                  <th className="text-center py-3 px-2 w-16">Plays</th>
                  <th className="text-right py-3 px-6">Last Played</th>
                </tr>
              </thead>
              <tbody>
                {played.map((s: any, i: number) => (
                  <tr key={s.id} className="border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors">
                    <td className="py-2.5 px-6 text-foreground/30 font-semibold tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <p className="font-medium text-foreground/90 truncate max-w-[220px]">{s.name}</p>
                      <p className="text-[10px] text-foreground/40 truncate max-w-[220px]">{s.artist}</p>
                    </td>
                    <td className="py-2.5 px-2 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-white/5 text-foreground/60 font-medium border border-white/[0.01]">
                        {s.genres && s.genres.length > 0 ? s.genres.join(', ') : s.genre || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-[var(--primary)] tabular-nums">{s.play_count}</td>
                    <td className="py-2.5 px-6 text-right text-xs text-foreground/40">
                      {s.last_played ? new Date(s.last_played).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {played.length === 0 && <p className="text-foreground/30 text-center py-12 text-sm italic">No songs have been played yet.</p>}
          </div>
        </div>

        {/* Cached genres */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col">
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-6 text-foreground">Volume by Genre</h3>
          <div className="space-y-4 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {genreList.map((g: any) => {
              const pct = total > 0 ? (g.count / total) * 100 : 0;
              return (
                <div key={g.genre} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground/60 truncate w-36">
                      {g.genre.charAt(0).toUpperCase() + g.genre.slice(1).replace(/-/g, ' ')}
                    </span>
                    <span className="text-foreground/80 tabular-nums">{g.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
