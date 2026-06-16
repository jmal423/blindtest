'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MockPlayer {
  id: string;
  name: string;
  score: number;
  status: 'guessing' | 'correct' | 'wrong';
  isMe?: boolean;
}

type GameState = 'waiting' | 'playing' | 'finished';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const INITIAL_PLAYERS: MockPlayer[] = [
  { id: 'p1', name: 'You', score: 4200, status: 'guessing', isMe: true },
  { id: 'p2', name: 'Luna', score: 3800, status: 'guessing' },
  { id: 'p3', name: 'Kai', score: 3100, status: 'correct' },
  { id: 'p4', name: 'Zara', score: 2800, status: 'wrong' },
  { id: 'p5', name: 'Rui', score: 1500, status: 'guessing' },
  { id: 'p6', name: 'Maya', score: 1200, status: 'guessing' },
  { id: 'p7', name: 'Leo', score: 800, status: 'correct' },
  { id: 'p8', name: 'Nia', score: 400, status: 'wrong' },
];

/* ------------------------------------------------------------------ */
/*  Visualizer Bars                                                    */
/* ------------------------------------------------------------------ */

const BAR_COUNT = 7;

function Visualizer() {
  const heights = useRef(Array.from({ length: BAR_COUNT }, () => Math.random() * 60 + 10));

  useEffect(() => {
    const interval = setInterval(() => {
      heights.current = heights.current.map(() => Math.random() * 60 + 10);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-end justify-center gap-[3px] md:gap-1 h-16 md:h-24">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="w-[6px] md:w-2 rounded-full bg-primary"
          animate={{ height: [`${heights.current[i]}px`, `${Math.random() * 60 + 10}px`] }}
          transition={{ duration: 0.4, ease: 'easeInOut', repeat: Infinity, delay: i * 0.07 }}
          style={{ opacity: 0.7 + (i / BAR_COUNT) * 0.3 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Player Card                                                        */
/* ------------------------------------------------------------------ */

function PlayerCard({ player }: { player: MockPlayer }) {
  const statusBorder =
    player.status === 'correct'
      ? 'border-emerald-400 shadow-[0_0_8px_#34d399]'
      : player.status === 'wrong'
        ? 'border-red-500/40 opacity-50'
        : 'border-white/10';

  const meBorder = player.isMe ? 'border-l-2 border-l-accent' : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl border ${statusBorder} ${meBorder} bg-surface/60 backdrop-blur-sm`}
    >
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs md:text-sm font-bold text-primary shrink-0">
        {player.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs md:text-sm font-semibold text-foreground truncate">
            {player.name}
          </span>
          {player.isMe && (
            <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold leading-none">
              YOU
            </span>
          )}
        </div>
      </div>
      <span className="text-xs md:text-sm font-mono font-bold text-primary shrink-0">
        {player.score.toLocaleString()}
      </span>
      <div className="w-2 h-2 rounded-full shrink-0" style={{
        backgroundColor:
          player.status === 'correct' ? '#34d399' :
          player.status === 'wrong' ? '#ef4444' :
          '#a1a1aa',
      }} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sandbox Page                                                       */
/* ------------------------------------------------------------------ */

export default function SandboxPage() {
  // Bypass onboarding for sandbox mode
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('blindtest_onboarding_done', '1'); } catch {}
  }

  const [gameState] = useState<GameState>('playing');
  const [timeLeft, setTimeLeft] = useState(12);
  const [currentRound] = useState(3);
  const [totalRounds] = useState(15);
  const [players, setPlayers] = useState<MockPlayer[]>(INITIAL_PLAYERS);
  const [guess, setGuess] = useState('');
  const [sortByScore, setSortByScore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Timer tick */
  useEffect(() => {
    if (gameState !== 'playing') return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) return 12;
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameState]);

  /* Re-sort players by score every 5 seconds to demo AnimatePresence */
  useEffect(() => {
    const id = setInterval(() => {
      setSortByScore((prev) => !prev);
      setPlayers((prev) => [...prev].sort((a, b) => b.score - a.score));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  /* Randomise a player's status every 3 seconds for visual variety */
  useEffect(() => {
    const statuses: MockPlayer['status'][] = ['guessing', 'correct', 'wrong'];
    const id = setInterval(() => {
      setPlayers((prev) =>
        prev.map((p) =>
          Math.random() < 0.3
            ? { ...p, status: statuses[Math.floor(Math.random() * statuses.length)] }
            : p,
        ),
      );
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const sortedPlayers = [...players].sort((a, b) => {
    if (sortByScore) return b.score - a.score;
    return 0;
  });

  const roundProgress = (currentRound / totalRounds) * 100;

  return (
    <div
      data-theme="noir"
      className="h-dvh flex flex-col bg-background text-foreground overflow-hidden font-sans"
    >
      {/* ================================================================ */}
      {/* Desktop Layout                                                   */}
      {/* ================================================================ */}
      <div className="hidden md:flex h-full">
        {/* Sidebar — Player Board */}
        <aside className="w-72 lg:w-80 xl:w-96 shrink-0 flex flex-col border-r border-white/10 bg-black/30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
              Players
            </h2>
            <span className="text-xs text-white/30 font-mono">{players.length}/8</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </AnimatePresence>
          </div>
        </aside>

        {/* Main Arena */}
        <main className="flex-1 flex flex-col items-center justify-center gap-10 px-8">
          {/* Round info + Timer */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 text-sm tracking-widest uppercase text-white/30">
              <span>Round</span>
              <span className="text-primary font-bold">{currentRound}</span>
              <span className="text-white/15">/</span>
              <span>{totalRounds}</span>
            </div>
            <div className="relative">
              <span className="text-8xl xl:text-9xl font-black tabular-nums leading-none">
                {timeLeft}
              </span>
              {timeLeft <= 5 && (
                <motion.div
                  className="absolute inset-0 text-8xl xl:text-9xl font-black tabular-nums leading-none text-primary"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
                >
                  {timeLeft}
                </motion.div>
              )}
            </div>
          </div>

          {/* Visualizer */}
          <Visualizer />

          {/* Neon Input */}
          <div className="w-full max-w-xl flex flex-col items-center gap-4">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Guess the song title..."
              className="w-full px-6 py-4 md:py-5 rounded-xl bg-black/50 border border-white/10 text-lg md:text-xl text-foreground placeholder-white/20 outline-none transition-shadow duration-200 focus:border-primary focus:shadow-[0_0_20px_var(--primary),0_0_60px_var(--primary)]"
              style={{ WebkitAppearance: 'none' }}
            />
            <button
              onClick={() => { setGuess(''); inputRef.current?.focus(); }}
              className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest hover:bg-primary-hover active:scale-95 transition-all"
            >
              Submit Guess
            </button>
          </div>
        </main>
      </div>

      {/* ================================================================ */}
      {/* Mobile Layout                                                    */}
      {/* ================================================================ */}
      <div className="flex md:hidden flex-col h-full">
        {/* Top bar — Timer + Round */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/30">
            <span>Round</span>
            <span className="text-primary font-bold">{currentRound}</span>
            <span className="text-white/15">/</span>
            <span>{totalRounds}</span>
          </div>
          <div className="relative">
            <span className="text-5xl font-black tabular-nums leading-none">{timeLeft}</span>
            {timeLeft <= 5 && (
              <motion.div
                className="absolute inset-0 text-5xl font-black tabular-nums leading-none text-primary"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
              >
                {timeLeft}
              </motion.div>
            )}
          </div>
          <div className="w-0 h-5 border-r border-white/10" />
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span className="text-primary font-mono font-bold">{players.length}</span>
            <span>players</span>
          </div>
        </div>

        {/* Timer / Round ring */}
        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-light)" strokeWidth="4" />
              <motion.circle
                cx="50" cy="50" r="44" fill="none"
                stroke={timeLeft <= 5 ? 'var(--primary)' : 'var(--accent)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={276.46}
                animate={{ strokeDashoffset: 276.46 * (1 - timeLeft / 12) }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </svg>
            <motion.span
              className="text-3xl font-black tabular-nums"
              animate={timeLeft <= 5 ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
            >
              {timeLeft}
            </motion.span>
          </div>
          <Visualizer />
        </div>

        {/* Player board — horizontal scroll */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1.5 min-h-0 pb-2">
          <AnimatePresence mode="popLayout">
            {sortedPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </AnimatePresence>
        </div>

        {/* Sticky bottom — Guess input */}
        <div className="sticky bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-white/10 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Guess the song..."
              className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-[16px] text-foreground placeholder-white/20 outline-none transition-shadow duration-200 focus:border-primary focus:shadow-[0_0_15px_var(--primary)]"
              style={{ WebkitAppearance: 'none' }}
            />
            <button
              onClick={() => { setGuess(''); inputRef.current?.focus(); }}
              className="px-5 py-3 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shrink-0"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
