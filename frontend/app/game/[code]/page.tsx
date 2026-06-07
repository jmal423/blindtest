'use client';

import { useEffect, useState, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { io as socketIo, Socket } from 'socket.io-client';
import { getToken, GameState, Player, RoomSettings, startGame, submitAnswer, updateSettings, fetchGenres } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function AudioPlayer({
  previewUrl,
  audioOffset,
  playing,
  onPlaying,
  onTimeUpdate,
}: {
  previewUrl: string | null;
  audioOffset: number;
  playing: boolean;
  onPlaying: () => void;
  onTimeUpdate: (t: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    if (!previewUrl || !playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      firedRef.current = false;
      return;
    }

    firedRef.current = false;
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.currentTime = audioOffset;

    audio.addEventListener('canplay', () => {
      audio.play().catch((err) => {
        console.error('Autoplay blocked:', err);
      });
    });

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [previewUrl, playing, audioOffset]);

  useEffect(() => {
    if (!playing || !audioRef.current) return;
    const interval = setInterval(() => {
      const a = audioRef.current;
      if (a && !a.paused) {
        onTimeUpdate(a.currentTime);
        if (!firedRef.current && a.currentTime >= audioOffset + 0.1) {
          firedRef.current = true;
          onPlayingRef.current();
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [playing, audioOffset, onTimeUpdate]);

  return null;
}

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

function ProgressBar({ duration, currentTime }: { duration: number; currentTime: number }) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-1">
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{format(currentTime)}</span>
        <span>{format(duration)}</span>
      </div>
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

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessResult, setGuessResult] = useState<{ artist_result: string; title_result: string; points_awarded_this_guess: number; found_both: boolean } | null>(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audioOffset, setAudioOffset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guessInputRef = useRef<HTMLInputElement>(null);
  const [artistFound, setArtistFound] = useState(false);
  const [titleFound, setTitleFound] = useState(false);
  const [bothFound, setBothFound] = useState(false);

  const handleAudioPlaying = useCallback(() => {
    if (localTimerRef.current) return;
    const state = gameState;
    if (!state || state.state !== 'playing') return;
    const roundTime = (state as any).roundTime || 15;
    setLocalTimeLeft(roundTime);
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
  }, [gameState]);

  const handleAudioTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const applyGameState = useCallback((state: GameState) => {
    setGameState(state);
    if (state.state === 'playing' || state.state === 'countdown') {
      setPreviewUrl((state as any).previewUrl || null);
      setAudioOffset((state as any).audioOffset || 0);
      if (state.state === 'playing') {
        setIsPlaying(true);
        setArtistFound(false);
        setTitleFound(false);
        setBothFound(false);
        setGuess('');
        setGuessResult(null);
      }
      setLocalTimeLeft(null);
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    }
    if (state.state !== 'playing') {
      setIsPlaying(false);
      setPreviewUrl(null);
      setLocalTimeLeft(null);
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    }
    if (state.state === 'finished' || state.state === 'round_result') {
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
    if (!playerId || !hasInteracted) return;

    const socket = socketIo(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', code, playerId);
    });

    socket.on('game_state', (state: GameState) => {
      applyGameState(state);
    });

    socket.on('input_result', (result: any) => {
      if (result.artist_result === 'Good') setArtistFound(true);
      if (result.title_result === 'Good') setTitleFound(true);
      if (result.found_both) setBothFound(true);
    });

    socket.on('connect_error', () => {
      setError('Lost connection to server');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, playerId, hasInteracted, applyGameState]);

  const handleStart = useCallback(async () => {
    try {
      await startGame(code, playerId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start');
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

  const handleSubmit = useCallback(async () => {
    if (!guess.trim()) return;
    try {
      const result = await submitAnswer(code, playerId, guess.trim());
      setGuessResult(result);
      setGuess('');
    } catch {
      // ignore duplicate submits
    }
  }, [code, playerId, guess]);

  const handleInteract = () => {
    new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=').play().catch(() => {});
    setHasInteracted(true);
  };

  if (!playerId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Connecting...</p>
      </div>
    );
  }

  if (!hasInteracted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 cursor-pointer" onClick={handleInteract}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-sm"
        >
          <p className="text-3xl font-bold mb-2">Room <span className="text-[var(--primary)]">{code}</span></p>
          <p className="text-zinc-400 text-sm mb-8">Click anywhere to enter</p>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--primary)] text-white font-semibold rounded-2xl"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Click to Enter Room
          </motion.div>
        </motion.div>
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
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-2xl mx-auto w-full gap-6">
      <div className="text-center">
        <p className="text-sm text-zinc-400">Room Code</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-[var(--primary)]">{code}</p>
      </div>

      {gameState.state === 'waiting' && (
        <WaitingRoom
          players={gameState.players}
          settings={gameState.settings}
          genres={gameState.genres}
          isHost={playerId === gameState.players[0]?.id}
          onStart={handleStart}
          onSettingsChange={handleSettingsUpdate}
          onGenresChange={handleGenresUpdate}
        />
      )}

      {(gameState.state === 'playing' || gameState.state === 'countdown') && (
        <PlayingPhase
          state={gameState.state}
          currentRound={gameState.currentRound}
          totalRounds={gameState.totalRounds}
          timeLeft={localTimeLeft ?? (gameState as any).timeLeft}
          guess={guess}
          onGuessChange={setGuess}
          onSubmit={handleSubmit}
          guessResult={guessResult}
          duration={duration}
          currentTime={currentTime}
          inputRef={guessInputRef}
          artistFound={artistFound}
          titleFound={titleFound}
          bothFound={bothFound}
          players={gameState.players}
          playerId={playerId}
        />
      )}

      {gameState.state === 'round_result' && (
        <RoundResult data={gameState.roundResult} players={gameState.players} pauseTimeLeft={(gameState as any).pauseTimeLeft} />
      )}

      {gameState.state === 'finished' && (
        <GameFinished code={code} rankings={gameState.rankings} playerId={playerId} onPlayAgain={() => router.push('/')} />
      )}

      <AudioPlayer previewUrl={previewUrl} audioOffset={audioOffset} playing={isPlaying} onPlaying={handleAudioPlaying} onTimeUpdate={handleAudioTimeUpdate} />
    </div>
  );
}

function WaitingRoom({
  players,
  settings,
  genres,
  isHost,
  onStart,
  onSettingsChange,
  onGenresChange,
}: {
  players: { id: string; name: string; avatarUrl?: string | null; role?: string }[];
  settings: RoomSettings;
  genres: string[];
  isHost: boolean;
  onStart: () => void;
  onSettingsChange: (s: Partial<RoomSettings>) => void;
  onGenresChange: (g: string[]) => void;
}) {
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetchGenres().then(setAllGenres).catch(() => {});
  }, []);

  const toggleGenre = (id: string) => {
    const set = new Set(genres);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (set.size > 0) onGenresChange(Array.from(set));
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-6 overflow-y-auto">
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
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 bg-[var(--surface)] rounded-xl p-4">
        <p className="text-sm text-zinc-400 font-medium">Settings</p>

        <div>
          <label className="text-xs text-zinc-500">Genres</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
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

        <div>
          <label className="text-xs text-zinc-500">Rounds: {settings.rounds}</label>
          {isHost ? (
            <div className="flex gap-2 mt-1">
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => onSettingsChange({ rounds: n })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.rounds === n
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface-light)] text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-300 mt-1">{settings.rounds}</p>
          )}
        </div>

        <div>
          <label className="text-xs text-zinc-500">Time per round: {settings.roundTime}s</label>
          {isHost ? (
            <div className="flex gap-2 mt-1">
              {[10, 15, 20, 30].map(t => (
                <button
                  key={t}
                  onClick={() => onSettingsChange({ roundTime: t })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.roundTime === t
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface-light)] text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-300 mt-1">{settings.roundTime}s</p>
          )}
        </div>

        <div>
          <label className="text-xs text-zinc-500">Pause between rounds: {settings.pauseTime}s</label>
          {isHost ? (
            <div className="flex gap-2 mt-1">
              {[2, 4, 6, 10].map(t => (
                <button
                  key={t}
                  onClick={() => onSettingsChange({ pauseTime: t })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.pauseTime === t
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface-light)] text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-300 mt-1">{settings.pauseTime}s</p>
          )}
        </div>
      </div>

      {isHost && (
        <button onClick={onStart} className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-colors animate-pulse-glow">
          Start Game
        </button>
      )}

      {!isHost && <p className="text-zinc-500 text-sm">Waiting for the host to start...</p>}
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
  inputRef,
  artistFound,
  titleFound,
  bothFound,
  players,
  playerId,
}: {
  state: string;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  guess: string;
  onGuessChange: (v: string) => void;
  onSubmit: () => void;
  guessResult: { artist_result: string; title_result: string; points_awarded_this_guess: number; found_both: boolean } | null;
  duration: number;
  currentTime: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  artistFound: boolean;
  titleFound: boolean;
  bothFound: boolean;
  players: Player[];
  playerId: string;
}) {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (state === 'countdown') {
      setCount(5);
      const t = setInterval(() => setCount(c => { if (c <= 1) return 0; return c - 1; }), 1000);
      return () => clearInterval(t);
    }
  }, [state, currentRound]);

  const placeholder = bothFound
    ? 'You nailed it!'
    : artistFound
      ? 'Artist found! Now type the title...'
      : 'Type the artist or title...';

  const pills = [
    { label: 'Artist', found: artistFound },
    { label: 'Title', found: titleFound },
  ];

  const statusLabel = (p: any) => {
    if (p.foundBoth) return { text: 'Found!', cls: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' };
    if (p.foundArtist && p.foundTitle) return { text: 'Both', cls: 'bg-green-500/20 text-green-400' };
    if (p.foundArtist) return { text: 'Artist', cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    if (p.foundTitle) return { text: 'Title', cls: 'bg-[#00cec9]/20 text-[#00cec9] text-[10px]' };
    return { text: '...', cls: 'text-zinc-600' };
  };

  if (state === 'countdown') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-12">
        <motion.h1
          key={count}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-9xl font-bold text-[var(--primary)]"
        >
          {count > 0 ? count : 'GO!'}
        </motion.h1>

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-start gap-6 w-full max-w-4xl mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <div className="flex items-center gap-6">
          <span className="text-sm text-zinc-400">Round {currentRound}/{totalRounds}</span>
          <motion.div
            key={currentRound}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-3xl font-bold tabular-nums ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}
          >
            {timeLeft}
          </motion.div>
        </div>

        <Visualizer duration={duration} currentTime={currentTime} />

        <ProgressBar duration={duration} currentTime={currentTime} />

        <div className="w-full max-w-sm space-y-3">
          <div className="flex gap-2">
            {pills.map(p => (
              <motion.div
                key={p.label}
                initial={p.found ? { scale: 0.8 } : false}
                animate={p.found ? { scale: [0.8, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={`flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  p.found
                    ? 'bg-[#00cec9] text-black border-[#00cec9]'
                    : 'bg-transparent text-zinc-500 border-zinc-700'
                }`}
              >
                {p.label}
              </motion.div>
            ))}
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={e => onGuessChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !bothFound && onSubmit()}
              placeholder={placeholder}
              disabled={bothFound}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={!guess.trim() || bothFound}
            className="w-full px-6 py-3 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-black font-semibold rounded-xl transition-colors"
          >
            Guess!
          </button>
        </div>

        {guessResult && (() => {
          const pts = guessResult.points_awarded_this_guess || 0;
          const succeeded = pts > 0;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`px-6 py-3 rounded-xl text-center ${
                succeeded
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {succeeded ? `+${pts} pts` : 'Wrong!'}
            </motion.div>
          );
        })()}
      </div>

      <div className="w-full lg:w-56 shrink-0 space-y-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Players</p>
        {players.map(p => {
          const s = statusLabel(p);
          return (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${p.id === playerId ? 'bg-white/5 ring-1 ring-white/20' : ''}`}>
              <span className="text-sm flex-1 truncate">{p.name}</span>
              <span className="font-bold text-[var(--accent)] text-sm">{p.score}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.cls}`}>{s.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoundResult({ data, players = [], pauseTimeLeft }: { data?: { correctAnswer?: string; artist?: string; albumImage?: string } | null; players?: { name: string; score: number }[]; pauseTimeLeft: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
      <h2 className="text-xl font-semibold">
        <span className="text-[var(--primary)]">{data?.correctAnswer || 'Unknown Track'}</span>
      </h2>
      <p className="text-lg text-zinc-400">{data?.artist || 'Unknown Artist'}</p>
      <div className="w-full max-w-xs space-y-1">
        {players.map((p, i) => (
          <div key={i} className="flex justify-between px-4 py-2 bg-[var(--surface)] rounded-lg">
            <span>{p.name}</span>
            <span className="text-[var(--accent)] font-medium">{p.score}</span>
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-zinc-500 text-sm">Next round in</p>
        <motion.p
          key={pauseTimeLeft}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold tabular-nums text-white"
        >
          {pauseTimeLeft}
        </motion.p>
      </div>
    </div>
  );
}

function GameFinished({ code, rankings, playerId, onPlayAgain }: { code: string; rankings: { rank: number; name: string; score: number }[]; playerId: string; onPlayAgain: () => void }) {
  const [saved, setSaved] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('blindtest_token') : null;

  const handleSave = async () => {
    if (!token) return;
    try {
      const { saveGameScore } = await import('@/lib/api');
      await saveGameScore(code, playerId);
      setSaved(true);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-6 animate-slide-up">
      <h2 className="text-2xl font-bold"><span className="text-[var(--primary)]">Game</span> Over!</h2>

      <div className="w-full max-w-sm space-y-2">
        {rankings.map((r, i) => (
          <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
            i === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-[var(--surface)]'
          }`}>
            <span className="text-2xl font-bold text-zinc-500 w-8">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${r.rank}`}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-zinc-400">{r.score} pts</p>
            </div>
            <span className="text-lg font-bold text-[var(--accent)]">{r.score}</span>
          </div>
        ))}
      </div>

      <button onClick={onPlayAgain} className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-colors">
        Play Again
      </button>
    </div>
  );
}
