'use client';

import { motion } from 'motion/react';

interface VisualizerProps {
  barCount?: number;
  className?: string;
  barClassName?: string;
}

export function Visualizer({ 
  barCount = 7, 
  className = "flex items-end justify-center gap-[3px] md:gap-1 h-16 md:h-24",
  barClassName = "w-[6px] md:w-2 rounded-full bg-primary"
}: VisualizerProps) {
  return (
    <div className={className}>
      {Array.from({ length: barCount }, (_, i) => (
        <motion.div
          key={i}
          className={barClassName}
          animate={{
            height: [
              `${Math.random() * 60 + 10}%`,
              `${Math.random() * 60 + 10}%`,
              `${Math.random() * 60 + 10}%`,
              `${Math.random() * 60 + 10}%`,
            ],
          }}
          transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity, delay: i * 0.07 }}
          style={{ opacity: 0.7 + (i / barCount) * 0.3 }}
        />
      ))}
    </div>
  );
}
