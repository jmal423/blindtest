'use client';

import { motion } from 'motion/react';

interface StatCardProps {
  value: number | string;
  label: string;
  color: string;
  glowColor: string;
  icon: string;
}

export function StatCard({ value, label, color, glowColor, icon }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-2xl p-5 relative overflow-hidden group shadow-lg"
      style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)', boxShadow: `0 10px 30px -10px ${glowColor}` }}
    >
      <div className="absolute top-4 right-4 text-2xl opacity-15 group-hover:scale-110 transition-transform pointer-events-none">
        {icon}
      </div>
      <p className="text-3xl font-black tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>
        {label}
      </p>
    </motion.div>
  );
}
