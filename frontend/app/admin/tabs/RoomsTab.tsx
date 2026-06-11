'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAdminRooms,
  adminStartRoom,
  adminKickPlayer,
  adminDestroyRoom
} from '@/lib/api';

export function RoomsTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [activeInspector, setActiveInspector] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getAdminRooms();
      setRooms(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRooms();
    const t = setInterval(loadRooms, 6000);
    return () => clearInterval(t);
  }, [loadRooms]);

  const filtered = showAll ? rooms : rooms.filter(r => r.state !== 'game_over');

  const handleStart = async (code: string) => {
    try {
      await adminStartRoom(code);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to start game');
    }
  };

  const handleKick = async (code: string, playerId: string, playerName: string) => {
    if (!confirm(`Kick player "${playerName}" from lobby "${code}"?`)) return;
    try {
      await adminKickPlayer(code, playerId);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to kick player');
    }
  };

  const handleDestroy = async (code: string) => {
    if (!confirm(`Shutdown room "${code}" immediately? This will force remove all players.`)) return;
    try {
      await adminDestroyRoom(code);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to shutdown room');
    }
  };

  const stateBadge = (s: string) => {
    const config: Record<string, { label: string; classes: string }> = {
      waiting: { label: 'Waiting', classes: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      round_preparing: { label: 'Preparing', classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      playing: { label: 'Playing', classes: 'bg-green-500/20 text-green-400 border border-green-500/30' },
      round_result: { label: 'Pause/Result', classes: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      game_over: { label: 'Finished', classes: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' },
    };
    const c = config[s] || { label: s, classes: 'bg-zinc-500/10 text-zinc-400' };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.classes}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAll(false);
              setLoading(true);
              loadRooms();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              !showAll
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/10'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => {
              setShowAll(true);
              setLoading(true);
              loadRooms();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              showAll
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/10'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            All Rooms
          </button>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Showing {filtered.length} of {rooms.length} rooms (Auto-refresh 6s)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(r => (
          <div
            key={r.code}
            className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between shadow-lg hover:border-white/10 transition-colors"
          >
            <div>
              {/* Room Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-black tracking-widest text-[var(--primary)]">{r.code}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono">Source: {r.settings?.audioSource || 'deezer'}</p>
                </div>
                {stateBadge(r.state)}
              </div>

              {/* Lobby settings */}
              <div className="grid grid-cols-3 gap-2 bg-white/[0.02] border border-white/5 p-3 rounded-xl mb-4 text-xs">
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Rounds</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.rounds || r.totalRounds} rounds</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Duration</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.roundTime || 15}s</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Auto-Start</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.autoStart ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Genres list */}
              <div className="mb-4">
                <span className="text-[9px] text-zinc-500 uppercase block mb-1">Active Genres</span>
                <div className="flex flex-wrap gap-1">
                  {r.genres?.length > 0 ? (
                    r.genres.map((g: string) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-zinc-400 font-medium border border-white/[0.02]"
                      >
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-600 text-xs italic">All genres enabled</span>
                  )}
                </div>
              </div>

              {/* Player list block */}
              <div className="border-t border-white/5 pt-4">
                <button
                  onClick={() => setActiveInspector(activeInspector === r.code ? null : r.code)}
                  className="w-full flex justify-between items-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  <span>Players ({r.playerCount})</span>
                  <span>{activeInspector === r.code ? '▼ Hide list' : '▶ Show list'}</span>
                </button>

                {activeInspector === r.code && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {r.players?.length > 0 ? (
                      r.players.map((p: any) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 bg-black/20 rounded-xl border border-white/[0.02] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.name[0].toUpperCase()
                              )}
                            </div>
                            <span className="font-medium text-zinc-300 truncate">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-500 font-bold uppercase">
                              {p.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--accent)] font-bold tabular-nums">{p.score} pts</span>
                            <button
                              onClick={() => handleKick(r.code, p.id, p.name)}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Kick
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-600 italic py-2 text-center">No players connected</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Room Controls */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/5">
              {r.state === 'waiting' ? (
                <button
                  onClick={() => handleStart(r.code)}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-xl transition-all"
                >
                  Force Start
                </button>
              ) : (
                <div className="flex items-center justify-center bg-white/5 border border-white/5 text-zinc-500 text-xs rounded-xl font-medium">
                  Round {r.currentRound}/{r.totalRounds}
                </div>
              )}
              <button
                onClick={() => handleDestroy(r.code)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-xl transition-all"
              >
                Shut Down
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-zinc-500 text-xs">Querying lobbies...</p>
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-zinc-500 text-center py-16 text-sm">
          {showAll ? 'No rooms configured on server.' : 'No active game lobbies.'}
        </p>
      )}
    </div>
  );
}
