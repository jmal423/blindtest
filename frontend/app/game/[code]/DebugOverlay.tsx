'use client';

import { useState, useEffect } from 'react';

interface DebugOverlayProps {
  gameState: any;
  socketConnected: boolean;
}

export default function DebugOverlay({ gameState, socketConnected }: DebugOverlayProps) {
  const [activeTab, setActiveTab] = useState<'track' | 'players' | 'settings'>('track');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedState, setCopiedState] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Load minimized preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('blindtest_debug_minimized');
    if (saved !== null) {
      setIsMinimized(saved === 'true');
    }
  }, []);

  if (!gameState) return null;

  const toggleMinimized = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    localStorage.setItem('blindtest_debug_minimized', String(next));
  };

  const copyState = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(gameState, null, 2));
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 1500);
    } catch (err) {
      console.error('Failed to copy game state', err);
    }
  };

  const info = gameState._debugTrackInfo;
  const playingOrPreparing = gameState.state === 'playing' || gameState.state === 'round_preparing';
  const trackRank = info?.rank;
  const formatNum = (n: number) => n?.toLocaleString() || '0';

  const copyTrackId = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  if (isMinimized) {
    return (
      <div
        onClick={toggleMinimized}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3 py-2 bg-surface/95 backdrop-blur-xl border border-foreground/10 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:border-primary/40 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 group font-mono"
        title="Show Developer Console"
      >
        <span className="relative flex h-2 w-2">
          {socketConnected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${socketConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider text-foreground/50 group-hover:text-foreground/80 transition-colors">
          DevConsole
        </span>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20 uppercase tracking-wide">
          {gameState.state === 'playing' ? `R${gameState.currentRound}` : gameState.state}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-surface/90 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden font-mono text-[10px] text-foreground/80 transition-all duration-300 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-foreground/5 bg-foreground/[0.02]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {socketConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${socketConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-foreground/50">DevConsole</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={copyState}
            className="px-2 py-0.5 rounded bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 hover:border-foreground/20 text-foreground/60 hover:text-foreground transition-all flex items-center gap-1 text-[8px] font-bold cursor-pointer"
            title="Copy full game state as JSON"
          >
            {copiedState ? 'Copied ✓' : '📋 JSON'}
          </button>
          
          <button
            onClick={toggleMinimized}
            className="p-1 rounded hover:bg-foreground/5 text-foreground/40 hover:text-foreground/80 transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse Console"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* State pill & Info */}
      <div className="p-3 pb-2 flex items-center justify-between border-b border-foreground/5 bg-foreground/[0.01]">
        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
          gameState.state === 'playing' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          gameState.state === 'round_result' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          gameState.state === 'game_over' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
          gameState.state === 'round_preparing' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
          'bg-foreground/5 text-foreground/50 border border-foreground/10'
        }`}>
          {gameState.state}
        </span>
        <span className="text-[9px] text-foreground/50 font-bold bg-foreground/5 px-2 py-0.5 rounded-md border border-foreground/5">
          R{gameState.currentRound}/{gameState.totalRounds}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-foreground/5 bg-foreground/[0.01] p-1 gap-1">
        {(['track', 'players', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-foreground/10 text-foreground shadow-sm'
                : 'text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.02]'
            }`}
          >
            {tab === 'track' ? '🎵 Track' : tab === 'players' ? '👥 Players' : '⚙️ Rules'}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="p-3 max-h-[260px] overflow-y-auto space-y-3.5 scrollbar-thin">
        {activeTab === 'track' && (
          <>
            {playingOrPreparing && info ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-foreground/40">
                    <span>Active Track</span>
                    <span className="text-emerald-400 font-bold">Deezer API</span>
                  </div>
                  <div className="bg-foreground/[0.02] border border-foreground/5 p-2 rounded-xl space-y-1.5 text-[9px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Title:</span>
                      <span className="text-foreground font-bold truncate text-right">{info.title}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Artist:</span>
                      <span className="text-foreground/90 font-medium truncate text-right">{info.artist}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Genre:</span>
                      <span className="text-foreground/85 truncate text-right">{info.genre || '-'}</span>
                    </div>
                    {trackRank > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-foreground/40 shrink-0">Rank:</span>
                        <span className="text-purple-400 font-bold text-right">#{formatNum(trackRank)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-foreground/40 shrink-0">Track ID:</span>
                      <button
                        onClick={() => copyTrackId(info.id)}
                        className="text-[8px] bg-foreground/5 hover:bg-foreground/10 px-1.5 py-0.5 rounded border border-foreground/5 transition-colors cursor-pointer text-foreground/85 flex items-center gap-1 max-w-[130px]"
                        title="Click to copy Track ID"
                      >
                        <span className="truncate">{copiedId ? 'Copied ✓' : info.id || '-'}</span>
                        {!copiedId && (
                          <svg className="w-2.5 h-2.5 opacity-55" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-foreground/40">Audio & Timing</span>
                  <div className="bg-foreground/[0.02] border border-foreground/5 p-2 rounded-xl space-y-1.5 text-[9px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Time Left:</span>
                      <span className={`font-black tabular-nums transition-all ${
                        gameState.timeLeft != null && gameState.timeLeft <= 5 
                          ? 'text-rose-400 animate-pulse scale-110 origin-right' 
                          : 'text-foreground'
                      }`}>
                        {gameState.timeLeft != null ? `${gameState.timeLeft}s` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Offset:</span>
                      <span className="text-foreground/85">{info.targetOffset ?? 0}s</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/40 shrink-0">Clip Preview:</span>
                      <span className={`font-bold ${gameState.previewUrl ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gameState.previewUrl ? 'Available' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-foreground/30 font-medium">
                No active track playing
              </div>
            )}

            {/* Track History */}
            {gameState.trackHistory?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] text-foreground/40">History ({gameState.trackHistory.length})</span>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {[...gameState.trackHistory].reverse().map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 bg-foreground/[0.01] border border-foreground/5 rounded-lg text-[9px] leading-relaxed">
                      <span className="text-foreground/30 font-bold w-4 shrink-0">#{t.round}</span>
                      {t.skipped ? (
                        <span className="text-foreground/30 font-semibold line-through truncate flex-1">
                          {t.name}
                        </span>
                      ) : (
                        <span className="text-foreground/80 truncate flex-1 font-medium">
                          {t.name}
                        </span>
                      )}
                      <span className="text-foreground/40 truncate max-w-[80px]">{t.artist}</span>
                      {t.skipped && <span className="text-[8px] bg-foreground/10 px-1 rounded text-foreground/40 uppercase tracking-wide">Skip</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'players' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[9px] text-foreground/40">
              <span>Player Lobby</span>
              {playingOrPreparing && (gameState.skipVotesNeeded !== undefined) && (
                <span className="text-foreground/60 font-bold">
                  🗳️ Skips: {(gameState as any).skipVotes ?? 0}/{(gameState as any).skipVotesNeeded ?? 1}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {gameState.players?.map((p: any) => {
                const isHost = p.id === gameState.hostId;
                return (
                  <div key={p.id} className="flex items-center justify-between px-2.5 py-2 bg-foreground/[0.02] border border-foreground/5 rounded-xl shadow-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Status Badges */}
                      <div className="flex gap-1 shrink-0">
                        <span
                          className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                            p.foundArtist 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_6px_rgba(16,185,129,0.15)]' 
                              : 'bg-foreground/5 text-foreground/30 border border-foreground/5'
                          }`}
                          title={p.foundArtist ? "Artist Guessed" : "Artist Pending"}
                        >
                          A
                        </span>
                        <span
                          className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                            p.foundTitle 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_6px_rgba(16,185,129,0.15)]' 
                              : 'bg-foreground/5 text-foreground/30 border border-foreground/5'
                          }`}
                          title={p.foundTitle ? "Title Guessed" : "Title Pending"}
                        >
                          T
                        </span>
                      </div>
                      
                      <span className="text-foreground/80 font-bold truncate">
                        {p.name}
                      </span>
                      
                      {isHost && (
                        <span className="shrink-0 text-[7px] bg-primary/15 text-primary border border-primary/20 px-1 py-0.2 rounded font-black tracking-wider uppercase">
                          Host
                        </span>
                      )}
                    </div>
                    
                    <span className="text-accent font-black tabular-nums shrink-0">{p.score} pts</span>
                  </div>
                );
              })}
              {(!gameState.players || gameState.players.length === 0) && (
                <div className="text-center py-4 text-foreground/30">No players connected</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-2">
            <span className="text-[9px] text-foreground/40">Lobby Settings</span>
            <div className="bg-foreground/[0.02] border border-foreground/5 p-2 rounded-xl space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Genres:</span>
                <span className="text-foreground/80 truncate text-right">{(gameState.genres || []).join(', ') || 'none'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Rounds:</span>
                <span className="text-foreground/90">{String(gameState.settings?.rounds || gameState.totalRounds)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Round Time:</span>
                <span className="text-foreground/90">{gameState.settings?.roundTime || gameState.roundTime || 15}s</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Pause Time:</span>
                <span className="text-foreground/90">{gameState.settings?.pauseTime || 4}s</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Auto Start:</span>
                <span className="text-foreground/90">{gameState.settings?.autoStart ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-foreground/40 shrink-0">Audio Src:</span>
                <span className="text-emerald-400 font-bold uppercase">Deezer</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-foreground/40 shrink-0">Host ID:</span>
                <span className="text-foreground/60 truncate max-w-[130px] font-mono">{gameState.hostId || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
