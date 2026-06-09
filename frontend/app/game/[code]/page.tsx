'use client';

import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { io as socketIo, Socket } from 'socket.io-client';
import { getToken, GameState, Player, RoomSettings, startGame, updateSettings, fetchGenres } from '@/lib/api';
import { isDebugMode } from '@/lib/debug-context';
import AudioPlayer, { AudioPlayerHandle } from '@/app/components/AudioPlayer';
import { useSettings } from '@/app/context/SettingsContext';
import { useTranslation } from '@/lib/useTranslation';
import Chat from './Chat';
import Podium from './Podium';
import DebugOverlay from './DebugOverlay';
import { useSound } from '@/lib/useSound';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PLAYER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16'];

export default function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [guess, setGuess] = useState('');
  const [guessResult, setGuessResult] = useState<{ artist_result: string; artist_score: number; title_result: string; title_score: number; points_awarded_this_guess: number; found_both: boolean } | null>(null);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [smoothTime, setSmoothTime] = useState<number>(0);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smoothTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundStartRef = useRef<number>(0);
  const roundTimeRef = useRef<number>(15);
  const guessInputRef = useRef<HTMLInputElement>(null);
  const [artistFound, setArtistFound] = useState(false);
  const [titleFound, setTitleFound] = useState(false);
  const [bothFound, setBothFound] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [guessMarkers, setGuessMarkers] = useState<{ playerName: string; artistFound: boolean; titleFound: boolean; guessTimeMs: number }[]>([]);
  const [startLoading, setStartLoading] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  useEffect(() => {
    setDebugOn(isDebugMode());
    const handler = () => setDebugOn(isDebugMode());
    window.addEventListener('debug-toggle', handler);
    return () => window.removeEventListener('debug-toggle', handler);
  }, []);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasVotedSkip, setHasVotedSkip] = useState(false);
  const [skipCooldown, setSkipCooldown] = useState(false);
  const prevVolumeRef = useRef(1);
  const playSound = useSound();
  const { settings: userSettings, updateSettings: updateLocalSettings } = useSettings();
  const { t } = useTranslation();
  const playSoundRef = useRef(playSound);
  const activeRoundRef = useRef<string | null>(null);
  const prevPlayerCountRef = useRef(0);
  playSoundRef.current = playSound;

  const handleAudioPlaying = useCallback(() => {
    socketRef.current?.emit('playback_started');
    guessInputRef.current?.focus();
  }, []);

  const handleAudioBlocked = useCallback(() => {
    setNeedsAudioUnlock(true);
  }, []);

  const handleAudioTimeUpdate = useCallback((t: number, d?: number) => {
    setCurrentTime(t);
    if (d && d > 0) setDuration(d);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M') && document.activeElement?.tagName !== 'INPUT') {
        if (userSettings.masterVolume > 0) {
          prevVolumeRef.current = userSettings.masterVolume;
          updateLocalSettings({ masterVolume: 0 });
        } else {
          updateLocalSettings({ masterVolume: prevVolumeRef.current || 1 });
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [userSettings.masterVolume, updateLocalSettings]);

  useEffect(() => {
    if (gameState?.state === 'playing' && !bothFound && userSettings.autoFocusInput) {
      const timer = setTimeout(() => guessInputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentRound, gameState?.state, bothFound]);

  const applyGameState = useCallback((state: GameState) => {
    setGameState(state);

    if (state.state === 'round_preparing' || state.state === 'playing') {
      const roundKey = `${state.currentRound}`;
      if (activeRoundRef.current !== roundKey) {
        activeRoundRef.current = roundKey;
        setArtistFound(false);
        setTitleFound(false);
        setBothFound(false);
        setGuess('');
        setGuessResult(null);
        setEncouragement(null);
        setGuessMarkers([]);
        setHasVotedSkip(false);
        setHasVotedSkip(false);

        if (localTimerRef.current) {
          clearInterval(localTimerRef.current);
          localTimerRef.current = null;
        }
        if (smoothTimerRef.current) {
          clearInterval(smoothTimerRef.current);
          smoothTimerRef.current = null;
        }
        setLocalTimeLeft(null);
        setSmoothTime(0);
      }

      if (state.state === 'playing' && !localTimerRef.current) {
        const roundTime = state.roundTime || 15;
        const serverTimeLeft = state.timeLeft ?? roundTime;
        const elapsed = Math.max(0, roundTime - serverTimeLeft);
        setLocalTimeLeft(serverTimeLeft);
        setSmoothTime(elapsed);
        roundStartRef.current = Date.now() - elapsed * 1000;
        roundTimeRef.current = roundTime;

        localTimerRef.current = setInterval(() => {
          setLocalTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              if (localTimerRef.current) {
                clearInterval(localTimerRef.current);
                localTimerRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        smoothTimerRef.current = setInterval(() => {
          const elapsedMs = Date.now() - roundStartRef.current;
          const t = Math.min(elapsedMs / 1000, roundTimeRef.current);
          setSmoothTime(t);
          if (t >= roundTimeRef.current) {
            if (smoothTimerRef.current) {
              clearInterval(smoothTimerRef.current);
              smoothTimerRef.current = null;
            }
          }
        }, 50);
      }
      return;
    }

    activeRoundRef.current = null;

    setLocalTimeLeft(null);
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
    if (smoothTimerRef.current) {
      clearInterval(smoothTimerRef.current);
      smoothTimerRef.current = null;
    }
    if (state.state === 'game_over') {
      playSoundRef.current('endGame');
    }
    if (state.state === 'game_over' || state.state === 'round_result') {
      setGuess('');
      setGuessResult(null);
    }
  }, []);

  useEffect(() => {
    const pid = localStorage.getItem(`blindtest_player_${code}`);
    if (!pid) {
      if (!getToken()) {
        router.push(`/?redirect=/game/${code}`);
        return;
      }
      router.push('/');
      return;
    }
    setPlayerId(pid);
  }, [code, router]);

  useEffect(() => {
    if (!playerId) return;

    const socket = socketIo(API_URL);
    socketRef.current = socket;
    setSocket(socket);

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_room', code, playerId);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('game_state', (state: GameState) => {
      if (state.state === 'waiting' && state.players.length > prevPlayerCountRef.current && prevPlayerCountRef.current > 0) {
        playSound('playerJoin');
      }
      prevPlayerCountRef.current = state.players.length;
      applyGameState(state);
    });

    socket.on('guess_made', (marker: any) => {
      setGuessMarkers(prev => [...prev, { playerName: marker.playerName, artistFound: marker.artistFound, titleFound: marker.titleFound, guessTimeMs: marker.guessTimeMs }]);
    });

    socket.on('input_result', (result: any) => {
      if (result.found_both) {
        setBothFound(true);
        setArtistFound(true);
        setTitleFound(true);
        playSound('complete');
        const completeKeys = ['complete_1', 'complete_2', 'complete_3', 'complete_4', 'complete_5'];
        setEncouragement(t(completeKeys[Math.floor(Math.random() * completeKeys.length)]));
      } else if (result.artist_result === 'Good' || result.title_result === 'Good') {
        if (result.artist_result === 'Good') setArtistFound(true);
        if (result.title_result === 'Good') setTitleFound(true);
        playSound('correct');
        const correctKeys = ['correct_1', 'correct_2', 'correct_3', 'correct_4', 'correct_5'];
        setEncouragement(t(correctKeys[Math.floor(Math.random() * correctKeys.length)]));
      } else {
        playSound('wrong');
        const wrongKeys = ['wrong_1', 'wrong_2', 'wrong_3', 'wrong_4', 'wrong_5'];
        setEncouragement(t(wrongKeys[Math.floor(Math.random() * wrongKeys.length)]));
      }
      setGuessResult(result);
    });

    socket.on('connect_error', () => {
      setError(t('lost_connection'));
    });

    socket.on('kicked', (data: { reason: string }) => {
      alert(data.reason);
      localStorage.removeItem(`blindtest_player_${code}`);
      router.push('/');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, playerId, applyGameState, router]);

  const handleStart = useCallback(async () => {
    setStartLoading(true);
    try {
      await startGame(code, playerId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed_to_start'));
    } finally {
      setStartLoading(false);
    }
  }, [code, playerId]);

  const handleSettingsUpdate = useCallback(async (settings: Partial<RoomSettings>) => {
    try {
      await updateSettings(code, playerId, settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings_update_failed'));
    }
  }, [code, playerId]);

  const handleGenresUpdate = useCallback(async (genres: string[]) => {
    try {
      await updateSettings(code, playerId, { genres });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('genre_update_failed'));
    }
  }, [code, playerId]);

  const handleSubmit = useCallback(() => {
    if (!guess.trim() || !socketRef.current) return;
    socketRef.current.emit('submit_guess', { input: guess.trim() });
    setGuess('');
  }, [guess]);

  const handlePlayAgain = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('play_again', code);
  }, [code]);

  const handleSkipVote = useCallback(() => {
    if (!socketRef.current || hasVotedSkip || skipCooldown) return;
    setSkipCooldown(true);
    setTimeout(() => setSkipCooldown(false), 2000);
    socketRef.current.emit('skip_round');
    setHasVotedSkip(true);
  }, [hasVotedSkip, skipCooldown]);

  if (!playerId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">{t('connecting')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <p className="text-zinc-500 text-sm">Server: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</p>
        <button onClick={() => router.push('/')} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl">
          {t('back_home')}
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">{t('connecting_to_game')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 md:p-6 max-w-6xl mx-auto w-full gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xl font-bold tracking-[0.2em] text-[var(--primary)]">{code}</p>
          <button
            onClick={() => { navigator.clipboard.writeText(code); }}
            className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t('copy')}
          </button>
          {gameState.state === 'waiting' && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-500">
              {(gameState as any).genres?.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                  {(gameState as any).genres?.slice(0, 3).join(', ')}{(gameState as any).genres?.length > 3 ? ` +${(gameState as any).genres.length - 3}` : ''}
                </span>
              )}
<span>{(gameState as any).settings?.rounds ?? gameState.totalRounds} rounds</span>
               <span>{(gameState as any).settings?.roundTime ?? 15}s</span>
            </div>
          )}
          {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
            <span className="text-xs text-zinc-600">Round {gameState.currentRound}/{gameState.totalRounds}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
            <>
              <div className="hidden md:flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (userSettings.masterVolume > 0) {
                      prevVolumeRef.current = userSettings.masterVolume;
                      updateLocalSettings({ masterVolume: 0 });
                    } else {
                      updateLocalSettings({ masterVolume: prevVolumeRef.current || 1 });
                    }
                  }}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                  title={userSettings.masterVolume === 0 ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {userSettings.masterVolume === 0 ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  ) : userSettings.masterVolume < 0.5 ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  )}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={userSettings.masterVolume}
                  onChange={e => updateLocalSettings({ masterVolume: Number(e.target.value) })}
                  className="w-14 accent-[var(--primary)] h-1 cursor-pointer"
                />
              </div>
              <button
                onClick={() => setChatOpen(o => !o)}
                className="md:hidden text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                {chatOpen ? t('hide_chat') : t('chat')}
              </button>
            </>
          )}
        </div>
      </div>

