'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

interface Player {
  id: string;
  name: string;
  score: number;
  answers: Answer[];
}

interface Answer {
  round: number;
  answer: string;
  correct: boolean;
  points: number;
}

interface RoundData {
  round: number;
  totalRounds: number;
  timeLimit: number;
  previewUrl: string;
  trackId: string;
}

interface RoundEndData {
  round: number;
  correctAnswer: string;
  artist: string;
  albumImage: string;
}

interface Ranking {
  rank: number;
  name: string;
  score: number;
  answers: Answer[];
}

type Phase = 'waiting' | 'playing' | 'round_result' | 'finished';

export default function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [phase, setPhase] = useState<Phase>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [round, setRound] = useState<RoundData | null>(null);
  const [roundEnd, setRoundEnd] = useState<RoundEndData | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [guess, setGuess] = useState('');
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    points: number;
    correctAnswer: string;
    artist: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) {
      router.push('/');
      return;
    }

    setMyId(socket.id || '');

    socket.on('player_joined', ({ players: p }) => setPlayers(p));
    socket.on('player_left', ({ players: p }) => setPlayers(p));

    socket.on('game_start', ({ players: p, totalRounds }) => {
      setPlayers(p);
      setPhase('playing');
    });

    socket.on('round_start', (data: RoundData) => {
      setRound(data);
      setRoundEnd(null);
      setLastResult(null);
      setGuess('');
      setTimeLeft(data.timeLimit);
      setPhase('playing');

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = data.previewUrl;
        audioRef.current.play().catch(() => {});
      }
    });

    socket.on('answer_result', ({ playerId, correct, points, correctAnswer, artist }) => {
      if (playerId === socket.id) {
        setLastResult({ correct, points, correctAnswer, artist });
      }
    });

    socket.on('round_end', (data: RoundEndData) => {
      setRoundEnd(data);
      setPhase('round_result');
      if (audioRef.current) {
        audioRef.current.pause();
      }
    });

    socket.on('game_end', ({ rankings: r }) => {
      setRankings(r);
      setPhase('finished');
      if (audioRef.current) {
        audioRef.current.pause();
      }
    });

    socket.on('game_error', ({ message }) => {
      setError(message);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_start');
      socket.off('round_start');
      socket.off('answer_result');
      socket.off('round_end');
      socket.off('game_end');
      socket.off('game_error');
      socket.off('error');
      if (audioRef.current) audioRef.current.pause();
    };
  }, [code, router]);

  useEffect(() => {
    if (phase === 'playing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, timeLeft]);

  const startGame = () => {
    const socket = getSocket();
    socket.emit('start_game');
  };

  const submitGuess = () => {
    if (!guess.trim()) return;
    const socket = getSocket();
    socket.emit('submit_answer', { answer: guess.trim() });
    setGuess('');
  };

  const isHost = players.length > 0 && players[0]?.id === myId;

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl"
        >
          Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-2xl mx-auto w-full gap-6">
      <div className="text-center">
        <p className="text-sm text-zinc-400">Room Code</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-[var(--primary)]">{code}</p>
      </div>

      {phase === 'waiting' && (
        <WaitingRoom
          players={players}
          isHost={isHost}
          onStart={startGame}
        />
      )}

      {phase === 'playing' && round && (
        <PlayingPhase
          round={round}
          timeLeft={timeLeft}
          guess={guess}
          onGuessChange={setGuess}
          onSubmit={submitGuess}
          lastResult={lastResult}
        />
      )}

      {phase === 'round_result' && roundEnd && (
        <RoundResult data={roundEnd} players={players} />
      )}

      {phase === 'finished' && (
        <GameFinished rankings={rankings} onPlayAgain={() => router.push('/')} />
      )}

      <audio ref={audioRef} />
    </div>
  );
}

function WaitingRoom({
  players,
  isHost,
  onStart,
}: {
  players: Player[];
  isHost: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Waiting for players...</h2>
        <p className="text-zinc-400">Share the room code with your friends!</p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <p className="text-sm text-zinc-400 font-medium">Players ({players.length})</p>
        {players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold">
              {p.name[0].toUpperCase()}
            </div>
            <span className="font-medium">
              {p.name} {i === 0 && '(Host)'}
            </span>
          </div>
        ))}
      </div>

      {isHost && (
        <button
          onClick={onStart}
          disabled={players.length < 1}
          className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors animate-pulse-glow"
        >
          Start Game
        </button>
      )}

      {!isHost && (
        <p className="text-zinc-500 text-sm">Waiting for the host to start...</p>
      )}
    </div>
  );
}

function PlayingPhase({
  round,
  timeLeft,
  guess,
  onGuessChange,
  onSubmit,
  lastResult,
}: {
  round: RoundData;
  timeLeft: number;
  guess: string;
  onGuessChange: (v: string) => void;
  onSubmit: () => void;
  lastResult: { correct: boolean; points: number; correctAnswer: string; artist: string } | null;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">
          Round {round.round}/{round.totalRounds}
        </span>
        <div className="w-12 h-12 rounded-full bg-[var(--surface)] flex items-center justify-center">
          <span className={`text-xl font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-[var(--accent)]'}`}>
            {timeLeft}
          </span>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="text"
          value={guess}
          onChange={e => onGuessChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Type the song name..."
          className="w-full px-4 py-3 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
        <button
          onClick={onSubmit}
          disabled={!guess.trim()}
          className="w-full px-6 py-3 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-black font-semibold rounded-xl transition-colors"
        >
          Guess!
        </button>
      </div>

      {lastResult && (
        <div
          className={`px-6 py-3 rounded-xl text-center animate-slide-up ${
            lastResult.correct
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {lastResult.correct
            ? `Correct! +${lastResult.points} pts`
            : `Wrong! It was "${lastResult.correctAnswer}" by ${lastResult.artist}`}
        </div>
      )}
    </div>
  );
}

function RoundResult({ data, players }: { data: RoundEndData; players: Player[] }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
      <h2 className="text-xl font-semibold">Round {data.round}</h2>
      <div className="text-center">
        <p className="text-2xl font-bold text-[var(--accent)]">{data.correctAnswer}</p>
        <p className="text-zinc-400">{data.artist}</p>
      </div>
      <p className="text-zinc-500 text-sm">Next round starting soon...</p>
    </div>
  );
}

function GameFinished({
  rankings,
  onPlayAgain,
}: {
  rankings: Ranking[];
  onPlayAgain: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-6 animate-slide-up">
      <h2 className="text-2xl font-bold">
        <span className="text-[var(--primary)]">Game</span> Over!
      </h2>

      <div className="w-full max-w-sm space-y-2">
        {rankings.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
              i === 0
                ? 'bg-yellow-500/20 border border-yellow-500/30'
                : 'bg-[var(--surface)]'
            }`}
          >
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

      <button
        onClick={onPlayAgain}
        className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
