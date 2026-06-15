'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useAuth } from '@/app/context/AuthContext';
import { getDiscordAuthUrl, createRoom, joinRoom, getLeaderboard, fetchGenres, fetchGenreGroups } from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';
import { isDiscordActivity, getChannelId } from '@/lib/discordActivity';
import { findRoomByChannelId } from '@/lib/api';

function MusicVisualizer() {
  return (
    <div className="relative w-60 h-60 md:w-72 md:h-72 flex items-center justify-center">
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full border border-[var(--primary)]/20 blur-[2px]"
      />
      <motion.div
        animate={{ scale: [1, 1.28, 1], opacity: [0.08, 0.22, 0.08] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 0.5 }}
        className="absolute -inset-4 rounded-full border border-[var(--accent)]/15 blur-[3px]"
      />
      <motion.div
        animate={{ scale: [1, 1.38, 1], opacity: [0.03, 0.12, 0.03] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
        className="absolute -inset-8 rounded-full border border-[var(--primary)]/10 blur-[4px]"
      />

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
        className="relative w-44 h-44 md:w-56 md:h-56 rounded-full bg-zinc-950 flex items-center justify-center shadow-2xl border-4 border-zinc-900 group"
      >
        <div className="absolute inset-2 rounded-full border border-white/5 opacity-40" />
        <div className="absolute inset-5 rounded-full border border-white/5 opacity-30" />
        <div className="absolute inset-8 rounded-full border border-white/5 opacity-20" />
        <div className="absolute inset-12 rounded-full border border-white/5 opacity-10" />
        <div className="absolute inset-16 rounded-full border border-white/5 opacity-5" />

        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] flex items-center justify-center border-2 border-zinc-950 relative shadow-inner">
          <div className="w-4 h-4 rounded-full bg-[var(--background)] border border-black shadow shadow-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          </div>
          <div className="absolute inset-1 rounded-full border border-white/20 pointer-events-none" />
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -15, 0], x: [0, 10, 0], opacity: [0, 0.8, 0], scale: [0.8, 1, 0.8] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-8 left-12 text-lg text-[var(--primary)]"
      >
        🎵
      </motion.div>
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, -12, 0], opacity: [0, 0.7, 0], scale: [0.7, 1.1, 0.7] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1.5 }}
        className="absolute bottom-12 right-10 text-xl text-[var(--accent)]"
      >
        🎶
      </motion.div>
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 8, 0], opacity: [0, 0.6, 0], scale: [0.9, 1.2, 0.9] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 3 }}
        className="absolute top-16 right-12 text-sm text-[var(--accent)]"
      >
        🎸
      </motion.div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      localStorage.setItem('blindtest_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      refresh().finally(() => setProcessing(false));
      return;
    }

    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setProcessing(false);
      return;
    }

    if (!loading) setProcessing(false);
  }, [loading, refresh]);

  if (processing || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground/40 text-sm font-medium animate-pulse">Entering Lobbies...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

function LoginScreen() {
  const { t } = useTranslation();

  const discordUrl = typeof window !== 'undefined'
    ? getDiscordAuthUrl(window.location.origin)
    : getDiscordAuthUrl();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-10 max-w-4xl mx-auto w-full relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[var(--primary)]/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col lg:flex-row items-center justify-center gap-12 w-full"
      >
        <div className="flex-1 flex items-center justify-center">
          <MusicVisualizer />
        </div>

        <div className="flex-1 max-w-sm w-full space-y-6">
          <div className="text-center lg:text-left space-y-3">
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight leading-none uppercase">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] drop-shadow-[0_2px_10px_rgba(255,45,120,0.3)]">Blind</span>
              <span className="text-foreground">Test</span>
            </h1>
            <p className="text-foreground/40 text-sm font-semibold tracking-wide uppercase leading-relaxed">{t('subtitle')}</p>
          </div>

          <div className="bg-[var(--surface)]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]" />
            <p className="text-xs text-foreground/40 font-bold tracking-wide uppercase text-center lg:text-left">
              Connect your account to play and track stats
            </p>

            <motion.a
              href={discordUrl}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-foreground font-black text-sm rounded-2xl transition-all shadow-lg shadow-[#5865F2]/20 cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
              {t('login_button')}
            </motion.a>

            <div className="pt-2 flex justify-center border-t border-white/5">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const discordContext = isDiscordActivity();

  const { user, loading: authLoading } = useAuth();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!discordContext || authLoading || !user || redirectingRef.current) return;
    redirectingRef.current = true;
    const channelId = getChannelId();
    (async () => {
      if (channelId) {
        const existing = await findRoomByChannelId(channelId);
        if (existing?.code) {
          const { code: roomCode, playerId } = await joinRoom(existing.code);
          localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
          router.replace(`/game/${roomCode}`);
          return;
        }
      }
      let allGenreIds: string[] = [];
      try {
        const groups = await fetchGenreGroups();
        allGenreIds = groups.genres.map(g => g.id);
      } catch {
        try { allGenreIds = (await fetchGenres()).map(g => g.id); } catch {}
      }
      const { code, playerId } = await createRoom(allGenreIds, undefined, undefined, channelId || undefined);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      router.replace(`/game/${code}`);
    })();
  }, [discordContext, authLoading, user, router]);

  useEffect(() => {
    getLeaderboard()
      .then(d => setLeaderboard(d))
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const { code, playerId } = await createRoom([]);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('something_went_wrong'));
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError(t('enter_room_code'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { code: roomCode, playerId } = await joinRoom(joinCode);
      localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('something_went_wrong'));
      setLoading(false);
    }
  };

  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center p-4 md:p-8 gap-8 max-w-6xl mx-auto w-full relative">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary)]/5 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-[var(--accent)]/5 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="flex-1 flex flex-col items-center justify-center gap-8 min-w-0">
        <div className="text-center space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-black tracking-tight uppercase"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] drop-shadow-[0_2px_10px_rgba(255,45,120,0.25)]">Blind</span>
            <span className="text-foreground">Test</span>
          </motion.h1>
          <p className="text-foreground/40 text-sm font-semibold tracking-wide uppercase leading-relaxed">{t('subtitle')}</p>
        </div>

        {discordContext ? null : (
          <div className="bg-white/[0.01] backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]" />

            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <div className="flex-1">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] hover:brightness-110 text-foreground font-black text-sm rounded-2xl transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  {loading ? t('creating') : t('create_lobby')}
                </button>
                <p className="text-[10px] text-foreground/40 font-semibold text-center mt-2">{t('create_room_hint')}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:block w-px h-12 bg-white/5" />
                <span className="text-[10px] font-black uppercase text-foreground/30">OR</span>
                <div className="hidden md:block w-px h-12 bg-white/5" />
              </div>

              <div className="flex-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={4}
                    className="flex-1 px-4 py-3 bg-background/50 border border-white/5 rounded-2xl text-center text-lg font-black tracking-[0.2em] text-[var(--accent)] placeholder-foreground/20 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all uppercase"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={loading || !joinCode.trim()}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-foreground hover:text-foreground font-bold rounded-2xl border border-white/5 transition-all text-xs cursor-pointer active:scale-[0.99]"
                  >
                    {loading ? t('joining') : t('join_lobby')}
                  </button>
                </div>
                <p className="text-[10px] text-foreground/40 font-semibold text-center mt-2">{t('join_room_hint')}</p>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-[11px] text-center font-medium bg-red-500/5 border-t border-red-500/10 px-5 py-3">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--surface)]/80 hover:bg-[var(--surface)] backdrop-blur-xl rounded-3xl border border-white/5 hover:border-white/10 p-5 text-center transition-all duration-300 group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4 text-[var(--primary)] border border-[var(--primary)]/20 transition-transform group-hover:scale-110 duration-300 relative">
                <div className="absolute inset-0 rounded-full bg-[var(--primary)]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <p className="text-xs font-black text-foreground/80 tracking-wide uppercase group-hover:text-foreground transition-colors">{t('feature_1_title')}</p>
              <p className="text-[10px] text-foreground/40 font-semibold mt-2 leading-relaxed">{t('feature_1_desc')}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[var(--surface)]/80 hover:bg-[var(--surface)] backdrop-blur-xl rounded-3xl border border-white/5 hover:border-white/10 p-5 text-center transition-all duration-300 group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4 text-[var(--accent)] border border-[var(--accent)]/20 transition-transform group-hover:scale-110 duration-300 relative">
                <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
              </div>
              <p className="text-xs font-black text-foreground/80 tracking-wide uppercase group-hover:text-foreground transition-colors">{t('feature_2_title')}</p>
              <p className="text-[10px] text-foreground/40 font-semibold mt-2 leading-relaxed">{t('feature_2_desc')}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--surface)]/80 hover:bg-[var(--surface)] backdrop-blur-xl rounded-3xl border border-white/5 hover:border-white/10 p-5 text-center transition-all duration-300 group shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 text-amber-400 border border-amber-500/20 transition-transform group-hover:scale-110 duration-300 relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <svg className="relative" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9Z"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9Z"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </div>
              <p className="text-xs font-black text-foreground/80 tracking-wide uppercase group-hover:text-foreground transition-colors">{t('feature_3_title')}</p>
              <p className="text-[10px] text-foreground/40 font-semibold mt-2 leading-relaxed">{t('feature_3_desc')}</p>
            </div>
          </motion.div>
        </div>

        <div className="flex lg:hidden w-full max-w-2xl">
          <MobileLeaderboard
            leaderboard={leaderboard}
            lbLoading={lbLoading}
            open={showMobileLeaderboard}
            onToggle={() => setShowMobileLeaderboard(!showMobileLeaderboard)}
          />
        </div>
      </div>

      <div className="hidden lg:flex w-80 shrink-0 flex-col bg-[var(--surface)]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-5 max-h-[85vh] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 blur-[50px] rounded-full pointer-events-none" />

        <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-foreground/40 flex items-center gap-2">
            <span className="text-[var(--accent)]">🏆</span> Leaderboard
          </h2>
          <Link href="/leaderboard" className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary)] hover:text-[var(--accent)] transition-colors cursor-pointer">
            View all
          </Link>
        </div>

        {lbLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
            <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-foreground/40 font-semibold animate-pulse">Loading Standings...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-xs text-foreground/40 font-medium">No scores yet</p>
          </div>
        ) : (
          <div className="space-y-2 flex-1 overflow-y-auto pr-1 select-none scrollbar-thin">
            {leaderboard.slice(0, 8).map((e, i) => {
              const rankColor = i === 0 ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5' : i === 1 ? 'text-foreground/80 border-foreground/20 bg-foreground/10' : i === 2 ? 'text-amber-600 border-amber-700/20 bg-amber-700/5' : 'text-foreground/40 border-white/5 bg-white/[0.01]';

              return (
                <Link
                  key={e.id || e.player_id}
                  href="/leaderboard"
                  className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.01] hover:bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300 group"
                >
                  <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black tabular-nums ${rankColor}`}>
                    {i === 0 ? '👑' : i === 1 ? '2' : i === 2 ? '3' : `${i + 1}`}
                  </span>

                  <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-xs font-black overflow-hidden shrink-0 border border-white/10 relative">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      (e.username || e.player_name || '?')[0].toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground/60 group-hover:text-foreground truncate transition-colors">
                      {e.username || e.player_name || 'Unknown'}
                    </p>
                    <p className="text-[9px] text-foreground/40 font-semibold">{e.games_played} games</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-[var(--accent)] tabular-nums">{e.total_score.toLocaleString()}</span>
                    <p className="text-[8px] font-bold text-foreground/40 uppercase tracking-wider">pts</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileLeaderboard({
  leaderboard,
  lbLoading,
  open,
  onToggle,
}: {
  leaderboard: any[];
  lbLoading: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="w-full bg-[var(--surface)]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 text-center hover:bg-white/[0.03] transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span className="text-lg">🏆</span>
        <span className="text-xs font-black text-foreground/60 uppercase tracking-wider">Leaderboard</span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="text-foreground/40 ml-1"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[var(--surface)]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 mt-2 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-foreground/40">Top Players</h2>
            <Link href="/leaderboard" className="text-[10px] font-bold text-[var(--primary)] hover:text-[var(--accent)] transition-colors">
              View all
            </Link>
          </div>
          {lbLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-4">No scores yet</p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.slice(0, 5).map((e, i) => (
                <Link
                  key={e.id || e.player_id}
                  href="/leaderboard"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-all group"
                >
                  <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black ${i === 0 ? 'text-yellow-400 border-yellow-500/20' : i === 1 ? 'text-foreground/80 border-foreground/20' : i === 2 ? 'text-amber-600 border-amber-700/20' : 'text-foreground/40 border-white/5'}`}>
                    {i === 0 ? '👑' : i + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold overflow-hidden border border-white/10">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      (e.username || e.player_name || '?')[0]
                    )}
                  </div>
                  <span className="flex-1 text-xs font-bold text-foreground/60 truncate">{e.username || e.player_name}</span>
                  <span className="text-xs font-extrabold text-[var(--accent)]">{e.total_score.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
