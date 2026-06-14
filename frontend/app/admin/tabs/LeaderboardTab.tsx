'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLeaderboard, wipeUserScores } from '@/lib/api';

export function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      setLeaderboard(await getLeaderboard());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleWipe = async (userId: string, username: string) => {
    if (
      !confirm(
        `Wipe all historic scores, game stats, and metrics for user "${username}"? This will delete all record of this player from leaderboard and logs. THIS CANNOT BE UNDONE.`
      )
    )
      return;
    try {
      await wipeUserScores(userId);
      loadLeaderboard();
    } catch {}
  };

  // Group top 3 and others
  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
  const restList = useMemo(() => leaderboard.slice(3), [leaderboard]);

  return (
    <div className="space-y-6">
      {/* Top 3 podium styling */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topThree.map((e, index) => {
            const colors = [
              { border: 'border-yellow-500/30 bg-yellow-500/5', icon: '🥇', label: 'Gold Champ' },
              { border: 'border-zinc-300/30 bg-zinc-300/5', icon: '🥈', label: 'Silver Runner' },
              { border: 'border-amber-600/30 bg-amber-600/5', icon: '🥉', label: 'Bronze Place' },
            ][index];
            return (
              <div
                key={e.id || e.player_id}
                className={`p-6 rounded-2xl border ${colors.border} flex flex-col items-center justify-between text-center relative overflow-hidden shadow-lg`}
              >
                <div className="absolute top-4 right-4 text-3xl">{colors.icon}</div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-surface-light border-2 border-white/10 overflow-hidden mb-3">
                    {e.avatar_url ? (
                      <img
                        src={e.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (e.username || e.player_name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <h4 className="font-bold text-foreground text-lg">{e.username || e.player_name || 'Unknown'}</h4>
                  <span className="text-[10px] text-foreground/40 uppercase tracking-widest font-semibold">
                    {colors.label}
                  </span>
                </div>

                <div className="mt-4 w-full bg-black/20 rounded-xl p-3 grid grid-cols-2 text-xs border border-white/[0.02] gap-2">
                  <div>
                    <span className="text-[9px] text-foreground/40 block">Games</span>
                    <span className="font-bold text-foreground/80">{e.games_played}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-foreground/40 block">Total Points</span>
                    <span className="font-bold text-[var(--accent)]">{e.total_score}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleWipe(e.id || e.player_id, e.username || e.player_name)}
                  className="mt-4 w-full px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 text-xs font-semibold rounded-xl transition-all"
                >
                  Wipe Score
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranks 4+ */}
      {restList.length > 0 && (
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">Remaining Ranks</h3>
            <span className="text-xs text-foreground/40">{restList.length} players</span>
          </div>
          <div className="space-y-1 p-2 max-h-[400px] overflow-y-auto">
            {restList.map((e, idx) => {
              const rank = idx + 4;
              return (
                <div
                  key={e.id || e.player_id}
                  className="flex items-center gap-3 px-4 py-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.02] rounded-xl transition-all"
                >
                  <span className="w-8 text-center text-xs font-semibold text-foreground/40">{rank}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-light flex items-center justify-center text-xs font-bold shrink-0 border border-white/10">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (e.username || e.player_name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground/90 truncate">
                      {e.username || e.player_name || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-foreground/40">{e.games_played} games played</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{e.total_score} pts</span>
                  <button
                    onClick={() => handleWipe(e.id || e.player_id, e.username || e.player_name)}
                    className="ml-4 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-lg text-xs font-medium transition-all"
                  >
                    Wipe
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-foreground/40 text-xs">Querying leaderboard...</p>
        </div>
      )}
      {!loading && leaderboard.length === 0 && (
        <p className="text-foreground/40 text-center py-16 text-sm">No historical scores in database yet.</p>
      )}
    </div>
  );
}
