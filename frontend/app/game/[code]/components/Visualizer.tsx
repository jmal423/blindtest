'use client';

import { motion } from 'motion/react';

const BAR_COUNT = 7;

export function Visualizer() {
  return (
    <div className="flex items-end justify-center gap-[3px] md:gap-1 h-16 md:h-24">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="w-[6px] md:w-2 rounded-full bg-primary"
          animate={{
            height: [
              `${Math.random() * 60 + 10}px`,
              `${Math.random() * 60 + 10}px`,
              `${Math.random() * 60 + 10}px`,
              `${Math.random() * 60 + 10}px`,
            ],
          }}
          transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity, delay: i * 0.07 }}
          style={{ opacity: 0.7 + (i / BAR_COUNT) * 0.3 }}
        />
      ))}
    </div>
  );
}
