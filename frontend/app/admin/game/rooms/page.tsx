'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAdminRooms,
  adminStartRoom,
  adminKickPlayer,
  adminDestroyRoom
} from '@/lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';

function PlayerAvatar({ p }: { p: any }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full bg-surface-light flex items-center justify-center text-[8px] font-bold overflow-hidden shrink-0 border border-white/10">
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ) : (
          p.name[0].toUpperCase()
        )}
      </div>
      <span className="text-xs truncate max-w-[80px]">{p.name}</span>
      {p.role === 'admin' && (
        <span className="rounded-full bg-[#00cec9]/15 px-1.5 py-[1px] text-[7px] font-bold tracking-wider text-[#00cec9] border border-[#00cec9]/30 shrink-0">
          ADMIN
        </span>
      )}
    </div>
  );
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [activeInspector, setActiveInspector] = useState<string | null>(null);
  const [destroyTarget, setDestroyTarget] = useState<string | null>(null);
  const [kickingId, setKickingId] = useState<string | null>(null);

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

  const handleKick = async (code: string, playerId: string) => {
    setKickingId(playerId);
    try {
      await adminKickPlayer(code, playerId);
      loadRooms();
    } catch {}
    setKickingId(null);
  };

  const confirmDestroy = async () => {
    if (!destroyTarget) return;
    await adminDestroyRoom(destroyTarget);
    setDestroyTarget(null);
    loadRooms();
  };

  const handleStart = async (code: string) => {
    await adminStartRoom(code);
    loadRooms();
  };

  const visible = showAll ? rooms : rooms.filter(r => r.players?.length > 0);
  const totalPlayers = rooms.reduce((s, r) => s + (r.players?.length || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-foreground/40 text-xs">Fetching active lobbies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-foreground/50">
          {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} online
        </p>
        <label className="flex items-center gap-2 text-xs text-foreground/40 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded border-white/20" />
          Show empty rooms
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <span className="text-3xl">🏠</span>
          <p className="text-sm text-foreground/50">No active rooms right now.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map(room => (
            <div
              key={room.code}
              className="rounded-2xl p-4 transition-all"
              style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎮</span>
                  <div>
                    <p className="font-bold text-sm">{room.code}</p>
                    <p className="text-[10px] text-foreground/40 font-medium uppercase tracking-wider">
                      {room.state} · {room.players?.length || 0} players
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {room.genres?.slice(0, 3).map((g: string) => (
                    <span key={g} className="hidden md:inline px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[9px] font-semibold border border-[var(--primary)]/20">
                      {g}
                    </span>
                  ))}
                  {room.genres?.length > 3 && <span className="hidden md:inline text-[9px] text-foreground/40">+{room.genres.length - 3}</span>}
                  {room.state !== 'waiting' && (
                    <span className="text-[10px] text-foreground/40 font-semibold tabular-nums">R{room.currentRound}/{room.totalRounds}</span>
                  )}
                  <span className="text-[10px] text-foreground/30 tabular-nums">{room.settings?.roundTime || '?'}s</span>
                  </div>
                  <div className="flex gap-1.5">
                  <button
                    onClick={() => handleStart(room.code)}
                    className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-foreground/40 hover:text-foreground"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setDestroyTarget(room.code)}
                    className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-red-400/60 hover:text-red-400"
                    style={{ backgroundColor: 'color-mix(in srgb, #ef4444 10%, transparent)' }}
                  >
                    Destroy
                  </button>
                  <button
                    onClick={() => setActiveInspector(activeInspector === room.code ? null : room.code)}
                    className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-foreground/30 hover:text-foreground/60"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
                  >
                    {activeInspector === room.code ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {activeInspector === room.code && (
                <div className="space-y-2 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                  {room.players?.length > 0 ? (
                    room.players.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
                        <PlayerAvatar p={p} />
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[var(--accent)] tabular-nums">{p.score || 0} pts</span>
                          <button
                          onClick={() => handleKick(room.code, p.id)}
                          disabled={kickingId === p.id}
                          className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-30"
                          style={{ backgroundColor: 'color-mix(in srgb, #ef4444 10%, transparent)', color: '#ef4444' }}
                        >
                          {kickingId === p.id ? '...' : 'Kick'}
                        </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-foreground/40 text-center py-2">No players in this room</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={destroyTarget !== null}
        onClose={() => setDestroyTarget(null)}
        onConfirm={confirmDestroy}
        title="Destroy Room"
        message={`This will immediately shut down room "${destroyTarget}" and disconnect all players.`}
        confirmLabel="Destroy Room"
        destructive
      />
    </div>
  );
}
