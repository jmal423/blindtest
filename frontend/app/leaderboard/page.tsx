'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, getUserStats } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'motion/react';

interface LeaderboardEntry {
  id: string;
  username: string;
  player_name: string;
  avatar_url: string;
  total_score: number;
  games_played: number;
  avg_score: number;
  best_score: number;
  wins: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    getLeaderboard().then(d => setEntries(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) { setSelectedStats(null); return; }
    setStatsLoading(true);
    getUserStats(selectedId).then(setSelectedStats).catch(() => setSelectedStats(null)).finally(() => setStatsLoading(false));
  }, [selectedId]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;

  const selectedEntry = entries.find(e => e.id === selectedId);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full gap-6">
      <h1 className="text-2xl font-bold text-center">Leaderboard</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-2">
          {entries.map((e, i) => {
            const eid = e.id;
            return (
              <motion.div
                key={eid}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedId(selectedId === eid ? null : eid)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:brightness-110 ${
                  selectedId === eid ? 'ring-2 ring-[var(--primary)]' : ''
                } ${
                  i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : i === 1 ? 'bg-zinc-400/5 border border-zinc-400/10'
                  : i === 2 ? 'bg-amber-600/10 border border-amber-600/20'
                  : 'bg-[var(--surface)]'
                }`}
              >
                <span className={`w-7 text-center text-sm font-bold ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <div className="w-9 h-9 rounded-full bg-[var(--surface-light)] flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                  {e.avatar_url ? (
                    <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (e.username || e.player_name || '?')[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{e.username || e.player_name || 'Unknown'}</p>
                  <p className="text-[10px] text-zinc-500">{e.games_played} games · {e.wins || 0} wins</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-[var(--accent)]">{e.total_score}</p>
                  <p className="text-[10px] text-zinc-500">pts</p>
                </div>
              </motion.div>
            );
          })}
          {entries.length === 0 && (
            <p className="text-zinc-500 text-center py-8">No scores yet. Play a game to get on the board!</p>
          )}
        </div>

        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full md:w-72 shrink-0 bg-[var(--surface)] rounded-2xl border border-white/10 p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-light)] flex items-center justify-center text-lg font-bold overflow-hidden">
                {selectedEntry.avatar_url ? (
                  <img src={selectedEntry.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (selectedEntry.username || selectedEntry.player_name || '?')[0].toUpperCase()
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{selectedEntry.username || selectedEntry.player_name || 'Unknown'}</p>
                <p className="text-xs text-zinc-500">#{entries.findIndex(e => e.id === selectedId) + 1} on leaderboard</p>
              </div>
            </div>

            {statsLoading ? (
              <p className="text-sm text-zinc-500 text-center py-4">Loading stats...</p>
            ) : selectedStats ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[var(--accent)]">{selectedStats.totalPoints ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Total Points</p>
                </div>
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[var(--primary)]">{selectedStats.gamesPlayed ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Games Played</p>
                </div>
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{selectedStats.bestScore ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Best Score</p>
                </div>
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{selectedStats.perfects ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Perfect Rounds</p>
                </div>
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{selectedStats.totalRounds ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Rounds Played</p>
                </div>
                <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white capitalize">{selectedStats.bestGenre ?? '-'}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Best Genre</p>
                </div>
                {selectedStats.averageSpeedMs != null && (
                  <div className="bg-[var(--surface-light)] rounded-xl p-3 text-center col-span-2">
                    <p className="text-xl font-bold text-[var(--primary)]">{(selectedStats.averageSpeedMs / 1000).toFixed(1)}s</p>
                    <p className="text-[10px] text-zinc-500 uppercase">Average Answer Speed</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">No stats available</p>
            )}
          </motion.div>
        )}
      </div>

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors">
        Back Home
      </Link>
    </div>
  );
}