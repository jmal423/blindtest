'use client';

import { useState, useEffect, ReactNode } from 'react';

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;

export default function ResponsiveMinimized({ children }: { children: ReactNode }) {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const check = () => {
      const small = window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT;
      setTooSmall(small);
      document.body.style.overflow = small ? 'hidden' : '';
    };
    check();
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <>
      {children}
      {tooSmall && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <span className="text-5xl">🎵</span>
            <h1 className="text-2xl font-black tracking-tight uppercase">
              <span className="text-primary">Blind</span>
              <span className="text-foreground">Test</span>
            </h1>
            <p className="text-xs text-foreground/30">Game in progress — music continues</p>
          </div>
        </div>
      )}
    </>
  );
}
