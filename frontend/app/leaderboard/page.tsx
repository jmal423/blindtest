'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, getUserStats, getFriends } from '@/lib/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/app/context/AuthContext';

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
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);

  useEffect(() => {
    getLeaderboard()
      .then(d => {
        setEntries(d);
        // Automatically select the first player on load if entries exist
        if (d && d.length > 0) {
          setSelectedId(d[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      getFriends()
        .then(data => {
          if (data && data.friends) {
            setFriendIds(data.friends.map(f => f.id));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedStats(null);
      return;
    }
    setStatsLoading(true);
    getUserStats(selectedId)
      .then(setSelectedStats)
      .catch(() => setSelectedStats(null))
      .finally(() => setStatsLoading(false));
  }, [selectedId]);

  const displayedEntries = showFriendsOnly
    ? entries.filter(e => e.id === user?.id || friendIds.includes(e.id))
    : entries;

  // Make sure a valid entry is selected in the current view
  useEffect(() => {
    if (displayedEntries.length > 0) {
      const exists = displayedEntries.some(e => e.id === selectedId);
      if (!exists) {
        setSelectedId(displayedEntries[0].id);
      }
    } else {
      if (selectedId !== null) {
        setSelectedId(null);
      }
    }
  }, [showFriendsOnly, friendIds, entries, selectedId, displayedEntries]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black/10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 text-sm font-medium animate-pulse">Loading Leaderboard...</p>
        </div>
      </div>
    );
  }

  const selectedEntry = displayedEntries.find(e => e.id === selectedId);

  // Setup Podium positions (order left-to-right: 2nd, 1st, 3rd)
  const podiumItems = [];
  if (displayedEntries.length > 1) {
    podiumItems.push({
      entry: displayedEntries[1],
      rank: 2,
      label: '2nd',
      color: 'text-zinc-300',
      ringColor: 'ring-zinc-400/40 shadow-zinc-400/10',
      bg: 'from-zinc-500/20 to-zinc-950/40 border-zinc-500/20',
      height: 'h-32 md:h-36',
      badge: '🥈',
      delay: 0.1,
    });
  }
  if (displayedEntries.length > 0) {
    podiumItems.push({
      entry: displayedEntries[0],
      rank: 1,
      label: '1st',
      color: 'text-yellow-400',
      ringColor: 'ring-yellow-400/50 shadow-yellow-400/20',
      bg: 'from-yellow-500/25 to-zinc-950/40 border-yellow-500/30',
      height: 'h-40 md:h-44',
      badge: '👑',
      isGold: true,
      delay: 0,
    });
  }
  if (displayedEntries.length > 2) {
    podiumItems.push({
      entry: displayedEntries[2],
      rank: 3,
      label: '3rd',
      color: 'text-amber-600',
      ringColor: 'ring-amber-700/40 shadow-amber-700/10',
      bg: 'from-amber-600/20 to-zinc-950/40 border-amber-600/20',
      height: 'h-24 md:h-28',
      badge: '🥉',
      delay: 0.2,
    });
  }

  const listEntries = displayedEntries.slice(3);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full gap-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-zinc-100 tracking-tight">
            LEADERBOARD
          </h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">
            {showFriendsOnly ? 'Top Friends Overall' : 'Top Players Overall'}
          </p>
        </div>

        {user && (
          <div className="flex justify-center">
            <div className="inline-flex p-1 bg-white/[0.02] border border-white/5 rounded-xl backdrop-blur-md shadow-inner">
              <button
                onClick={() => setShowFriendsOnly(false)}
                className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 cursor-pointer ${
                  !showFriendsOnly
                    ? 'bg-[var(--primary)] text-white shadow shadow-[var(--primary)]/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Global Standings
              </button>
              <button
                onClick={() => setShowFriendsOnly(true)}
                className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 cursor-pointer ${
                  showFriendsOnly
                    ? 'bg-[var(--primary)] text-white shadow shadow-[var(--primary)]/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Friends Only
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left Section: Podium and Remaining Lists */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Top 3 Podium Visuals */}
          {displayedEntries.length > 0 ? (
            <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
              {/* Decorative glows */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[var(--primary)]/10 blur-[60px] rounded-full pointer-events-none" />
              
              <div className="flex items-end justify-center gap-3 md:gap-6 mt-12 mb-2">
                {podiumItems.map(item => {
                  const entry = item.entry;
                  const isSelected = selectedId === entry.id;
                  
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: item.delay, type: 'spring', stiffness: 100, damping: 15 }}
                      onClick={() => setSelectedId(isSelected ? null : entry.id)}
                      className="flex flex-col items-center flex-1 max-w-[130px] cursor-pointer group"
                    >
                      {/* Avatar container with special crown / ring badges */}
                      <div className="relative mb-3">
                        {item.isGold && (
                          <motion.span 
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                          >
                            👑
                          </motion.span>
                        )}
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold overflow-hidden ring-4 ${item.ringColor} transition-transform group-hover:scale-105 duration-200 relative`}>
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            (entry.username || entry.player_name || '?')[0].toUpperCase()
                          )}
                        </div>
                        <span className="absolute -bottom-1 -right-1 bg-zinc-950 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white/10 shadow shadow-black">
                          {item.badge}
                        </span>
                      </div>

                      {/* Info & Score preview */}
                      <span className="font-bold text-xs md:text-sm text-zinc-200 truncate w-full text-center group-hover:text-white transition-colors">
                        {entry.username || entry.player_name || 'Unknown'}
                      </span>
                      <span className="font-extrabold text-[var(--accent)] text-sm md:text-base tabular-nums mb-2">
                        {entry.total_score.toLocaleString()}
                      </span>

                      {/* Podium Step Block */}
                      <div className={`w-full ${item.height} rounded-t-2xl bg-gradient-to-t ${item.bg} border-t border-x flex flex-col items-center justify-end pb-4 shadow-2xl relative transition-all duration-300 ${
                        isSelected ? 'brightness-125 border-white/30' : 'group-hover:border-white/20'
                      }`}>
                        <span className={`text-4xl md:text-5xl font-black ${item.color} opacity-45 select-none tracking-tighter`}>
                          {item.rank}
                        </span>
                        <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${item.color} opacity-50`}>
                          {item.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-12 text-center shadow-xl">
              <p className="text-zinc-500 font-medium text-sm">
                {showFriendsOnly
                  ? "No friends on the leaderboard yet. Invite some friends to play!"
                  : "No scores yet. Play a game to get on the board!"}
              </p>
            </div>
          )}

          {/* Ranks 4+ List */}
          {listEntries.length > 0 && (
            <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-4 shadow-xl flex-1 flex flex-col space-y-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Runner Ups</h3>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {listEntries.map((e, idx) => {
                  const rank = idx + 4;
                  const isSelected = selectedId === e.id;
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => setSelectedId(isSelected ? null : e.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 border ${
                        isSelected
                          ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-lg shadow-[var(--primary)]/5'
                          : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-white/10'
                      }`}
                    >
                      <span className="w-6 text-center text-xs font-extrabold text-zinc-500 tabular-nums">
                        #{rank}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border border-white/10">
                        {e.avatar_url ? (
                          <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          (e.username || e.player_name || '?')[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-zinc-200 truncate">{e.username || e.player_name || 'Unknown'}</p>
                        <p className="text-[10px] text-zinc-500 font-semibold">{e.games_played} games · {e.wins || 0} wins</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-black text-[var(--accent)] tabular-nums">{e.total_score.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">pts</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Selected User Stats Panel */}
        <AnimatePresence mode="wait">
          {selectedEntry && (
            <motion.div
              key={selectedEntry.id}
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full lg:w-80 shrink-0 bg-zinc-950/60 backdrop-blur-xl rounded-3xl border border-white/10 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[420px]"
            >
              {/* Highlight backdrop glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 blur-[40px] rounded-full pointer-events-none" />

              <div className="space-y-6">
                {/* Header User profile info */}
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-black overflow-hidden border-2 border-[var(--primary)] shadow-md shadow-[var(--primary)]/20">
                      {selectedEntry.avatar_url ? (
                        <img src={selectedEntry.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        (selectedEntry.username || selectedEntry.player_name || '?')[0].toUpperCase()
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 bg-[var(--primary)] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md text-white border border-black">
                      #{entries.findIndex(e => e.id === selectedId) + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-base text-zinc-100 truncate">{selectedEntry.username || selectedEntry.player_name || 'Unknown'}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Player Statistics</p>
                  </div>
                </div>

                {/* Stats Grid */}
                {statsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-zinc-500 font-medium">Fetching details...</p>
                  </div>
                ) : selectedStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10">
                      <p className="text-lg font-black text-[var(--accent)] tabular-nums">{selectedStats.totalPoints ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Total Points</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10">
                      <p className="text-lg font-black text-[var(--primary)] tabular-nums">{selectedStats.gamesPlayed ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Games Played</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10">
                      <p className="text-lg font-black text-white tabular-nums">{selectedStats.bestScore ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Best Score</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10">
                      <p className="text-lg font-black text-white tabular-nums">{selectedStats.perfects ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Perfect Rounds</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10">
                      <p className="text-lg font-black text-white tabular-nums">{selectedStats.totalRounds ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Rounds Played</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center transition-all hover:bg-white/[0.04] hover:border-white/10 overflow-hidden">
                      <p className="text-xs font-black text-white capitalize truncate mt-0.5">{selectedStats.bestGenre ?? '-'}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Best Genre</p>
                    </div>
                    {selectedStats.averageSpeedMs != null && (
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 text-center col-span-2 transition-all hover:bg-white/[0.04] hover:border-white/10">
                        <p className="text-xl font-black text-[var(--primary)]">{(selectedStats.averageSpeedMs / 1000).toFixed(2)}s</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Average Answer Speed</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-12">No detailed stats available</p>
                )}
              </div>

              <button
                onClick={() => setSelectedId(null)}
                className="mt-6 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Close Details
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 text-center transition-colors font-semibold uppercase tracking-wider mt-4">
        Back Home
      </Link>
    </div>
  );
}