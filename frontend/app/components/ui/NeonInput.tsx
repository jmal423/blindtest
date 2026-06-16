'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';

interface NeonInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-4 py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl text-center font-black tracking-[0.15em] text-[var(--accent)] placeholder-white/20 outline-none transition-all duration-300 focus:border-[var(--accent)] focus:shadow-[0_0_12px_var(--accent)] ${className}`}
        {...props}
      />
    );
  },
);

NeonInput.displayName = 'NeonInput';
