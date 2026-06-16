'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';

interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-4 py-3 bg-[var(--surface)]/50 backdrop-blur-md border rounded-2xl text-center font-black tracking-[0.15em] text-[var(--accent)] placeholder-white/20 outline-none transition-all duration-300 ${className} ${
          error
            ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] focus:border-red-500 focus:shadow-[0_0_12px_rgba(239,68,68,0.6)]'
            : 'border-white/10 focus:border-[var(--accent)] focus:shadow-[0_0_12px_var(--accent)]'
        }`}
        {...props}
      />
    );
  },
);

NeonInput.displayName = 'NeonInput';
