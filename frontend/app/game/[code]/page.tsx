'use client';

import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { io as socketIo, Socket } from 'socket.io-client';
import { getToken, GameState, Player, RoomSettings, startGame, updateSettings, fetchGenres, testGameSource } from '@/lib/api';
import { isDebugMode } from '@/lib/debug-context';
import AudioPlayer from '@/app/components/AudioPlayer';
import { useSettings } from '@/app/context/SettingsContext';
import Chat from './Chat';
import Podium from './Podium';
import DebugOverlay from './DebugOverlay';
import { useSound } from '@/lib/useSound';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const WRONG_MSGS = ['Too bad!', 'Nope!', 'Not quite!', 'Try again!', 'Missed!'];
const CORRECT_MSGS = ['Nice!', 'Good one!', 'Well done!', 'Got it!', 'Keep going!'];
const COMPLETE_MSGS = ['Perfect!', 'You nailed it!', 'Brilliant!', 'Unstoppable!', 'Flawless!'];

const BAR_COUNT = 48;

function Visualizer({ duration, currentTime }: { duration: number; currentTime: number }) {
  const [heights, setHeights] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => 20 + Math.random() * 60)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(() =>
        Array.from({ length: BAR_COUNT }, () => 20 + Math.random() * 60)
      );
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  ];

  return (
    <div className="flex items-end justify-center gap-[3px] h-48 w-full max-w-lg mx-auto">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: `${h}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-[4px] rounded-t-sm"
          style={{
            background: `linear-gradient(to top, ${colors[Math.floor(i / 12) % colors.length]}, ${colors[(Math.floor(i / 12) + 1) % colors.length]})`,
            boxShadow: `0 0 6px ${colors[Math.floor(i / 12) % colors.length]}66`,
          }}
        />
      ))}
    </div>
  );
}

const PLAYER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16'];

function ProgressBar({ duration, currentTime, markers }: { duration: number; currentTime: number; markers: { playerName: string; artistFound: boolean; titleFound: boolean; guessTimeMs: number }[] }) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const uniquePlayers = [...new Set(markers.map(m => m.playerName))];

  return (
    <div className="w-full max-w-lg mx-auto space-y-1">
      <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
        {markers.map((m, i) => {
          const pct = duration > 0 ? Math.min(100, (m.guessTimeMs / 1000 / duration) * 100) : 0;
          const color = PLAYER_COLORS[uniquePlayers.indexOf(m.playerName) % PLAYER_COLORS.length];
          const isBoth = m.artistFound && m.titleFound;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${pct}%` }}
              title={`${m.playerName}: ${(m.guessTimeMs / 1000).toFixed(1)}s${isBoth ? ' (both)' : m.artistFound ? ' (artist)' : ' (title)'}`}
            >
              <div
                className={`rounded-full border border-black/30 ${isBoth ? 'w-3 h-3' : 'w-2 h-2'}`}
                style={{ backgroundColor: color }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{format(currentTime)}</span>
        <span>{format(duration)}</span>
      </div>
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
          {uniquePlayers.map((name, i) => {
            const playerMarkers = markers.filter(m => m.playerName === name);
            const best = Math.min(...playerMarkers.map(m => m.guessTimeMs));
            return (
              <div key={name} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                <span>{name} {(best / 1000).toFixed(1)}s</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const guessInputRef = useRef<HTMLInputElement>(null);
  const [artistFound, setArtistFound] = useState(false);
  const [titleFound, setTitleFound] = useState(false);
  const [bothFound, setBothFound] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [guessMarkers, setGuessMarkers] = useState<{ playerName: string; artistFound: boolean; titleFound: boolean; guessTimeMs: number }[]>([]);
  const [startLoading, setStartLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const playSound = useSound();
  const { settings: userSettings } = useSettings();
  const playSoundRef = useRef(playSound);
  const activeRoundRef = useRef<string | null>(null);
  playSoundRef.current = playSound;

  const handleAudioPlaying = useCallback(() => {
    socketRef.current?.emit('playback_started');
    if (localTimerRef.current) return;
    const state = gameState;
    if (!state || state.state !== 'playing') return;
    const roundTime = (state as any).roundTime || 15;
    setLocalTimeLeft(Math.ceil(roundTime));
    setSmoothTime(0);
    guessInputRef.current?.focus();

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
      setSmoothTime(t => {
        const next = t + 0.05;
        if (next >= roundTime) {
          if (smoothTimerRef.current) {
            clearInterval(smoothTimerRef.current);
            smoothTimerRef.current = null;
          }
          return roundTime;
        }
        return next;
      });
    }, 50);
  }, [gameState]);

  const handleAudioTimeUpdate = useCallback((t: number, d?: number) => {
    setCurrentTime(t);
    if (d && d > 0) setDuration(d);
  }, []);

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
        setLocalTimeLeft(null);
        setSmoothTime(0);
        setGuessMarkers([]);
        if (localTimerRef.current) {
          clearInterval(localTimerRef.current);
          localTimerRef.current = null;
        }
        if (smoothTimerRef.current) {
          clearInterval(smoothTimerRef.current);
          smoothTimerRef.current = null;
        }
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
      applyGameState(state);
    });

    socket.on('guess_made', (marker: any) => {
      setGuessMarkers(prev => [...prev, { playerName: marker.playerName, artistFound: marker.artistFound, titleFound: marker.titleFound, guessTimeMs: marker.guessTimeMs }]);
    });

    socket.on('input_result', (result: any) => {
      if (result.found_both) {
        setBothFound(true);
        playSound('complete');
        setEncouragement(COMPLETE_MSGS[Math.floor(Math.random() * COMPLETE_MSGS.length)]);
      } else if (result.artist_result === 'Good' || result.title_result === 'Good') {
        if (result.artist_result === 'Good') setArtistFound(true);
        if (result.title_result === 'Good') setTitleFound(true);
        playSound('correct');
        setEncouragement(CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)]);
      } else {
        playSound('wrong');
        setEncouragement(WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)]);
      }
      setGuessResult(result);
    });

    socket.on('connect_error', () => {
      setError('Lost connection to server');
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
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setStartLoading(false);
    }
  }, [code, playerId]);

  const handleSettingsUpdate = useCallback(async (settings: Partial<RoomSettings>) => {
    try {
      await updateSettings(code, playerId, settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Settings update failed');
    }
  }, [code, playerId]);

  const handleGenresUpdate = useCallback(async (genres: string[]) => {
    try {
      await updateSettings(code, playerId, { genres });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Genre update failed');
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

  if (!playerId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Connecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <p className="text-zinc-500 text-sm">Server: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</p>
        <button onClick={() => router.push('/')} className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl">
          Back Home
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Connecting to game...</p>
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
            Copy
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
              <span className="capitalize">{(gameState as any).settings?.audioSource ?? 'deezer'}</span>
            </div>
          )}
          {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
            <span className="text-xs text-zinc-600">Round {gameState.currentRound}/{gameState.totalRounds}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gameState.state !== 'waiting' && gameState.state !== 'game_over' && (
            <button
              onClick={() => setChatOpen(o => !o)}
              className="md:hidden text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              {chatOpen ? 'Hide Chat' : 'Chat'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 md:gap-6">
        {gameState.state !== 'waiting' && gameState.state !== 'game_over' && ((gameState as any)?.trackHistory?.length > 0) && (
          <div className="hidden md:flex flex-col w-48 shrink-0">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">History</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {((gameState as any)?.trackHistory || []).map((t: any) => (
                <div
                  key={t.round}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${
                    t.round === ((gameState as any)?.trackHistory || []).length ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-white/[0.03]'
                  }`}
                >
                  {t.albumImage && (
                    <img src={t.albumImage} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate leading-tight">{t.name}</p>
                    <p className="text-zinc-500 truncate leading-tight">{t.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-4 max-w-2xl min-w-0">
          {gameState.state === 'waiting' && (
            <WaitingRoom
              gameCode={code}
              players={gameState.players}
              settings={gameState.settings}
              genres={gameState.genres}
              isHost={playerId === gameState.hostId}
              isAdmin={gameState.players.find(p => p.id === playerId)?.role === 'admin'}
              playerId={playerId}
              onStart={handleStart}
              onSettingsChange={handleSettingsUpdate}
              onGenresChange={handleGenresUpdate}
              onKickPlayer={(pid) => socketRef.current?.emit('kick_player', pid)}
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
              duration={duration}
              currentTime={currentTime}
              guessMarkers={guessMarkers}
              inputRef={guessInputRef}
              artistFound={artistFound}
              titleFound={titleFound}
              bothFound={bothFound}
              players={gameState.players}
              playerId={playerId}
              encouragement={encouragement}
              waitingForPlayers={(gameState as any).waitingForPlayers}
              roundTime={(gameState as any).settings?.roundTime || 15}
              playersReady={(gameState as any).playersReady}
              playersTotal={(gameState as any).playersTotal}
              youtubeVideoId={(gameState as any).youtubeVideoId}
              onSkipRound={() => socketRef.current?.emit('skip_round')}
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
          youtubeVideoId={(gameState as any).youtubeVideoId || null}
          previewUrl={(gameState as any).previewUrl || null}
          audioOffset={(gameState as any).audioOffset || 0}
          durationMs={(gameState as any).durationMs || 30000}
          state={gameState.state}
          onPlaying={handleAudioPlaying}
          onTimeUpdate={handleAudioTimeUpdate}
        />
      )}

      {isDebugMode() && (
        <DebugOverlay gameState={gameState} socketConnected={socketConnected} />
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
  isHost,
  isAdmin,
  playerId,
  onStart,
  onSettingsChange,
  onGenresChange,
  onKickPlayer,
  startLoading,
}: {
  gameCode: string;
  players: { id: string; name: string; avatarUrl?: string | null; role?: string }[];
  settings: RoomSettings;
  genres: string[];
  isHost: boolean;
  isAdmin?: boolean;
  playerId: string;
  onStart: () => void;
  onSettingsChange: (s: Partial<RoomSettings>) => void;
  onGenresChange: (g: string[]) => void;
  onKickPlayer?: (playerId: string) => void;
  startLoading?: boolean;
}) {
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);
  const [sourceTestResult, setSourceTestResult] = useState<any>(null);
  const [sourceTestLoading, setSourceTestLoading] = useState(false);

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
        <p className="text-sm text-zinc-400 font-medium">Players ({players.length})</p>
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
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
            {i === 0 && <span className="text-xs text-zinc-500 ml-auto">Host</span>}
            {isAdmin && onKickPlayer && p.id !== playerId && (
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
        <p className="text-sm text-zinc-400 font-medium">Settings</p>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-zinc-500">Genres</label>
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
                {genres.length === allGenres.length && allGenres.length > 0 ? 'Clear' : 'All'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allGenres.map(g => {
              const selected = genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => isHost && toggleGenre(g.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selected
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface-light)] text-zinc-400'
                  } ${!isHost ? 'opacity-80 cursor-default' : 'hover:brightness-110'}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <SliderSetting label="Rounds" value={settings.rounds} min={3} max={25} isHost={isHost} onChange={v => onSettingsChange({ rounds: v })} />
        <SliderSetting label="Time per round" value={settings.roundTime} min={8} max={30} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ roundTime: v })} />
        <SliderSetting label="Pause between" value={settings.pauseTime} min={2} max={15} suffix="s" isHost={isHost} onChange={v => onSettingsChange({ pauseTime: v })} />

        {isHost && (
          <div>
            <label className="text-xs text-zinc-500 block mb-2">Audio Source</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'spotify', label: 'Spotify', desc: '30s previews' },
                { id: 'deezer', label: 'Deezer', desc: 'Free, no auth' },
                { id: 'youtube', label: 'YouTube', desc: 'Full songs' },
                { id: 'both', label: 'Auto', desc: 'Best available' },
              ] as const).map(src => {
                const selected = settings.audioSource === src.id;
                return (
                  <button
                    key={src.id}
                    onClick={() => onSettingsChange({ audioSource: src.id })}
                    className={`relative text-left p-3 rounded-xl border transition-all ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                        : 'border-white/10 bg-[var(--surface-light)] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        selected ? 'bg-[var(--primary)]' : 'bg-zinc-500'
                      }`} />
                      <span className={`text-xs font-semibold ${selected ? 'text-white' : 'text-zinc-300'}`}>
                        {src.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 ml-[18px] leading-tight">{src.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <button
                onClick={async () => {
                  setSourceTestLoading(true);
                  setSourceTestResult(null);
                  try {
                    const result = await testGameSource(gameCode, playerId, settings.audioSource);
                    setSourceTestResult(result);
                  } catch (e: any) {
                    setSourceTestResult({ ok: false, error: e.message });
                  }
                  setSourceTestLoading(false);
                }}
                disabled={sourceTestLoading}
                className="w-full px-3 py-1.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-[11px] font-medium hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>{sourceTestLoading ? '●' : '▶'}</span>
                {sourceTestLoading ? 'Testing...' : 'Test source'}
              </button>
              {sourceTestResult && (
                <div className={`mt-2 rounded-lg p-2.5 text-xs font-mono space-y-1 ${
                  sourceTestResult.ok ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={sourceTestResult.ok ? 'text-green-400' : 'text-red-400'}>
                      {sourceTestResult.ok ? '✓' : '✗'}
                    </span>
                    <span className="text-zinc-400">{sourceTestResult.genre}</span>
                    <span className="text-zinc-600">{sourceTestResult.ms}ms</span>
                    {sourceTestResult.sourcesTried && (
                      <span className="text-zinc-500">{sourceTestResult.sourcesTried.join('→')}</span>
                    )}
                  </div>
                  {sourceTestResult.tracks?.length > 0 && sourceTestResult.tracks.map((t: any, i: number) => (
                    <p key={i} className="text-white/80">
                      {t.name} — {t.artist}
                      <span className="text-zinc-500 ml-1">[{t.source}]</span>
                      {t.previewUrl && <span className="text-green-400 ml-0.5">•</span>}
                      {t.youtubeVideoId && <span className="text-red-400 ml-0.5">▶</span>}
                    </p>
                  ))}
                  {sourceTestResult.errors?.length > 0 && sourceTestResult.errors.map((e: string, i: number) => (
                    <p key={i} className="text-yellow-400/70">{e}</p>
                  ))}
                  {sourceTestResult.error && <p className="text-red-400">{sourceTestResult.error}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <div>
                <span className="text-xs text-zinc-400">Auto-start</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">Game starts 5s after 2+ players join</p>
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
          {startLoading ? 'Starting...' : genres && genres.length > 0 ? 'Start Game' : 'Select a Genre to Start'}
        </button>
      )}

      {!isHost && <p className="text-zinc-500 text-sm">Waiting for the host to start...</p>}
    </div>
  );
}

function PreparingCountdown({ currentRound, totalRounds, players, playerId }: { currentRound: number; totalRounds: number; players: Player[]; playerId: string }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    setCount(3);
    const t = setInterval(() => setCount(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [currentRound]);

  const statusLabel = (p: any) => {
    if (p.foundBoth) return { text: 'Found!', cls: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' };
    if (p.foundArtist && p.foundTitle) return { text: 'Both', cls: 'bg-green-500/20 text-green-400' };
    if (p.foundArtist) return { text: 'Artist', cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    if (p.foundTitle) return { text: 'Title', cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    return { text: '...', cls: 'text-zinc-600' };
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
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 text-center">Players</p>
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

      <p className="text-sm text-zinc-500">Round {currentRound}/{totalRounds}</p>
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
  duration,
  currentTime,
  guessMarkers,
  inputRef,
  artistFound,
  titleFound,
  bothFound,
  players,
  playerId,
  encouragement,
  waitingForPlayers,
  playersReady,
  playersTotal,
  onSkipRound,
  smoothTime,
  youtubeVideoId,
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
  duration: number;
  currentTime: number;
  guessMarkers: { playerName: string; artistFound: boolean; titleFound: boolean; guessTimeMs: number }[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  artistFound: boolean;
  titleFound: boolean;
  bothFound: boolean;
  players: Player[];
  playerId: string;
  encouragement: string | null;
  waitingForPlayers?: boolean;
  playersReady?: number;
  playersTotal?: number;
  onSkipRound?: () => void;
  roundTime?: number;
  youtubeVideoId?: string | null;
  hostId?: string | null;
}) {
  const roundDuration = roundTime || 15;
  const placeholder = bothFound
    ? 'You nailed it!'
    : artistFound
      ? 'Artist found! Now type the title...'
      : 'Type the artist or title...';

  if (state === 'round_preparing') {
    return <PreparingCountdown currentRound={currentRound} totalRounds={totalRounds} players={players} playerId={playerId} />;
  }

  const me = players.find(p => p.id === playerId);
  const isAdmin = me?.role === 'admin' || playerId === hostId;

  const playerStatus = (p: any) => {
    if (p.foundBoth) return 'found';
    if (p.foundArtist || p.foundTitle) return 'partial';
    return 'guessing';
  };

  if (waitingForPlayers) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="flex items-center gap-6">
          <span className="text-sm text-zinc-400">Round {currentRound}/{totalRounds}</span>
        </div>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: playersTotal || 0 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < (playersReady || 0) ? 'bg-green-400 scale-110' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <p className="text-zinc-400 text-lg">Waiting for players to connect...</p>
          <p className="text-zinc-500 text-sm">{playersReady}/{playersTotal} ready</p>
        </div>
        <MiniViz duration={duration} currentTime={currentTime} />
        {isAdmin && onSkipRound && (
          <button onClick={onSkipRound} className="px-4 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors">
            Skip Round
          </button>
        )}
      </div>
    );
  }

  const pillStyle = (found: boolean) =>
    found
      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
      : 'bg-transparent text-zinc-600 border-zinc-700';

  return (
    <div className="flex-1 flex flex-col gap-4 w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 tabular-nums">Round {currentRound}/{totalRounds}</span>
        <div className="flex items-center gap-3">
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className={`text-3xl font-bold tabular-nums ${timeLeft != null && timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}
          >
            {timeLeft ?? '--'}
          </motion.span>
          {isAdmin && onSkipRound && (
            <button
              onClick={onSkipRound}
              className="px-2 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-500 rounded border border-zinc-700 transition-colors"
              title="Skip this round"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      <MiniViz duration={duration} currentTime={currentTime} />

      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-none"
          style={{ width: `${roundDuration > 0 ? ((smoothTime ?? 0) / roundDuration) * 100 : 0}%` }}
        />
      </div>

      <div className="flex gap-1">
        {players.map(p => {
          const s = playerStatus(p);
          return (
            <div
              key={p.id}
              className={`flex-1 text-center px-1.5 py-1 rounded text-[10px] font-medium transition-all ${
                s === 'found' ? 'bg-yellow-500/20 text-yellow-400'
                : s === 'partial' ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                : 'text-zinc-600'
              }`}
              title={`${p.name} — ${p.score}pts`}
            >
              {p.name[0].toUpperCase()}{p.name.length > 1 ? p.name.slice(0, 2) : ''}
            </div>
          );
        })}
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
              ? 'border-green-500/50 shadow-green-500/10'
              : 'border-[var(--primary)]/30 focus:border-[var(--primary)] shadow-[var(--primary)]/5 focus:shadow-lg'
          }`}
        />
        {!bothFound && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Send
            </button>
          </div>
        )}
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

function MiniViz({ duration, currentTime }: { duration: number; currentTime: number }) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, []);
  const bars = 32;
  return (
    <div className="flex items-end justify-center gap-[2px] h-12 w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const barPct = (i / bars) * 100;
        const active = barPct <= pct;
        const h = active ? 30 + Math.sin(i * 1.7 + tick * 0.15) * 20 + 15 : 6;
        return (
          <div
            key={i}
            className="w-[3px] rounded-t-sm flex-shrink-0 transition-all duration-200"
            style={{
              height: `${h}%`,
              background: active ? `hsl(${260 + i * 5}, 70%, ${48 + Math.sin(i * 0.8 + tick * 0.05) * 12}%)` : '#3f3f46',
            }}
          />
        );
      })}
    </div>
  );
}

function RoundResult({ data, players = [], pauseTimeLeft, trackHistory = [] }: { data?: { correctAnswer?: string; artist?: string; albumImage?: string } | null; players?: { name: string; score: number }[]; pauseTimeLeft: number; trackHistory?: { round: number; name: string; artist: string; albumImage?: string }[] }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-5 max-w-sm mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center gap-4"
      >
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
        <p className="text-xs text-zinc-500">Next round in</p>
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