<div className="flex gap-4 md:gap-6 min-h-0 flex-1">
        {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
          <div className="hidden md:flex flex-col w-52 shrink-0 gap-3 max-h-[calc(100vh-10rem)]">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{t('players_label') || 'Players'}</p>
              <div className="space-y-1">
                {[...gameState.players].sort((a: any, b: any) => b.score - a.score).map((p: any) => (
                  <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] ${p.id === playerId ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-white/[0.03]'}`}>
                    <div className="w-5 h-5 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[9px] font-bold" style={!p.avatarUrl ? { backgroundColor: PLAYER_COLORS[gameState.players.indexOf(p) % PLAYER_COLORS.length] } : undefined}>
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        p.name?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <span className="truncate flex-1 text-zinc-300">{p.name}</span>
                    <span className="text-[var(--accent)] font-bold tabular-nums shrink-0">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {((gameState as any)?.trackHistory?.length > 0) && (
              <div className="flex-1 min-h-0 flex flex-col">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{t('history_label')}</p>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {[...((gameState as any)?.trackHistory || [])].reverse().map((t: any, idx: number) => (
                    <div
                      key={t.round}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${t.skipped ? 'opacity-50' : ''} ${
                        idx === 0 ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-white/[0.03]'
                      }`}
                    >
                      {t.skipped && <span className="text-zinc-500">⏭</span>}
                      {t.albumImage && (
                        <img src={t.albumImage} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium truncate leading-tight ${t.skipped ? 'line-through text-zinc-500' : ''}`}>{t.name}</p>
                        <p className="text-zinc-500 truncate leading-tight">
                          {t.artist}{t.rank > 0 ? ` · #${t.rank.toLocaleString()}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`flex-1 flex flex-col gap-4 min-w-0 ${gameState.state === 'game_over' ? '' : 'max-w-2xl'}`}>
          {gameState.state === 'waiting' && (
            <WaitingRoom
              gameCode={code}
              players={gameState.players}
              settings={gameState.settings}
              genres={gameState.genres}
              hostId={gameState.hostId}
              playerId={playerId}
              onStart={handleStart}
              onSettingsChange={handleSettingsUpdate}
              onGenresChange={handleGenresUpdate}
              onKickPlayer={(pid) => socketRef.current?.emit('kick_player', pid)}
              onTransferHost={(pid) => socketRef.current?.emit('transfer_host', pid)}
              startLoading={startLoading}
            />
          )}

          {(gameState.state === 'playing' || gameState.state === 'round_preparing') && (
            <PlayingPhase
              state={gameState.state}
              currentRound={gameState.currentRound}
              totalRounds={gameState.totalRounds}
              timeLeft={localTimeLeft ?? (gameState as any).timeLeft}
              smoothTime={smoothTime}
              guess={guess}
              onGuessChange={setGuess}
              onSubmit={handleSubmit}
              guessResult={guessResult}
              guessMarkers={guessMarkers}
              inputRef={guessInputRef}
              artistFound={artistFound}
              titleFound={titleFound}
              bothFound={bothFound}
              players={gameState.players}
              playerId={playerId}
encouragement={encouragement}
               roundTime={(gameState as any).settings?.roundTime || 15}
onSkipVote={handleSkipVote}
                hasVotedSkip={hasVotedSkip}
                skipCooldown={skipCooldown}
                skipVotes={gameState.state === 'playing' || gameState.state === 'round_preparing' ? (gameState as any).skipVotes ?? 0 : 0}
               skipVotesNeeded={gameState.state === 'playing' || gameState.state === 'round_preparing' ? (gameState as any).skipVotesNeeded ?? 1 : 1}
               hostId={gameState.hostId}
            />
          )}

          {gameState.state === 'round_result' && (
            <RoundResult data={gameState.roundResult} players={gameState.players} pauseTimeLeft={(gameState as any).pauseTimeLeft} trackHistory={(gameState as any).trackHistory} />
          )}

          {gameState.state === 'game_over' && (
            <Podium code={code} rankings={gameState.rankings} playerId={playerId} onPlayAgain={handlePlayAgain} />
          )}
        </div>

        {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
          <div className={`${chatOpen ? 'fixed inset-0 z-40 bg-black/80 md:bg-transparent md:static flex items-end md:block' : 'hidden md:block'} w-64 shrink-0`}>
            <div className="w-full md:w-64 bg-[var(--surface)] md:bg-transparent rounded-t-2xl md:rounded-none md:h-auto max-h-[60vh] md:max-h-none overflow-y-auto">
              {chatOpen && (
                <button onClick={() => setChatOpen(false)} className="md:hidden w-full text-center py-2 text-xs text-zinc-500 border-b border-white/5">
                  Close
                </button>
              )}
              <Chat socket={socket} />
            </div>
          </div>
        )}
      </div>

      {gameState.state !== 'game_over' && (
<AudioPlayer
            ref={audioPlayerRef}
            previewUrl={(gameState as any).previewUrl || null}
            audioOffset={(gameState as any).audioOffset || 0}
            state={gameState.state}
            onPlaying={handleAudioPlaying}
            onTimeUpdate={handleAudioTimeUpdate}
            onBlocked={handleAudioBlocked}
          />
      )}

      {debugOn && (
        <DebugOverlay gameState={gameState} socketConnected={socketConnected} />
      )}

      {needsAudioUnlock && gameState.state === 'playing' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={async () => {
            const ok = await audioPlayerRef.current?.resume();
            if (ok) setNeedsAudioUnlock(false);
          }}
          onTouchStart={async () => {
            const ok = await audioPlayerRef.current?.resume();
            if (ok) setNeedsAudioUnlock(false);
          }}
        >
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </div>
            <p className="text-xl font-bold text-white">Tap to enable audio</p>
            <p className="text-sm text-zinc-400">Your browser needs a tap to play sound</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderSetting({ label, value, min, max, suffix = '', isHost, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  isHost: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="text-xs text-zinc-300 tabular-nums">{value}{suffix}</span>
      </div>
      {isHost ? (
        <input
          type="range" min={min} max={max} step="1"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-[var(--primary)] h-1.5"
        />
      ) : (
        <div className="w-full h-1.5 rounded-full bg-[var(--surface-light)]">
          <div
            className="h-full rounded-full bg-[var(--primary)]/40 transition-all"
            style={{ width: `${((value - min) / (max - min)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function WaitingRoom({
  gameCode,
  players,
  settings,
  genres,
  hostId,
  playerId,
  onStart,
  onSettingsChange,
  onGenresChange,
  onKickPlayer,
  onTransferHost,
  startLoading,
}: {
  gameCode: string;
  players: { id: string; name: string; avatarUrl?: string | null; role?: string }[];
  settings: RoomSettings;
  genres: string[];
  hostId?: string | null;
  playerId: string;
  onStart: () => void;
  onSettingsChange: (s: Partial<RoomSettings>) => void;
  onGenresChange: (g: string[]) => void;
  onKickPlayer?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;
  startLoading?: boolean;
}) {
  const { t } = useTranslation();
  const isHost = playerId === hostId;
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetchGenres().then(setAllGenres).catch(() => {});
  }, []);

  const toggleGenre = (id: string) => {
    const set = new Set(genres);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onGenresChange(Array.from(set));
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-6 overflow-y-auto pb-24 md:pb-8">
      <div className="w-full max-w-sm space-y-2">
        <p className="text-sm text-zinc-400 font-medium">{t('players')} ({players.length})</p>
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold">
                {p.name[0].toUpperCase()}
              </div>
            )}
            <span className="font-medium">
              {p.name}
              {p.role === 'admin' && (
                <span className="ml-2 rounded bg-[#00cec9]/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#00cec9] ring-1 ring-[#00cec9]/50">
                  ADMIN
                </span>
              )}
            </span>
            {p.id === hostId && <span className="text-[10px] text-zinc-500 ml-auto">Host</span>}
            {p.id !== hostId && playerId === hostId && onTransferHost && (
              <button
                onClick={() => onTransferHost(p.id)}
                className="text-[10px] px-2 py-1 rounded bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 transition-colors"
              >
                Make Host
              </button>
            )}
            {(playerId === hostId || p.role === 'admin') && onKickPlayer && p.id !== playerId && (
              <button
                onClick={() => onKickPlayer(p.id)}
                className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Kick
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-4 bg-[var(--surface)] rounded-2xl p-5 border border-white/5">
        <p className="text-sm text-zinc-400 font-medium">{t('settings')}</p>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500">{t('genres')}</label>
            {isHost && (
              <button
                onClick={() => {
                  if (genres.length === allGenres.length && allGenres.length > 0) {
                    onGenresChange([]);
                  } else {
                    onGenresChange(allGenres.map(g => g.id));
                  }
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
              >
                {genres.length === allGenres.length && allGenres.length > 0 ? t('clear_btn') : t('all_btn')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
            {allGenres.map(g => {
              const selected = genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => isHost && toggleGenre(g.id)}
                  className={`px-2 py-1.5 rounded-full text-[11px] font-medium transition-all truncate ${
                    selected
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface-light)] text-zinc-400'
                  } ${!isHost ? 'opacity-80 cursor-default' : 'hover:brightness-110'}`}
                >
                  {t('genre_' + g.id)}
                </button>
              );
            })}
          </div>
        </div>

        <SliderSetting label={t('rounds')} value={settings.rounds} min={3} max={25} isHost={isHost} onChange={v => onSettingsChange({ rounds: v })} />
        <SliderSetting label={t('time_per_round')} value={settings.roundTime} min={8} max={30} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ roundTime: v })} />
        <SliderSetting label={t('pause_between')} value={settings.pauseTime} min={2} max={15} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ pauseTime: v })} />

        {isHost && (
          <div>
            <div className="flex items-center justify-between pt-3">
              <div>
                <span className="text-xs text-zinc-400">{t('auto_start')}</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">{t('auto_start_desc')}</p>
              </div>
              <button
                onClick={() => onSettingsChange({ autoStart: !settings.autoStart })}
                className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors ${
                  settings.autoStart ? 'bg-[var(--primary)]' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                    settings.autoStart ? 'left-[22px]' : 'left-[2px]'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {isHost && (
        <button
          onClick={onStart}
          disabled={startLoading || !genres || genres.length === 0}
          className={`px-8 py-4 text-white font-semibold rounded-xl transition-colors ${
            genres && genres.length > 0 && !startLoading
              ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] animate-pulse-glow'
              : 'bg-gray-600 opacity-50 cursor-not-allowed'
          }`}
        >
          {startLoading ? 'Starting...' : genres && genres.length > 0 ? t('start_game') : t('select_genre_to_start')}
        </button>
      )}

      {!isHost && <p className="text-zinc-500 text-sm">Waiting for the host to start...</p>}
    </div>
  );
}

function PreparingCountdown({ currentRound, totalRounds, players, playerId, onSkipVote, hasVotedSkip, skipCooldown, skipVotes, skipVotesNeeded, hostId }: { currentRound: number; totalRounds: number; players: Player[]; playerId: string; onSkipVote: () => void; hasVotedSkip: boolean; skipCooldown: boolean; skipVotes: number; skipVotesNeeded: number; hostId?: string | null }) {
  const [count, setCount] = useState(3);
  const { t } = useTranslation();

  useEffect(() => {
    setCount(3);
    const t = setInterval(() => setCount(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [currentRound]);

  const statusLabel = (p: any) => {
    if (p.foundBoth) return { text: t('found_label'), cls: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' };
    if (p.foundArtist && p.foundTitle) return { text: t('both_label'), cls: 'bg-green-500/20 text-green-400' };
    if (p.foundArtist) return { text: t('artist_label'), cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    if (p.foundTitle) return { text: t('title_label'), cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    return { text: t('guessing_label'), cls: 'text-zinc-600' };
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-12">
      <motion.p
        key={count}
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-7xl font-bold text-[var(--accent)]"
      >
        {count > 0 ? count : 'GO!'}
      </motion.p>

      <div className="w-full max-w-xs space-y-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 text-center">{t('players')}</p>
        {players.map(p => {
          const s = statusLabel(p);
          return (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${p.id === playerId ? 'bg-white/5 ring-1 ring-white/20' : ''}`}>
              <span className="text-sm flex-1 truncate">{p.name}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.cls}`}>{s.text}</span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-zinc-500">{t('round_x_of_y', { current: currentRound, total: totalRounds })}</p>

      {players.length > 0 && (
        <div className="flex items-center gap-2">
          {playerId === hostId ? (
            <button onClick={onSkipVote} disabled={skipCooldown} className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('skip')}
            </button>
          ) : (
            <button
              onClick={hasVotedSkip ? undefined : onSkipVote}
              disabled={hasVotedSkip || skipCooldown}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                hasVotedSkip || skipCooldown
                  ? 'bg-zinc-800 text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {hasVotedSkip ? `${t('voted')} ${skipVotes}/${skipVotesNeeded}` : `${t('vote_skip')} ${skipVotes}/${skipVotesNeeded}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PlayingPhase({
  state,
  currentRound,
  totalRounds,
  timeLeft,
  guess,
  onGuessChange,
  onSubmit,
  guessResult,
  guessMarkers,
  inputRef,
  artistFound,
  titleFound,
  bothFound,
  players,
  playerId,
  encouragement,
  onSkipVote,
  hasVotedSkip,
  skipCooldown,
  skipVotes,
  skipVotesNeeded,
  smoothTime,
  roundTime,
  hostId,
}: {
  state: string;
  currentRound: number;
  totalRounds: number;
  timeLeft: number | null;
  smoothTime?: number;
  guess: string;
  onGuessChange: (v: string) => void;
  onSubmit: () => void;
  guessResult: { artist_result: string; artist_score: number; title_result: string; title_score: number; points_awarded_this_guess: number; found_both: boolean; guessTimeMs?: number } | null;
  guessMarkers: { playerName: string; artistFound: boolean; titleFound: boolean; guessTimeMs: number }[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  artistFound: boolean;
  titleFound: boolean;
  bothFound: boolean;
  players: Player[];
  playerId: string;
  encouragement: string | null;
  onSkipVote: () => void;
  hasVotedSkip: boolean;
  skipCooldown: boolean;
  skipVotes: number;
  skipVotesNeeded: number;
  roundTime?: number;
  hostId?: string | null;
}) {
  const { t } = useTranslation();
  const roundDuration = roundTime || 15;
  const placeholder = bothFound
    ? t('complete_2')
    : artistFound
      ? t('artist_found_placeholder')
      : t('guess_placeholder');

  if (state === 'round_preparing') {
    return <PreparingCountdown currentRound={currentRound} totalRounds={totalRounds} players={players} playerId={playerId} onSkipVote={onSkipVote} hasVotedSkip={hasVotedSkip} skipCooldown={skipCooldown} skipVotes={skipVotes} skipVotesNeeded={skipVotesNeeded} hostId={hostId} />;
  }

  const me = players.find(p => p.id === playerId);
  const isAdmin = me?.role === 'admin' || playerId === hostId;

  const playerStatus = (p: any) => {
    if (p.foundBoth) return 'found';
    if (p.foundArtist || p.foundTitle) return 'partial';
    return 'guessing';
  };

  const pillStyle = (found: boolean) =>
    found
      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
      : 'bg-transparent text-zinc-600 border-zinc-700';

  return (
    <div className="flex-1 flex flex-col gap-4 w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 tabular-nums">{t('round_x_of_y', { current: currentRound, total: totalRounds })}</span>
        <div className="flex items-center gap-3">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className={`text-3xl font-bold tabular-nums ${timeLeft != null && timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}
          >
            {timeLeft ?? '--'}
          </motion.span>
          {isAdmin ? (
            <button onClick={onSkipVote} disabled={skipCooldown} className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('skip')}
            </button>
          ) : (
            <button
              onClick={hasVotedSkip ? undefined : onSkipVote}
              disabled={hasVotedSkip || skipCooldown}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                hasVotedSkip || skipCooldown
                  ? 'bg-zinc-800 text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {hasVotedSkip ? `${t('voted')} ${skipVotes}/${skipVotesNeeded}` : `${t('vote_skip')} ${skipVotes}/${skipVotesNeeded}`}
            </button>
          )}
        </div>
      </div>

      <MiniViz progress={(smoothTime ?? 0) / (roundDuration || 15)} />

      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-none"
          style={{ width: `${roundDuration > 0 ? ((smoothTime ?? 0) / roundDuration) * 100 : 0}%` }}
        />
      </div>

      <div className="flex gap-2">
        <div className={`flex-1 text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${pillStyle(artistFound)}`}>
          Artist {!artistFound && <span className="text-zinc-600">?</span>}
        </div>
        <div className={`flex-1 text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${pillStyle(titleFound)}`}>
          Title {!titleFound && <span className="text-zinc-600">?</span>}
        </div>
      </div>

      <div className="relative">
        <div className={`absolute -inset-1 rounded-2xl ${bothFound ? 'bg-green-500/20' : 'bg-[var(--primary)]/10'} blur-lg transition-all duration-500`} />
        <input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={e => onGuessChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !bothFound && onSubmit()}
          placeholder={placeholder}
          disabled={bothFound}
          autoComplete="off"
          className={`relative w-full px-5 py-4 bg-[var(--surface)] border-2 rounded-2xl text-white text-lg text-center placeholder-zinc-500 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            bothFound
              ? 'border-green-500/50'
              : 'border-[var(--primary)]/30 focus:border-[var(--primary)]'
          }`}
        />
      </div>

      {guessResult && (() => {
        const pts = guessResult.points_awarded_this_guess || 0;
        const succeeded = pts > 0;
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-2 rounded-xl text-center text-xs ${
              succeeded
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            <span className="font-semibold">{succeeded ? `+${pts} pts` : 'Wrong!'}</span>
            {guessResult.artist_score != null && (
              <span className="ml-2 text-zinc-500">A:{guessResult.artist_score}%</span>
            )}
            {guessResult.title_score != null && (
              <span className="ml-1 text-zinc-500">T:{guessResult.title_score}%</span>
            )}
            {guessResult.guessTimeMs != null && (
              <span className="ml-2 text-zinc-600">{(guessResult.guessTimeMs / 1000).toFixed(1)}s</span>
            )}
          </motion.div>
        );
      })()}
      {encouragement && (
        <motion.p
          key={encouragement}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs text-zinc-500 italic text-center"
        >
          {encouragement}
        </motion.p>
      )}
    </div>
  );
}

function MiniViz({ progress }: { progress: number }) {
  const pct = Math.min(100, progress * 100);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, []);
  const bars = 32;
  return (
    <div className="flex items-end justify-center gap-[1px] h-12 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const barPct = (i / bars) * 100;
        const active = barPct <= pct;
        const h = active
          ? 30 + Math.sin(i * 1.7 + tick * 0.15) * 20 + 15
          : 15 + Math.sin(i * 1.7 + tick * 0.1) * 8;
        return (
          <div
            key={i}
            className="flex-1 min-w-[2px] rounded-t-sm"
            style={{
              height: `${h}%`,
              background: active
                ? `hsl(${260 + i * 5}, 70%, ${48 + Math.sin(i * 0.8 + tick * 0.05) * 12}%)`
                : `hsl(${260 + i * 5}, 20%, 25%)`,
              transition: 'height 50ms linear',
            }}
          />
        );
      })}
    </div>
  );
}

function RoundResult({ data, players = [], pauseTimeLeft, trackHistory = [] }: { data?: { correctAnswer?: string; artist?: string; albumImage?: string; skipped?: boolean } | null; players?: { name: string; score: number }[]; pauseTimeLeft: number; trackHistory?: { round: number; name: string; artist: string; albumImage?: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center gap-5 max-w-sm mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center gap-4"
      >
        {data?.skipped && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            ⏭ Skipped
          </span>
        )}
        {data?.albumImage && (
          <img
            src={data.albumImage}
            alt=""
            className="w-40 h-40 md:w-48 md:h-48 rounded-2xl shadow-2xl object-cover border border-white/10"
          />
        )}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">{data?.correctAnswer || 'Unknown Track'}</h2>
          <p className="text-sm text-zinc-400 mt-1">{data?.artist || 'Unknown Artist'}</p>
        </div>
      </motion.div>

      <div className="w-full space-y-1">
        {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface)] rounded-xl border border-white/5"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
              <span className="text-sm font-medium">{p.name}</span>
            </div>
            <span className="text-sm font-bold text-[var(--accent)]">{p.score} pts</span>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-xs text-zinc-500">{t('next_round_in')}</p>
        <motion.p
          key={pauseTimeLeft}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold tabular-nums"
        >
          {pauseTimeLeft}
        </motion.p>
      </div>
    </div>
  );
}

// GameFinished replaced by Podium component