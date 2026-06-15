'use client';

import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { io as socketIo, Socket } from 'socket.io-client';
import { getToken, GameState, Player, RoomSettings, startGame, updateSettings, fetchGenres, fetchGenreGroups, joinRoom, getFriends, sendInvite } from '@/lib/api';
import { isDebugMode } from '@/lib/debug-context';
import AudioPlayer, { AudioPlayerHandle } from '@/app/components/AudioPlayer';
import { useSettings } from '@/app/context/SettingsContext';
import { useTranslation } from '@/lib/useTranslation';
import Chat from './Chat';
import Podium from './Podium';
import DebugOverlay from './DebugOverlay';
import { useSound } from '@/lib/useSound';
import { getProxiedUrl } from '@/lib/proxy';
import { isDiscordActivity, getDiscordSdk, subscribeToParticipants, getConnectedParticipants, getInstanceId, getDiscordRelationships, inviteDiscordUser, openDiscordInviteDialog } from '@/lib/discordActivity';
import type { DiscordParticipant, DiscordRelationship } from '@/lib/discordActivity';
import { updateRichPresence, clearRichPresence } from '@/lib/discordRichPresence';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

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

  useEffect(() => {
    if (gameState?.state !== 'waiting') return;
    const handleBeforeUnload = () => {
      localStorage.removeItem(`blindtest_player_${code}`);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [code, gameState?.state]);

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
      // Logged in but no stored player ID for this room: perform automatic registration
      joinRoom(code)
        .then(({ playerId: newPid }) => {
          localStorage.setItem(`blindtest_player_${code}`, newPid);
          setPlayerId(newPid);
        })
        .catch((err) => {
          console.error("Failed to automatically join lobby:", err);
          router.push('/');
        });
      return;
    }
    setPlayerId(pid);
  }, [code, router]);

  useEffect(() => {
    if (!playerId) return;

    const connectionUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? window.location.origin
      : API_URL;
    const socket = socketIo(connectionUrl);
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
      const isStillInRoom = state.players.some(p => p.id === playerId);
      if (!isStillInRoom) {
        joinRoom(code)
          .then(({ playerId: newPid }) => {
            localStorage.setItem(`blindtest_player_${code}`, newPid);
            setPlayerId(newPid);
          })
          .catch(() => {
            router.push('/');
          });
        return;
      }

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

  useEffect(() => {
    if (!isDiscordActivity()) return;
    const sdk = getDiscordSdk();
    updateRichPresence(sdk, gameState, playerId);
  }, [gameState, playerId]);

  useEffect(() => {
    return () => {
      if (isDiscordActivity()) {
        clearRichPresence(getDiscordSdk());
      }
    };
  }, []);

  const [discordParticipants, setDiscordParticipants] = useState<DiscordParticipant[]>([]);

  useEffect(() => {
    if (!isDiscordActivity()) return;
    getConnectedParticipants().then(setDiscordParticipants);
    const unsub = subscribeToParticipants(setDiscordParticipants);
    return unsub;
  }, []);

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

  const handleArtistsUpdate = useCallback(async (artists: string[]) => {
    try {
      await updateSettings(code, playerId, { artists });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update artists');
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
        <p className="text-foreground/60 text-lg">{t('connecting')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <p className="text-foreground/40 text-sm">Server: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}</p>
        <button onClick={() => router.push('/')} className="px-6 py-3 bg-[var(--primary)] text-foreground rounded-xl">
          {t('back_home')}
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-foreground/60 text-lg">{t('connecting_to_game')}</p>
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
            className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-foreground/40 hover:text-foreground/80 transition-colors"
          >
            {t('copy')}
          </button>
          {gameState.state === 'waiting' && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-foreground/40">
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
            <span className="text-xs text-foreground/30">Round {gameState.currentRound}/{gameState.totalRounds}</span>
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
                  className="text-foreground/60 hover:text-foreground/90 transition-colors p-1"
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
                className="md:hidden text-[10px] px-2 py-0.5 rounded bg-white/5 text-foreground/60 hover:text-foreground/80 transition-colors"
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
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-2">{t('players_label') || 'Players'}</p>
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
                    <span className="truncate flex-1 text-foreground/80">{p.name}</span>
                    <span className="text-[var(--accent)] font-bold tabular-nums shrink-0">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {((gameState as any)?.trackHistory?.length > 0) && (
              <div className="flex-1 min-h-0 flex flex-col">
                <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-2">{t('history_label')}</p>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {[...((gameState as any)?.trackHistory || [])].reverse().map((t: any, idx: number) => (
                    <div
                      key={t.round}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${t.skipped ? 'opacity-50' : ''} ${
                        idx === 0 ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-white/[0.03]'
                      }`}
                    >
                      {t.skipped && <span className="text-foreground/40">⏭</span>}
                      {t.albumImage && (
                        <img src={getProxiedUrl(t.albumImage)} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium truncate leading-tight ${t.skipped ? 'line-through text-foreground/40' : ''}`}>{t.name}</p>
                        <p className="text-foreground/40 truncate leading-tight">
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
              artists={'artists' in gameState ? gameState.artists : []}
              hostId={gameState.hostId}
              playerId={playerId}
              onStart={handleStart}
              onSettingsChange={handleSettingsUpdate}
              onGenresChange={handleGenresUpdate}
              onArtistsChange={handleArtistsUpdate}
              onKickPlayer={(pid) => socketRef.current?.emit('kick_player', pid)}
              onTransferHost={(pid) => socketRef.current?.emit('transfer_host', pid)}
              startLoading={startLoading}
              discordParticipants={discordParticipants}
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
               currentTrackId={gameState.state === 'playing' ? (gameState as any).trackId : null}
               onFlagSong={(id) => socketRef.current?.emit('flag_song', id)}
            />
          )}

          {gameState.state === 'round_result' && (
            <RoundResult data={gameState.roundResult} players={gameState.players} pauseTimeLeft={(gameState as any).pauseTimeLeft} trackHistory={(gameState as any).trackHistory} onFlag={(id) => socketRef.current?.emit('flag_song', id)} />
          )}

          {gameState.state === 'game_over' && (
            <Podium code={code} rankings={gameState.rankings} playerId={playerId} onPlayAgain={handlePlayAgain} />
          )}
        </div>

        {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
          <div className={`${chatOpen ? 'fixed inset-0 z-40 bg-black/80 md:bg-transparent md:static flex items-end md:block' : 'hidden md:block'} w-64 shrink-0`}>
            <div className="w-full md:w-64 bg-[var(--surface)] md:bg-transparent rounded-t-2xl md:rounded-none md:h-auto max-h-[60vh] md:max-h-none overflow-y-auto">
              {chatOpen && (
                <button onClick={() => setChatOpen(false)} className="md:hidden w-full text-center py-2 text-xs text-foreground/40 border-b border-white/5">
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
            <p className="text-xl font-bold text-foreground">Tap to enable audio</p>
            <p className="text-sm text-foreground/60">Your browser needs a tap to play sound</p>
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/60">{label}</span>
        <span className="text-xs font-semibold text-[var(--primary)] tabular-nums bg-[var(--primary)]/5 px-2 py-0.5 rounded border border-[var(--primary)]/15">{value}{suffix}</span>
      </div>
      {isHost ? (
        <input
          type="range" min={min} max={max} step="1"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] hover:bg-white/10 transition-colors"
        />
      ) : (
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
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
  artists,
  hostId,
  playerId,
  onStart,
  onSettingsChange,
  onGenresChange,
  onArtistsChange,
  onKickPlayer,
  onTransferHost,
  startLoading,
  discordParticipants,
}: {
  gameCode: string;
  players: { id: string; name: string; avatarUrl?: string | null; role?: string }[];
  settings: RoomSettings;
  genres: string[];
  artists: string[];
  hostId?: string | null;
  playerId: string;
  onStart: () => void;
  onSettingsChange: (s: Partial<RoomSettings>) => void;
  onGenresChange: (g: string[]) => void;
  onArtistsChange: (a: string[]) => void;
  onKickPlayer?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;
  startLoading?: boolean;
  discordParticipants: DiscordParticipant[];
}) {
  const { t } = useTranslation();
  const isHost = playerId === hostId;
  const [allGenres, setAllGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [genreGroups, setGenreGroups] = useState<{ id: string; genreIds: string[] }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedArtistGroups, setExpandedArtistGroups] = useState<Set<string>>(new Set());
  const [artistGroups, setArtistGroups] = useState<{ id: string; name: string; artists: string[] }[]>([]);

  useEffect(() => {
    import('@/lib/api').then(({ getArtistGroups }) => {
      getArtistGroups().then(setArtistGroups).catch(() => {});
    });
  }, []);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [modalLoading, setModalLoading] = useState(false);
  const [discordRelationships, setDiscordRelationships] = useState<DiscordRelationship[]>([]);
  const [discordInvitedIds, setDiscordInvitedIds] = useState<Set<string>>(new Set());
  const discordCtx = isDiscordActivity();

  useEffect(() => {
    if (showInviteModal) {
      setModalLoading(true);
      Promise.all([
        getFriends().then(d => setFriendsList(d.friends || [])).catch(() => {}),
        discordCtx ? getDiscordRelationships().then(setDiscordRelationships).catch(() => {}) : Promise.resolve(),
      ]).finally(() => setModalLoading(false));
    }
  }, [showInviteModal]);

  const handleSendInvite = async (friendId: string) => {
    try {
      await sendInvite(gameCode, friendId);
      setInvitedIds(prev => {
        const next = new Set(prev);
        next.add(friendId);
        return next;
      });
      setTimeout(() => {
        setInvitedIds(prev => {
          const next = new Set(prev);
          next.delete(friendId);
          return next;
        });
      }, 3000);
    } catch (err) {
      console.error('Failed to send invite:', err);
    }
  };

  const handleDiscordInvite = async (userId: string) => {
    const ok = await inviteDiscordUser(userId, `Join me in BlindTest! Room code: ${gameCode}`);
    if (ok) {
      setDiscordInvitedIds(prev => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      setTimeout(() => {
        setDiscordInvitedIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 3000);
    }
  };

  useEffect(() => {
    fetchGenreGroups().then(data => {
      setGenreGroups(data?.groups || []);
      setAllGenres(data?.genres || []);
    }).catch(() => {
      fetchGenres().then(genres => setAllGenres(genres || [])).catch(() => {});
    });
  }, []);

  const toggleGenre = (id: string) => {
    const set = new Set(genres);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onGenresChange(Array.from(set));
  };

  const toggleArtist = (name: string) => {
    const set = new Set(artists);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    onArtistsChange(Array.from(set));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleArtistGroup = (groupId: string) => {
    setExpandedArtistGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleGroupGenres = (groupGenreIds: string[], select: boolean) => {
    const set = new Set(genres);
    for (const id of groupGenreIds) {
      if (select) set.add(id);
      else set.delete(id);
    }
    onGenresChange(Array.from(set));
  };

  const allGenreIds = allGenres.map(g => g.id);
  const genreMap = new Map(allGenres.map(g => [g.id, g]));

  return (
    <div className="flex-1 flex flex-col items-center gap-6 overflow-y-auto pb-24 md:pb-8 w-full max-w-4xl mx-auto px-4">
      {/* Title Header */}
      <div className="text-center space-y-1.5 mt-2 mb-1 flex flex-col items-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Game Lobby
        </h2>
        <p className="text-xs text-foreground/40 font-medium">
          Invite friends by sharing the lobby code above
        </p>
        <button
          onClick={() => setShowInviteModal(true)}
          className="mt-2 text-xs px-3.5 py-1.5 bg-surface-light hover:bg-surface-light border border-white/5 hover:border-white/10 rounded-xl text-foreground/80 hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer font-bold shadow-md animate-fade-in"
        >
          <svg className="w-3.5 h-3.5 text-[var(--primary)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite Friends
        </button>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-6 md:gap-8 items-start">
        {/* Left Column: Players List */}
        <div className="w-full bg-[var(--surface)] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-semibold text-foreground/90">{t('players')}</span>
            </div>
            <span className="text-xs text-foreground/40 font-medium bg-white/5 px-2.5 py-1 rounded-full tabular-nums">
              {players.length} {players.length === 1 ? 'player' : 'players'}
            </span>
          </div>

          {discordParticipants.length > 0 && (
            <div className="pb-2 border-b border-white/5 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                </svg>
                <span className="text-xs font-semibold text-foreground/70">Discord Voice</span>
                <span className="text-[10px] text-foreground/40 bg-white/5 px-2 py-0.5 rounded-full tabular-nums">
                  {discordParticipants.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {discordParticipants.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-lg text-[11px] text-foreground/80">
                    <span className="w-4 h-4 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[8px] font-bold shrink-0">
                      {p.global_name?.[0] || p.username[0]?.toUpperCase() || '?'}
                    </span>
                    <span className="truncate max-w-[100px]">{p.global_name || p.username}</span>
                    {players.some(pl => pl.name === p.username || pl.name === p.global_name) && (
                      <span className="text-[8px] text-emerald-400/80 ml-0.5">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {players.map((p, i) => (
              <div
                key={p.id}
                className="group relative flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.03] rounded-xl transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.04] hover:border-white/10 shadow-sm"
              >
                {/* Avatar with Ring */}
                <div className="relative">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`w-9 h-9 rounded-full object-cover shadow-md transition-all ${
                        p.id === hostId ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]' : 'ring-1 ring-white/10'
                      }`}
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-foreground shadow-md transition-all ${
                        p.id === hostId ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--surface)] bg-gradient-to-br from-primary to-accent' : 'bg-surface-light border border-white/10'
                      }`}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                  )}
                  {p.id === hostId && (
                    <span className="absolute -top-1 -left-1 text-[10px] bg-[var(--primary)] text-foreground rounded-full p-0.5 shadow-md">
                      👑
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-foreground/90 text-sm truncate flex items-center gap-1.5">
                    {p.name}
                    {p.role === 'admin' && (
                      <span className="rounded-full bg-[#00cec9]/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#00cec9] border border-[#00cec9]/30">
                        ADMIN
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    {p.id === playerId ? 'You' : p.id === hostId ? 'Host' : 'Ready'}
                  </span>
                </div>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                  {p.id !== hostId && playerId === hostId && onTransferHost && (
                    <button
                      onClick={() => onTransferHost(p.id)}
                      className="text-[10px] px-2.5 py-1 rounded bg-surface-light hover:bg-surface-light text-foreground/80 font-medium border border-white/5 transition-all cursor-pointer"
                    >
                      Make Host
                    </button>
                  )}
                  {(playerId === hostId || p.role === 'admin') && onKickPlayer && p.id !== playerId && (
                    <button
                      onClick={() => onKickPlayer(p.id)}
                      className="text-[10px] px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium border border-red-500/20 transition-all cursor-pointer"
                    >
                      Kick
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Settings & Genres */}
        <div className="w-full bg-[var(--surface)] rounded-2xl p-5 border border-white/5 space-y-5 shadow-xl backdrop-blur-md">
          <div className="pb-2 border-b border-white/5">
            <h3 className="text-sm font-semibold text-foreground/90">{t('settings')}</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4 bg-white/5 p-1 rounded-xl">
                <button
                  onClick={() => isHost && onSettingsChange({ gameMode: 'genre' })}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    settings.gameMode === 'genre'
                      ? 'bg-[var(--primary)] text-foreground shadow-md'
                      : 'text-foreground/50 hover:text-foreground/80'
                  } ${!isHost && 'pointer-events-none'}`}
                >
                  Genres
                </button>
                <button
                  onClick={() => isHost && onSettingsChange({ gameMode: 'artist' })}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    settings.gameMode === 'artist'
                      ? 'bg-[var(--primary)] text-foreground shadow-md'
                      : 'text-foreground/50 hover:text-foreground/80'
                  } ${!isHost && 'pointer-events-none'}`}
                >
                  Artists
                </button>
              </div>

              {settings.gameMode === 'genre' ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground/60">{t('genres')}</label>
                    {isHost && genreGroups.length > 0 && (
                      <button
                        onClick={() => {
                          if (genres.length === allGenreIds.length && allGenreIds.length > 0) {
                            onGenresChange([]);
                          } else {
                            onGenresChange([...allGenreIds]);
                          }
                        }}
                        className="text-[10px] px-2.5 py-1 rounded bg-white/5 text-foreground/60 hover:bg-white/10 hover:text-foreground transition-colors border border-white/5 cursor-pointer font-medium"
                      >
                        {genres.length === allGenreIds.length && allGenreIds.length > 0 ? t('clear_btn') : t('all_btn')}
                      </button>
                    )}
                  </div>

              {genreGroups.length === 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5">
                  {allGenres.map(g => {
                    const selected = genres.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => isHost && toggleGenre(g.id)}
                        className={`px-2 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                          selected
                            ? 'bg-gradient-to-r from-primary to-accent text-foreground border-transparent shadow-md shadow-primary/10 scale-100 hover:brightness-110 active:scale-95'
                            : 'bg-white/[0.02] text-foreground/60 border-white/5 hover:bg-white/[0.06] hover:text-foreground/90 hover:border-white/10 active:scale-95'
                        } ${!isHost ? 'opacity-80 cursor-default pointer-events-none' : 'cursor-pointer'}`}
                      >
                        {t(`genre_${g.id}`)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {genreGroups.map(group => {
                    const groupGenres = group.genreIds.map(id => genreMap.get(id)).filter(Boolean) as { id: string; label: string; group?: string }[];
                    if (groupGenres.length === 0) return null;
                    const isCollapsed = !expandedGroups.has(group.id);
                    const allSelected = groupGenres.every(g => genres.includes(g.id));
                    const someSelected = groupGenres.some(g => genres.includes(g.id));
                    return (
                      <div key={group.id} className="border border-white/5 rounded-xl bg-white/[0.01] overflow-hidden transition-all duration-300 hover:border-white/10 hover:bg-white/[0.02]">
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${someSelected ? 'bg-[var(--primary)]' : 'bg-foreground/30'} transition-all`} />
                            {t(`group_${group.id}`)}
                          </span>
                          <div className="flex items-center gap-2.5">
                            {isHost && (
                              <span
                                onClick={(e) => { e.stopPropagation(); toggleGroupGenres(group.genreIds, !allSelected); }}
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer ${
                                  allSelected
                                    ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/35'
                                    : someSelected
                                      ? 'bg-white/10 text-foreground/60 border border-white/10 hover:bg-white/20'
                                      : 'bg-white/5 text-foreground/40 border border-transparent hover:bg-white/10'
                                }`}
                              >
                                {allSelected ? t('clear_btn') : t('all_btn')}
                              </span>
                            )}
                            <svg
                              className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        <motion.div
                          initial={false}
                          animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.03]">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5">
                              {groupGenres.map(g => {
                                const selected = genres.includes(g.id);
                                return (
                                  <button
                                    key={g.id}
                                    onClick={() => isHost && toggleGenre(g.id)}
                                    className={`px-2 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                                      selected
                                        ? 'bg-gradient-to-r from-primary to-accent text-foreground border-transparent shadow-md shadow-primary/10 scale-100 hover:brightness-110 active:scale-95'
                                        : 'bg-white/[0.02] text-foreground/60 border-white/5 hover:bg-white/[0.06] hover:text-foreground/90 hover:border-white/10 active:scale-95'
                                    } ${!isHost ? 'opacity-80 cursor-default pointer-events-none' : 'cursor-pointer'}`}
                                  >
                                    {t(`genre_${g.id}`)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custom Genres Display & Input */}
              {(() => {
                const customSelectedGenres = genres.filter(g => !allGenreIds.includes(g));
                return (
                  <div className="space-y-3 pt-3.5 mt-3.5 border-t border-white/5">
                    {customSelectedGenres.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold tracking-wider uppercase text-foreground/40">Custom Selected Genres</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customSelectedGenres.map(g => (
                            <div
                              key={g}
                              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 text-accent border border-accent/20 rounded-full text-[11px] font-semibold animate-slide-up"
                            >
                              <span className="truncate max-w-[150px]">{g}</span>
                              {isHost && (
                                <button
                                  onClick={() => toggleGenre(g)}
                                  className="hover:text-rose-400 p-0.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                                  title="Remove custom genre"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isHost && (
                      <div className="space-y-1.5">
                        <label htmlFor="custom-genre-input" className="text-[10px] font-semibold tracking-wider uppercase text-foreground/40">Add Custom Genre</label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            const input = form.elements.namedItem('customGenre') as HTMLInputElement;
                            const value = input?.value?.trim().toLowerCase();
                            if (value && !genres.includes(value)) {
                              onGenresChange([...genres, value]);
                              input.value = '';
                            }
                          }}
                          className="flex gap-2"
                        >
                          <input
                            id="custom-genre-input"
                            name="customGenre"
                            type="text"
                            placeholder="e.g. synthwave, lofi, anime..."
                            maxLength={30}
                            className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-foreground font-semibold rounded-xl border border-white/5 transition-all text-xs cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })()}
              </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground/60">Selected Artists</label>
                    {isHost && artists.length > 0 && (
                      <button
                        onClick={() => onArtistsChange([])}
                        className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 hover:text-red-400 transition-colors px-2 py-0.5 rounded cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {artists.length === 0 && <span className="text-xs text-foreground/30 italic">No artists selected...</span>}
                    {artists.map(a => (
                      <div
                        key={a}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 rounded-full text-[11px] font-semibold animate-slide-up"
                      >
                        <span className="truncate max-w-[150px]">{a}</span>
                        {isHost && (
                          <button
                            onClick={() => toggleArtist(a)}
                            className="hover:text-red-400 p-0.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                            title="Remove artist"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isHost && (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      {artistGroups.map(group => {
                        if (group.artists.length === 0) return null;
                        const isCollapsed = !expandedArtistGroups.has(group.id);
                        const allSelected = group.artists.every(a => artists.includes(a));
                        const someSelected = group.artists.some(a => artists.includes(a));
                        return (
                          <div key={group.id} className="border border-white/5 rounded-xl bg-white/[0.01] overflow-hidden transition-all duration-300 hover:border-white/10 hover:bg-white/[0.02]">
                            <button
                              onClick={() => toggleArtistGroup(group.id)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${someSelected ? 'bg-[var(--primary)]' : 'bg-foreground/30'} transition-all`} />
                                {group.name}
                              </span>
                              <div className="flex items-center gap-2.5">
                                {isHost && (
                                  <span
                                    onClick={(e) => { e.stopPropagation(); onArtistsChange(allSelected ? artists.filter(a => !group.artists.includes(a)) : Array.from(new Set([...artists, ...group.artists]))); }}
                                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer ${
                                      allSelected
                                        ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/35'
                                        : someSelected
                                          ? 'bg-white/10 text-foreground/60 border border-white/10 hover:bg-white/20'
                                          : 'bg-white/5 text-foreground/40 border border-transparent hover:bg-white/10'
                                    }`}
                                  >
                                    {allSelected ? 'Clear' : 'All'}
                                  </span>
                                )}
                                <svg
                                  className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            <motion.div
                              initial={false}
                              animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.03]">
                                <div className="flex flex-wrap gap-1.5">
                                  {group.artists.map(artist => {
                                    const selected = artists.includes(artist);
                                    return (
                                      <button
                                        key={artist}
                                        onClick={() => toggleArtist(artist)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                                          selected
                                            ? 'bg-gradient-to-r from-primary to-accent text-foreground border-transparent shadow-md shadow-primary/10 scale-100 hover:brightness-110 active:scale-95'
                                            : 'bg-white/[0.02] text-foreground/60 border-white/5 hover:bg-white/[0.06] hover:text-foreground/90 hover:border-white/10 active:scale-95'
                                        } cursor-pointer`}
                                      >
                                        {artist}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-3 pt-3.5 mt-3.5 border-t border-white/5">
                    {(() => {
                      const allArtistList = artistGroups.flatMap(g => g.artists);
                      const customSelectedArtists = artists.filter(a => !allArtistList.includes(a));
                      return (
                        <>
                          {customSelectedArtists.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {customSelectedArtists.map(a => (
                                <div
                                  key={a}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] border border-dashed border-white/10 rounded-full text-[11px] font-semibold text-foreground/70"
                                >
                                  <span>{a}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {isHost && (
                            <div className="space-y-1.5">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget;
                                  const input = form.elements.namedItem('customArtist') as HTMLInputElement;
                                  const value = input?.value?.trim();
                                  if (value && !artists.some(a => a.toLowerCase() === value.toLowerCase())) {
                                    onArtistsChange([...artists, value]);
                                    input.value = '';
                                  }
                                }}
                                className="flex gap-2"
                              >
                                <input
                                  name="customArtist"
                                  type="text"
                                  placeholder="e.g. Daft Punk, Taylor Swift..."
                                  maxLength={50}
                                  className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                                />
                                <button
                                  type="submit"
                                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-foreground font-semibold rounded-xl border border-white/5 transition-all text-xs cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                                >
                                  Add
                                </button>
                              </form>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <SliderSetting label={t('rounds')} value={settings.rounds} min={3} max={25} isHost={isHost} onChange={v => onSettingsChange({ rounds: v })} />
            <SliderSetting label={t('time_per_round')} value={settings.roundTime} min={8} max={30} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ roundTime: v })} />
            <SliderSetting label={t('pause_between')} value={settings.pauseTime} min={2} max={15} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ pauseTime: v })} />

            {isHost && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground/80">{t('auto_start')}</span>
                    <p className="text-[10px] text-foreground/40 max-w-[200px] leading-relaxed">{t('auto_start_desc')}</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ autoStart: !settings.autoStart })}
                    className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-all duration-300 ease-out focus:outline-none cursor-pointer ${
                      settings.autoStart
                        ? 'bg-gradient-to-r from-primary to-accent shadow-md shadow-primary/10'
                        : 'bg-surface-light border border-white/5'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ease-out ${
                        settings.autoStart ? 'left-[23px] scale-110' : 'left-[3px] scale-100 bg-foreground/60'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lobby CTA Area */}
      <div className="w-full flex flex-col items-center gap-3 pt-4 pb-8 max-w-xl">
        {isHost ? (
          <button
            onClick={onStart}
            disabled={startLoading || (settings.gameMode === 'genre' && (!genres || genres.length === 0)) || (settings.gameMode === 'artist' && (!artists || artists.length === 0))}
            className={`px-12 py-4 text-foreground font-bold rounded-xl transition-all duration-300 shadow-lg cursor-pointer ${
              ((settings.gameMode === 'genre' && genres && genres.length > 0) || (settings.gameMode === 'artist' && artists && artists.length > 0)) && !startLoading
                ? 'bg-gradient-to-r from-primary to-accent hover:brightness-110 hover:shadow-primary/25 hover:scale-[1.03] active:scale-[0.98]'
                : 'bg-surface-light text-foreground/40 border border-white/5 opacity-50 cursor-not-allowed'
            }`}
          >
            {startLoading ? 'Starting...' : ((settings.gameMode === 'genre' && genres && genres.length > 0) || (settings.gameMode === 'artist' && artists && artists.length > 0)) ? t('start_game') : 'Select to start'}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-foreground/60 text-sm font-medium bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-full shadow-inner animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)]"></span>
            </span>
            Waiting for the host to start...
          </div>
        )}
      </div>

      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-background border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[80vh] text-foreground"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-bold text-foreground/90 uppercase tracking-wider">Add Players</h3>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-foreground/40 font-medium">Loading...</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
                  {discordCtx && (
                    <button
                      onClick={() => { openDiscordInviteDialog(); }}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-blurple/10 hover:bg-blurple/20 border border-blurple/20 hover:border-blurple/30 rounded-2xl text-xs font-bold text-blurple transition-all cursor-pointer mb-3"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0778.0778 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                      </svg>
                      Share Invite Link
                    </button>
                  )}

                  {players.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">In This Room ({players.length})</p>
                      {players.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center font-bold border border-white/10 overflow-hidden shadow-inner text-xs">
                                {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : p.name[0].toUpperCase()}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background bg-emerald-500" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-bold text-xs text-foreground/90">{p.name}</p>
                              <p className="text-[9px] text-emerald-400 font-semibold">In Room</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {discordRelationships.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1 pt-2">Discord Friends</p>
                      {discordRelationships.map(r => {
                        const name = r.user.global_name || r.user.username;
                        const isInRoom = players.some(p => p.name === name || p.name === r.user.username);
                        const isInvited = discordInvitedIds.has(r.user.id);
                        const status = r.presence?.status || 'offline';
                        const isOnline = status !== 'offline';
                        return (
                          <div key={r.user.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm hover:bg-white/[0.04] transition-all">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-blurple/20 flex items-center justify-center font-bold border border-blurple/20 overflow-hidden shadow-inner text-xs text-blurple">
                                  {name[0].toUpperCase()}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-foreground/20'}`} />
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-xs text-foreground/90">{name}</p>
                                <p className="text-[9px] text-foreground/40 font-semibold capitalize">{status}</p>
                              </div>
                            </div>
                            {isInRoom ? (
                              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">In Room</span>
                            ) : (
                              <button
                                disabled={isInvited}
                                onClick={() => handleDiscordInvite(r.user.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isInvited
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-blurple hover:bg-blurple/80 text-white shadow shadow-blurple/20 active:scale-95'
                                }`}
                              >
                                {isInvited ? 'Invited!' : 'Add to Activity'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {friendsList.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1 pt-2">Friends</p>
                      {friendsList.map(f => {
                        const presence = f.presence || { status: 'offline', roomCode: null };
                        const isOnline = presence.status !== 'offline';
                        const statusText = isOnline ? (presence.status === 'lobby' ? 'In Lobby' : 'In Game') : 'Offline';
                        const isInvited = invitedIds.has(f.id);
                        const alreadyInRoom = players.some(p => p.name === f.username || p.name === f.display_name || p.id === f.id);

                        if (alreadyInRoom) return null;

                        return (
                          <div key={f.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm hover:bg-white/[0.04] transition-all">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center font-bold border border-white/10 overflow-hidden shadow-inner text-xs">
                                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : f.username[0].toUpperCase()}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-foreground/20'}`} />
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-xs text-foreground/90">{f.username}</p>
                                <p className="text-[9px] text-foreground/40 font-semibold">{statusText}</p>
                              </div>
                            </div>
                            <button
                              disabled={isInvited}
                              onClick={() => handleSendInvite(f.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isInvited
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                  : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-foreground shadow shadow-primary/20 active:scale-95'
                              }`}
                            >
                              {isInvited ? 'Invited!' : 'Invite'}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {discordRelationships.length === 0 && friendsList.length === 0 && players.length === 0 && (
                    <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                      <p className="text-foreground/20 text-xs">No players or friends yet.</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-foreground/80 hover:text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
    return { text: t('guessing_label'), cls: 'text-foreground/30' };
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
        <p className="text-xs text-foreground/40 uppercase tracking-wider mb-2 text-center">{t('players')}</p>
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

      <p className="text-sm text-foreground/40">{t('round_x_of_y', { current: currentRound, total: totalRounds })}</p>

      {players.length > 0 && (
        <div className="flex items-center gap-2">
          {playerId === hostId ? (
            <button onClick={onSkipVote} disabled={skipCooldown} className="px-3 py-1.5 text-xs bg-surface-light hover:bg-surface-light text-foreground/80 rounded-lg border border-surface-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('skip')}
            </button>
          ) : (
            <button
              onClick={hasVotedSkip ? undefined : onSkipVote}
              disabled={hasVotedSkip || skipCooldown}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                hasVotedSkip || skipCooldown
                  ? 'bg-surface-light text-foreground/30 border-surface-light cursor-not-allowed'
                  : 'bg-surface-light hover:bg-surface-light text-foreground/80 border-surface-light'
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
  currentTrackId,
  onFlagSong,
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
  currentTrackId?: string | null;
  onFlagSong?: (id: string) => void;
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
  const [showSkipReasons, setShowSkipReasons] = useState(false);

  const handleSkipClick = () => {
    if (hasVotedSkip || skipCooldown) return;
    if (state === 'playing') {
      setShowSkipReasons(true);
    } else {
      onSkipVote();
    }
  };

  const handleSkipWithReason = (reason: string) => {
    setShowSkipReasons(false);
    if (reason === 'wrong_song' && currentTrackId && onFlagSong) {
      onFlagSong(currentTrackId);
    }
    onSkipVote();
  };

  const playerStatus = (p: any) => {
    if (p.foundBoth) return 'found';
    if (p.foundArtist || p.foundTitle) return 'partial';
    return 'guessing';
  };

  const pillStyle = (found: boolean) =>
    found
      ? 'bg-[var(--primary)] text-foreground border-[var(--primary)]'
      : 'bg-transparent text-foreground/30 border-surface-light';

  return (
    <div className="flex-1 flex flex-col gap-4 w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/40 tabular-nums">{t('round_x_of_y', { current: currentRound, total: totalRounds })}</span>
        <div className="flex items-center gap-3">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className={`text-3xl font-bold tabular-nums ${timeLeft != null && timeLeft <= 5 ? 'text-red-400' : 'text-foreground'}`}
          >
            {timeLeft ?? '--'}
          </motion.span>
          {isAdmin ? (
            <button onClick={handleSkipClick} disabled={skipCooldown} className="px-3 py-1.5 text-xs bg-surface-light hover:bg-surface-light text-foreground/80 rounded-lg border border-surface-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('skip')}
            </button>
          ) : (
            <button
              onClick={hasVotedSkip || skipCooldown ? undefined : handleSkipClick}
              disabled={hasVotedSkip || skipCooldown}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                hasVotedSkip || skipCooldown
                  ? 'bg-surface-light text-foreground/30 border-surface-light cursor-not-allowed'
                  : 'bg-surface-light hover:bg-surface-light text-foreground/80 border-surface-light'
              }`}
            >
              {hasVotedSkip ? `${t('voted')} ${skipVotes}/${skipVotesNeeded}` : `${t('vote_skip')} ${skipVotes}/${skipVotesNeeded}`}
            </button>
          )}

          {showSkipReasons && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSkipReasons(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-background border border-white/10 rounded-2xl p-5 w-full max-w-xs shadow-2xl flex flex-col gap-2"
                onClick={e => e.stopPropagation()}
              >
                <p className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-1">Why skip?</p>
                <button onClick={() => handleSkipWithReason('wrong_song')} className="w-full text-left px-3.5 py-2.5 bg-white/[0.02] hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl text-xs font-semibold text-foreground/80 hover:text-red-400 transition-all cursor-pointer flex items-center gap-2.5">
                  <span className="text-base">🚩</span>
                  <div><span className="block">Wrong Song</span><span className="text-[10px] text-foreground/40 font-normal">Flag as incorrect &amp; skip</span></div>
                </button>
                <button onClick={() => handleSkipWithReason('bad_audio')} className="w-full text-left px-3.5 py-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground transition-all cursor-pointer flex items-center gap-2.5">
                  <span className="text-base">🔇</span>
                  <div><span className="block">Bad Audio</span><span className="text-[10px] text-foreground/40 font-normal">Audio glitch or too quiet</span></div>
                </button>
                <button onClick={() => handleSkipWithReason('not_playing')} className="w-full text-left px-3.5 py-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground transition-all cursor-pointer flex items-center gap-2.5">
                  <span className="text-base">⏹</span>
                  <div><span className="block">Not Playing</span><span className="text-[10px] text-foreground/40 font-normal">No sound coming through</span></div>
                </button>
                <button onClick={() => handleSkipWithReason('just_skip')} className="w-full text-left px-3.5 py-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground transition-all cursor-pointer flex items-center gap-2.5">
                  <span className="text-base">⏭</span>
                  <div><span className="block">Just Skip</span><span className="text-[10px] text-foreground/40 font-normal">No reason</span></div>
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <MiniViz progress={(smoothTime ?? 0) / (roundDuration || 15)} />

      <div className="h-1 rounded-full bg-surface-light overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-none"
          style={{ width: `${roundDuration > 0 ? ((smoothTime ?? 0) / roundDuration) * 100 : 0}%` }}
        />
      </div>

      <div className="flex gap-2">
        <div className={`flex-1 text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${pillStyle(artistFound)}`}>
          Artist {!artistFound && <span className="text-foreground/30">?</span>}
        </div>
        <div className={`flex-1 text-center px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${pillStyle(titleFound)}`}>
          Title {!titleFound && <span className="text-foreground/30">?</span>}
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
          className={`relative w-full px-5 py-4 bg-[var(--surface)] border-2 rounded-2xl text-foreground text-lg text-center placeholder-foreground/40 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
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
              <span className="ml-2 text-foreground/40">A:{guessResult.artist_score}%</span>
            )}
            {guessResult.title_score != null && (
              <span className="ml-1 text-foreground/40">T:{guessResult.title_score}%</span>
            )}
            {guessResult.guessTimeMs != null && (
              <span className="ml-2 text-foreground/30">{(guessResult.guessTimeMs / 1000).toFixed(1)}s</span>
            )}
          </motion.div>
        );
      })()}
      {encouragement && (
        <motion.p
          key={encouragement}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs text-foreground/40 italic text-center"
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

function RoundResult({ data, players = [], pauseTimeLeft, trackHistory = [], onFlag }: { data?: { id?: string; correctAnswer?: string; artist?: string; albumImage?: string; skipped?: boolean } | null; players?: { name: string; score: number }[]; pauseTimeLeft: number; trackHistory?: { round: number; name: string; artist: string; albumImage?: string }[]; onFlag?: (id: string) => void }) {
  const { t } = useTranslation();
  const [flagged, setFlagged] = useState(false);

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
            src={getProxiedUrl(data.albumImage)}
            alt=""
            className="w-40 h-40 md:w-48 md:h-48 rounded-2xl shadow-2xl object-cover border border-white/10"
          />
        )}
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{data?.correctAnswer || 'Unknown Track'}</h2>
          <p className="text-sm text-foreground/60 mt-1">{data?.artist || 'Unknown Artist'}</p>
          {data?.id && (
            <button
              onClick={() => {
                if (onFlag && !flagged) {
                  onFlag(data.id!);
                  setFlagged(true);
                }
              }}
              disabled={flagged}
              className={`mt-3 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                flagged 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'bg-white/5 text-foreground/50 border border-white/10 hover:bg-white/10 hover:text-foreground/80'
              }`}
            >
              {flagged ? '🚩 Flagged for review' : '🚩 Flag as Incorrect'}
            </button>
          )}
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
              <span className="text-xs text-foreground/30 w-4">{i + 1}</span>
              <span className="text-sm font-medium">{p.name}</span>
            </div>
            <span className="text-sm font-bold text-[var(--accent)]">{p.score} pts</span>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-xs text-foreground/40">{t('next_round_in')}</p>
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
