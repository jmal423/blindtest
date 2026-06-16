'use client';

import { motion, type HTMLMotionProps } from 'motion/react';

interface NeonButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'discord';
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-foreground shadow-lg shadow-[var(--primary)]/20',
  secondary:
    'bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-foreground border border-white/10',
  discord:
    'bg-[#5865F2] hover:bg-[#4752C4] text-foreground shadow-lg shadow-[#5865F2]/20',
};

export function NeonButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: NeonButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden rounded-2xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 px-6 py-4 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
