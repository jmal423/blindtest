'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/leaderboard?limit=5`)
      .then(r => r.json())
      .then(setLeaderboard)
      .catch(() => {});
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center max-w-md">
        <h2 className="text-4xl font-bold mb-4">
          Guess the <span className="text-[var(--primary)]">Song</span>
        </h2>
        <p className="text-zinc-400 text-lg">
          Listen to music clips, guess the song, and compete with your friends!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/create"
          className="flex-1 px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-center font-semibold rounded-xl transition-colors"
        >
          Create Room
        </Link>
        <Link
          href="/join"
          className="flex-1 px-8 py-4 bg-[var(--surface)] hover:bg-[var(--surface-light)] text-white text-center font-semibold rounded-xl border border-white/10 transition-colors"
        >
          Join Room
        </Link>
      </div>

      {leaderboard.length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="text-lg font-semibold mb-3 text-center">Leaderboard</h3>
          <div className="bg-[var(--surface)] border border-white/10 rounded-xl overflow-hidden">
            {leaderboard.map((entry: any, i: number) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <span className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                  {i + 1}
                </span>
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                  {entry.avatar_url ? (
                    <img src={`https://cdn.discordapp.com/avatars/${entry.id}/${entry.avatar_url}.png`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    entry.username[0].toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-sm truncate">{entry.username}</span>
                <span className="text-sm font-semibold text-[var(--primary)]">{entry.total_score}</span>
              </div>
            ))}
          </div>
          <Link href="/leaderboard" className="block text-center text-sm text-zinc-500 hover:text-zinc-300 mt-2 transition-colors">
            View Full Leaderboard
          </Link>
        </div>
      )}

      <div className="flex gap-4 text-sm">
        <Link href="/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          Account
        </Link>
        <Link href="/leaderboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
