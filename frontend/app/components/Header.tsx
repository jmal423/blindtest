'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { getMyStats, getInvites, declineInvite } from '@/lib/api';
import { useAuth } from '@/app/context/AuthContext';
import { isDebugMode, setDebugMode } from '@/lib/debug-context';
import { useTranslation } from '@/lib/useTranslation';
import { useSound } from '@/lib/useSound';
import SettingsModal from './SettingsModal';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const playSound = useSound();
  const [stats, setStats] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDebugOn(isDebugMode());
  }, []);

  useEffect(() => {
    if (open && user) {
      getMyStats().then(setStats).catch(() => {});
    }
  }, [open, user]);

  const [activeInvite, setActiveInvite] = useState<any>(null);
  const dismissedInviteIdsRef = useRef<Set<string>>(new Set());
  const lastInviteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveInvite(null);
      return;
    }

    const poll = async () => {
      try {
        const list = await getInvites();
        const fresh = list.find(inv => !dismissedInviteIdsRef.current.has(inv.id));
        if (fresh) {
          setActiveInvite(fresh);
          if (lastInviteIdRef.current !== fresh.id) {
            playSound('notification');
            lastInviteIdRef.current = fresh.id;
          }
        } else {
          setActiveInvite(null);
          lastInviteIdRef.current = null;
        }
      } catch (err) {
        console.error('Failed to poll invites:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [user]);

  const handleJoinInvite = async () => {
    if (!activeInvite) return;
    const code = activeInvite.roomCode;
    const inviteId = activeInvite.id;
    dismissedInviteIdsRef.current.add(inviteId);
    setActiveInvite(null);
    try {
      await declineInvite(inviteId);
    } catch {}
    router.push(`/game/${code}`);
  };

  const handleDeclineInvite = async () => {
    if (!activeInvite) return;
    const inviteId = activeInvite.id;
    dismissedInviteIdsRef.current.add(inviteId);
    setActiveInvite(null);
    try {
      await declineInvite(inviteId);
    } catch {}
  };

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
    <>
      <header className="sticky top-0 z-40 border-b border-foreground/5 flex items-center justify-between px-4 md:px-6 py-3.5 shadow-sm">
        {/* Background layer for blur & opacity that doesn't create a containing block for fixed descendants */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-xl -z-10 pointer-events-none" />

        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity group">
          <h1 className="text-lg md:text-xl font-black tracking-tight uppercase flex items-center gap-0.5">
            <span className="text-primary group-hover:text-primary-hover transition-all">
              Blind
            </span>
            <span className="text-foreground transition-all">
              Test
            </span>
          </h1>
        </Link>

        {showMenu && (
          <div ref={menuRef} className="relative">
            {/* User Profile Avatar Trigger */}
            <button
              onClick={() => setOpen(!open)}
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[var(--primary)] active:ring-[var(--primary)] transition-all duration-200 flex items-center justify-center bg-surface-light text-xs font-bold shadow-md cursor-pointer border border-foreground/10"
              aria-label="Open menu"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase() || '?'
              )}
            </button>

            {/* Overlay for mobile drawer */}
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:bg-transparent"
                  onClick={close}
                />
              )}
            </AnimatePresence>

            {/* User Dropdown Panel */}
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  className="fixed left-4 right-4 bottom-4 md:absolute md:left-auto md:right-0 md:bottom-auto md:top-12 md:w-72 bg-surface/90 backdrop-blur-2xl border border-foreground/10 rounded-3xl md:rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[85dvh] md:max-h-[70vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0 text-foreground"
                >
                  {user && (
                    <>
                      {/* User profile info banner */}
                      <div className="p-4 border-b border-foreground/5 bg-foreground/[0.01]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-foreground/10 bg-surface-light flex items-center justify-center font-bold">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              user.username[0].toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-sm text-foreground truncate">
                              {user.username}
                            </p>
                            {user.role === 'admin' ? (
                              <span className="inline-block mt-0.5 rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
                                ADMIN
                              </span>
                            ) : (
                              <span className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Player</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats Dashboard Grid */}
                      <div className="p-4 border-b border-foreground/5 bg-foreground/[0.01]">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center bg-foreground/[0.02] border border-foreground/5 py-2 rounded-xl">
                            <p className="text-sm font-black text-[var(--accent)] tabular-nums">{stats?.totalPoints ?? '-'}</p>
                            <p className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider mt-0.5">{t('score')}</p>
                          </div>
                          <div className="text-center bg-foreground/[0.02] border border-foreground/5 py-2 rounded-xl">
                            <p className="text-sm font-black text-foreground tabular-nums">{stats?.gamesPlayed ?? '-'}</p>
                            <p className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider mt-0.5">Games</p>
                          </div>
                          <div className="text-center bg-foreground/[0.02] border border-foreground/5 py-2 rounded-xl overflow-hidden">
                            <p className="text-sm font-black text-foreground capitalize truncate px-1">
                              {stats?.bestGenre
                                ? stats.bestGenre.split('-')[0]
                                : '-'}
                            </p>
                            <p className="text-[8px] font-bold text-foreground/50 uppercase tracking-wider mt-0.5">{t('best_genre')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Options */}
                      <div className="p-2 space-y-0.5">
                        <Link
                          href="/profile"
                          onClick={close}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold text-foreground/80 hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all w-full cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          {t('profile')}
                        </Link>

                        <button
                          onClick={() => { close(); setShowSettings(true); }}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold text-foreground/80 hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all w-full cursor-pointer text-left"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                          </svg>
                          {t('settings_menu')}
                        </button>

                        <div className="px-3.5 py-2">
                          <LanguageSwitcher />
                        </div>

                        {user?.role === 'admin' && (
                          <>
                            <Link
                              href="/admin"
                              onClick={close}
                              className="flex items-center gap-3 px-3.5 py-2.5 text-xs font-black text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-xl transition-all w-full cursor-pointer"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                              </svg>
                              {t('admin_panel')}
                            </Link>

                            <div className="flex items-center justify-between px-3.5 py-2 text-xs font-bold text-foreground/80">
                              <span className="flex items-center gap-3">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                </svg>
                                {t('debug')}
                              </span>
                              <button
                                onClick={toggleDebug}
                                className={`relative w-9 h-5 rounded-full transition-all duration-300 cursor-pointer ${
                                  debugOn ? 'bg-[var(--primary)]' : 'bg-surface-light border border-foreground/5'
                                }`}
                              >
                                <motion.div
                                  animate={{ x: debugOn ? 18 : 2 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  className="absolute top-[2px] w-3 h-3 bg-white rounded-full shadow"
                                />
                              </button>
                            </div>
                          </>
                        )}

                        <div className="h-px bg-foreground/5 my-1" />

                        <button
                          onClick={handleDisconnect}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer text-left"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      </header>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <AnimatePresence>
        {activeInvite && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-[9999] max-w-sm w-[calc(100vw-32px)] bg-zinc-950/90 border border-white/10 backdrop-blur-2xl p-4 rounded-2xl shadow-2xl flex flex-col gap-3 text-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shadow">
                <svg className="w-5 h-5 animate-bounce text-[var(--primary)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.07 6.07 0 00-1-1v-1a6 6 0 00-12 0v1a6.07 6.07 0 00-1 1v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Lobby Invitation</p>
                <p className="text-xs text-zinc-200 mt-0.5">
                  <span className="font-extrabold text-white">{activeInvite.fromUser}</span> invited you to join room <span className="font-mono font-bold text-[var(--accent)]">{activeInvite.roomCode}</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleJoinInvite}
                className="flex-1 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer text-center"
              >
                Join Room
              </button>
              <button
                onClick={handleDeclineInvite}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Decline
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
