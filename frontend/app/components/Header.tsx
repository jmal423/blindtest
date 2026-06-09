'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { getMyStats } from '@/lib/api';
import { useAuth } from '@/app/context/AuthContext';
import { isDebugMode, setDebugMode } from '@/lib/debug-context';
import { useTranslation } from '@/lib/useTranslation';
import SettingsModal from './SettingsModal';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inGame = pathname.startsWith('/game/');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDebugOn(isDebugMode());
  }, []);

  useEffect(() => {
    if (open && user) {
      getMyStats().then(setStats).catch(() => {});
    }
  }, [open, user]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleEvent = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleEvent);
    document.addEventListener('touchstart', handleEvent);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleEvent);
      document.removeEventListener('touchstart', handleEvent);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  const handleDisconnect = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('blindtest_player_')) localStorage.removeItem(key);
    }
    signOut();
    close();
    router.push('/');
  };

  const toggleDebug = () => {
    const next = !debugOn;
    setDebugOn(next);
    setDebugMode(next);
  };

  const showMenu = user;

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <h1 className="text-lg md:text-xl font-bold tracking-tight">
          <span className="text-[var(--primary)]">Blind</span>
          <span>Test</span>
        </h1>
      </Link>

      {showMenu && (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[var(--primary)] active:ring-[var(--primary)] transition-all duration-200 flex items-center justify-center bg-[var(--primary)] text-sm font-bold"
            aria-label="Open menu"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              user?.username?.[0]?.toUpperCase() || '?'
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/50 md:bg-transparent"
                onClick={close}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed left-0 right-0 bottom-0 md:left-auto md:right-0 md:bottom-auto md:top-12 md:w-72 bg-[var(--surface)] border border-white/10 rounded-t-2xl md:rounded-xl shadow-2xl overflow-hidden z-50 max-h-[80dvh] md:max-h-[70vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
              >
                {user && (
                  <>
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold">
                              {user.username[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">
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
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-[var(--accent)]">{stats?.totalPoints ?? '-'}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('score')}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{stats?.gamesPlayed ?? '-'}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Games</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-white capitalize">
                            {stats?.bestGenre
                              ? stats.bestGenre.replace('-', ' ')
                              : '-'}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('best_genre')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 space-y-0.5">
                      <Link
                      href="/profile"
                      onClick={close}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      {t('profile')}
                    </Link>

                  <button
                    onClick={() => { close(); setShowSettings(true); }}
                    className="flex items-center gap-3 px-3 py-3 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors w-full"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                    {t('settings_menu')}
                  </button>

                  <div className="px-3 py-2">
                    <LanguageSwitcher />
                  </div>

                  {user?.role === 'admin' && (
                    <>
                      <Link
                        href="/admin"
                        onClick={close}
                        className="flex items-center gap-3 px-3 py-3 text-sm text-[#00cec9] hover:bg-[#00cec9]/10 rounded-lg transition-colors font-semibold"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        {t('admin_panel')}
                      </Link>

                      <div className="flex items-center justify-between px-3 py-3 text-sm text-zinc-300">
                        <span className="flex items-center gap-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                          </svg>
                          {t('debug')}
                        </span>
                        <button
                          onClick={toggleDebug}
                          className={`relative w-11 h-6 rounded-full transition-colors ${debugOn ? 'bg-[var(--primary)]' : 'bg-zinc-600'}`}
                        >
                          <motion.div
                            animate={{ x: debugOn ? 22 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                          />
                        </button>
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    {t('disconnect')}
                  </button>
                </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
