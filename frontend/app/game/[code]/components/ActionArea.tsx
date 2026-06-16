'use client';

import { type RefObject } from 'react';
import { motion } from 'motion/react';
import { Visualizer } from './Visualizer';

interface ActionAreaProps {
  guess: string;
  onGuessChange: (value: string) => void;
  onSubmit: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  bothFound: boolean;
  placeholder?: string;
}

export default function ActionArea({
  guess,
  onGuessChange,
  onSubmit,
  inputRef,
  bothFound,
  placeholder = 'Guess the song title...',
}: ActionAreaProps) {
  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-4">
      <Visualizer />

      <div className="relative w-full">
        <div
          className={`absolute -inset-1 rounded-2xl blur-lg transition-all duration-500 ${
            bothFound ? 'bg-green-500/20' : 'bg-primary/10'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => onGuessChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !bothFound && onSubmit()}
          placeholder={placeholder}
          disabled={bothFound}
          autoComplete="off"
          style={{ WebkitAppearance: 'none' }}
          className="relative w-full px-6 py-4 md:py-5 rounded-xl bg-black/50 border border-white/10 text-lg md:text-xl text-foreground placeholder-white/20 outline-none transition-shadow duration-200 focus:border-primary focus:shadow-[0_0_20px_var(--primary),0_0_60px_var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <button
        onClick={() => {
          if (!bothFound) onSubmit();
        }}
        disabled={bothFound || !guess.trim()}
        className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-widest hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Submit Guess
      </button>
    </div>
  );
}
