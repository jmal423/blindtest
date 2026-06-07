'use client';

interface DebugOverlayProps {
  gameState: any;
  socketConnected: boolean;
}

export default function DebugOverlay({ gameState, socketConnected }: DebugOverlayProps) {
  if (!gameState) return null;

  const trackData =
    gameState.state === 'playing' || gameState.state === 'round_preparing'
      ? {
          previewUrl: gameState.previewUrl,
          audioOffset: gameState.audioOffset,
        }
      : {};

  const stateJson = JSON.stringify(
    {
      state: gameState.state,
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds,
      roundTime: gameState.roundTime,
      ...trackData,
      players: gameState.players?.map((p: any) => ({
        name: p.name,
        score: p.score,
        foundArtist: p.foundArtist,
        foundTitle: p.foundTitle,
        foundBoth: p.foundBoth,
      })),
    },
    null,
    2
  );

  const info = gameState._debugTrackInfo;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs w-full bg-black/80 backdrop-blur rounded-xl border border-white/10 p-3 text-[10px] font-mono text-zinc-300 shadow-2xl space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-zinc-500 uppercase tracking-wider">Debug Overlay</span>
        <span className="text-zinc-600">{socketConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {info && (
        <div className="space-y-1 border border-white/5 rounded-lg p-2 bg-white/[0.02]">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Track Info</p>
          <p><span className="text-zinc-500">Target:</span> {info.artist} — {info.title}</p>
          <p><span className="text-zinc-500">Source:</span> {info.provenance}</p>
          <p><span className="text-zinc-500">IDs:</span> YT: {info.youtubeVideoId} | Track: {info.id}</p>
          <p>
            <span className="text-zinc-500">Timings:</span> Offset: {info.targetOffset}s / {info.durationMs}ms
          </p>
        </div>
      )}

      <pre className="whitespace-pre-wrap break-all max-h-60 overflow-y-auto text-[10px] leading-relaxed text-zinc-400">
        {stateJson}
      </pre>
    </div>
  );
}
