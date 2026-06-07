'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { getMe, getMyStats, getToken } from '@/lib/api';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (getToken()) {
      getMe().then(setUser).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      getMyStats().then(setStats).catch(() => {});
    }
  }, [open, user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleDisconnect = () => {
    localStorage.removeItem('blindtest_token');
    setUser(null);
    setOpen(false);
    router.push('/');
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/10">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-[var(--primary)]">Blind</span>
          <span>Test</span>
        </h1>
      </Link>

      {user && (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[var(--primary)] transition-all duration-200"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold">
                {user.username[0].toUpperCase()}
              </div>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-64 bg-[var(--surface)] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold">
                          {user.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {user.username}
                        {user.role === 'admin' && (
                          <span className="ml-2 rounded bg-[#00cec9]/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#00cec9] ring-1 ring-[#00cec9]/50">
                            ADMIN
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-b border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[var(--accent)]">{stats?.totalPoints ?? '-'}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{stats?.gamesPlayed ?? '-'}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Games</p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Disconnect
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  );
}
