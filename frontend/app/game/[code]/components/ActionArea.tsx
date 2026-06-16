'use client';

import { type RefObject } from 'react';
import { NeonInput } from '@/app/components/ui/NeonInput';

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

      <div className="relative w-full">
        <div
          className={`absolute -inset-1 rounded-2xl blur-lg transition-all duration-500 ${
            bothFound ? 'bg-green-500/20' : 'bg-[var(--primary)]/10'
          }`}
        />
        <NeonInput
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => onGuessChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !bothFound && guess.trim() && onSubmit()}
          placeholder={placeholder}
          disabled={bothFound}
          autoComplete="off"
          className={`relative z-10 w-full md:py-5 text-lg md:text-xl transition-shadow duration-200 disabled:opacity-80 disabled:cursor-not-allowed ${
            bothFound ? '!border-green-500 !text-green-400 !shadow-[0_0_20px_rgba(34,197,94,0.6)]' : ''
          }`}
        />
      </div>
    </div>
  );
}
