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
      className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group shadow-lg"
      style={{ boxShadow: `0 10px 30px -10px ${glowColor}` }}
    >
      <div className="absolute top-4 right-4 text-2xl opacity-20 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <p className="text-4xl font-extrabold tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="text-zinc-400 mt-2 text-xs font-semibold uppercase tracking-wider">
        {label}
      </p>
    </motion.div>
  );
}
