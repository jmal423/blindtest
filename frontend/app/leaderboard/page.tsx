'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard } from '@/lib/api';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then(d => setEntries(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-2xl mx-auto w-full gap-6">
      <h1 className="text-2xl font-bold text-center">Leaderboard</h1>

      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={e.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
            i === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' :
            i === 1 ? 'bg-zinc-400/10 border border-zinc-400/20' :
            i === 2 ? 'bg-amber-600/20 border border-amber-600/30' :
            'bg-[var(--surface)]'
          }`}>
            <span className="text-2xl font-bold text-zinc-500 w-8 text-center">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
            </span>
            <div className="w-10 h-10 rounded-full bg-[var(--surface-light)] flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
              {e.avatar_url ? (
                <img src={`https://cdn.discordapp.com/avatars/${e.id}/${e.avatar_url}.png`} alt="" className="w-full h-full object-cover" />
              ) : (
                e.username[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{e.username}</p>
              <p className="text-xs text-zinc-500">{e.games_played} games</p>
            </div>
            <span className="text-lg font-bold text-[var(--accent)]">{e.total_score}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-zinc-500 text-center py-8">No scores yet. Play a game to get on the board!</p>
        )}
      </div>

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors">
        Back Home
      </Link>
    </div>
  );
}
