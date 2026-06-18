'use client';

import { useState, useEffect } from 'react';
import { getSongCache } from '@/lib/api';

export default function LibraryPage() {
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
  const genreCount = data?.genres?.length ?? 0;
  const played = data?.played ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>{total}</p>
          <p className="text-xs text-foreground/40 font-medium mt-1 uppercase tracking-wider">Total Cached Songs</p>
        </div>
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{genreCount}</p>
          <p className="text-xs text-foreground/40 font-medium mt-1 uppercase tracking-wider">Genres Represented</p>
        </div>
        <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <p className="text-3xl font-bold" style={{ color: '#a29bfe' }}>{totalPlays}</p>
          <p className="text-xs text-foreground/40 font-medium mt-1 uppercase tracking-wider">Total Plays</p>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
        <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--foreground)' }}>Genre Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {genreList.map((g: any) => (
            <div key={g.genre} className="p-3 rounded-xl text-center transition-all hover:scale-[1.02]" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <p className="text-xs font-bold truncate" title={g.genre}>{g.genre}</p>
              <p className="text-[10px] text-foreground/40 mt-0.5">{g.count} track{g.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {played.length > 0 && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--foreground)' }}>Most Played</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-foreground/40 border-b border-white/5 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 pr-4">Song</th>
                  <th className="text-left py-3 pr-4">Artist</th>
                  <th className="text-left py-3 pr-4">Genre</th>
                  <th className="text-right py-3">Plays</th>
                </tr>
              </thead>
              <tbody>
                {played.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/[0.02]">
                    <td className="py-2.5 pr-4 font-semibold text-foreground/90 truncate max-w-[200px]">{p.name}</td>
                    <td className="py-2.5 pr-4 text-foreground/60 truncate max-w-[150px]">{p.artist_name}</td>
                    <td className="py-2.5 pr-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
                        {Array.isArray(p.deezer_genres) ? (p.deezer_genres[0] || '-') : p.deezer_genres || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{p.play_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
