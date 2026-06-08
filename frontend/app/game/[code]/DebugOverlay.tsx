'use client';

import { useState } from 'react';

interface DebugOverlayProps {
  gameState: any;
  socketConnected: boolean;
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">{title}</span>
        <span className="text-zinc-600 text-[9px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-2 text-[10px] leading-relaxed">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-right truncate ${color || 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}

export default function DebugOverlay({ gameState, socketConnected }: DebugOverlayProps) {
  if (!gameState) return null;

  const info = gameState._debugTrackInfo;
  const playingOrPreparing = gameState.state === 'playing' || gameState.state === 'round_preparing';
  const trackRank = info?.rank;
  const formatNum = (n: number) => n?.toLocaleString() || '0';

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[280px] w-full bg-black/85 backdrop-blur rounded-xl border border-white/10 p-2.5 text-[10px] font-mono text-zinc-300 shadow-2xl space-y-2 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${socketConnected ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-red-400'}`} />
        <span className="text-zinc-500 uppercase tracking-wider text-[9px]">Debug</span>
        <span className="text-zinc-600 text-[9px] ml-auto">{socketConnected ? 'connected' : 'offline'}</span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
          gameState.state === 'playing' ? 'bg-green-500/20 text-green-400' :
          gameState.state === 'round_result' ? 'bg-yellow-500/20 text-yellow-400' :
          gameState.state === 'game_over' ? 'bg-red-500/20 text-red-400' :
          gameState.state === 'round_preparing' ? 'bg-blue-500/20 text-blue-400' :
          'bg-zinc-500/20 text-zinc-400'
        }`}>
          {gameState.state}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.05] text-zinc-400">
          R{gameState.currentRound}/{gameState.totalRounds}
        </span>
        {trackRank > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-400">
            #{formatNum(trackRank)}
          </span>
        )}
      </div>

      {playingOrPreparing && info && (
        <Section title="Track" defaultOpen>
          <Row label="Title" value={info.title} />
          <Row label="Artist" value={info.artist} />
          <Row label="Source" value={info.source === 'Deezer' ? 'Deezer' : 'Unknown'} color="text-emerald-400" />
          <Row label="Track ID" value={info.id || '-'} />
          <Row label="Genre" value={info.genre || '-'} />
          <Row label="Rank" value={trackRank > 0 ? `#${formatNum(trackRank)}` : '-'} color={trackRank > 0 ? 'text-purple-400' : 'text-zinc-600'} />
        </Section>
      )}

      {playingOrPreparing && info && (
        <Section title="Audio / Timing">
          <Row label="Audio offset" value={`${info.targetOffset ?? 0}s`} />
          <Row label="Round time" value={`${gameState.roundTime || '?'}s`} />
          <Row label="Time left" value={gameState.timeLeft != null ? `${gameState.timeLeft}s` : '-'} color={gameState.timeLeft <= 5 ? 'text-red-400' : 'text-zinc-300'} />
          <Row label="Preview URL" value={gameState.previewUrl ? 'available' : 'missing'} color={gameState.previewUrl ? 'text-green-400' : 'text-red-400'} />
          <Row label="Audio source" value="deezer" />
        </Section>
      )}

      {gameState.state === 'playing' || gameState.state === 'round_preparing' ? (
        <Section title="Skip Votes">
          <Row label="Votes" value={`${(gameState as any).skipVotes ?? 0} / ${(gameState as any).skipVotesNeeded ?? 1}`} />
        </Section>
      ) : null}

      <Section title={`Players (${gameState.players?.length || 0})`}>
        {gameState.players?.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 text-[9px] leading-relaxed mb-0.5 last:mb-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.foundBoth ? '#fbbf24' : p.foundArtist || p.foundTitle ? '#22d3ee' : '#52525b' }} />
            <span className="text-zinc-300 truncate flex-1">{p.name}</span>
            <span className="text-[var(--accent)] tabular-nums">{p.score}</span>
          </div>
        ))}
      </Section>

      <Section title="Settings">
        <Row label="Genres" value={(gameState.genres || []).join(', ') || 'none'} />
        <Row label="Rounds" value={String(gameState.settings?.rounds || gameState.totalRounds)} />
        <Row label="Round time" value={`${gameState.settings?.roundTime || '?'}s`} />
        <Row label="Pause" value={`${gameState.settings?.pauseTime || '?'}s`} />
        <Row label="Audio source" value="deezer" />
        <Row label="Auto-start" value={gameState.settings?.autoStart ? 'on' : 'off'} />
        <Row label="Host ID" value={gameState.hostId || '-'} />
      </Section>
    </div>
  );
}
