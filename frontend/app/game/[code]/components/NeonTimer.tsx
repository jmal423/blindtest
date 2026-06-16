'use client';

import { motion } from 'motion/react';

interface NeonTimerProps {
  timeLeft: number;
  totalTime: number;
  currentRound: number;
  totalRounds: number;
}

export default function NeonTimer({ timeLeft, totalTime, currentRound, totalRounds }: NeonTimerProps) {
  return (
    <>
      {/* Desktop Timer */}
      <div className="hidden md:flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-sm tracking-widest uppercase text-white/30">
          <span>Round</span>
          <span className="text-primary font-bold">{currentRound}</span>
          <span className="text-white/15">/</span>
          <span>{totalRounds}</span>
        </div>
        <div className="relative">
          <span className="text-8xl xl:text-9xl font-black tabular-nums leading-none select-none">
            {timeLeft}
          </span>
          {timeLeft <= 5 && (
            <motion.div
              className="absolute inset-0 text-8xl xl:text-9xl font-black tabular-nums leading-none text-primary select-none"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
              aria-hidden
            >
              {timeLeft}
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile Timer */}
      <div className="flex md:hidden flex-col items-center justify-center gap-1">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-light)" strokeWidth="4" />
            <motion.circle
              cx="50" cy="50" r="44" fill="none"
              stroke={timeLeft <= 5 ? 'var(--primary)' : 'var(--accent)'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={276.46}
              animate={{ strokeDashoffset: 276.46 * (1 - timeLeft / totalTime) }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </svg>
          <motion.span
            className="text-3xl font-black tabular-nums select-none"
            animate={timeLeft <= 5 ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
          >
            {timeLeft}
          </motion.span>
        </div>
        <span className="text-[10px] text-white/30 tracking-widest uppercase">
          Round {currentRound}/{totalRounds}
        </span>
      </div>
    </>
  );
}
