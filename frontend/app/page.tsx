'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/app/context/AuthContext';
import {
  createRoom,
  joinRoom,
  getLeaderboard,
} from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import {
  isDiscordActivity,
  getChannelId,
  getChannelName,
  subscribeToParticipants,
  getDiscordSdk,
} from '@/lib/discordActivity';
import type { DiscordParticipant } from '@/lib/discordActivity';
import { findRoomByChannelId } from '@/lib/api';
import { NeonButton } from '@/app/components/ui/NeonButton';
import { NeonInput } from '@/app/components/ui/NeonInput';

/* ------------------------------------------------------------------ */
/*  Neon Background Orbs                                                */
/* ------------------------------------------------------------------ */

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-[var(--primary)]/4 blur-[120px]" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent)]/4 blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--primary)]/3 blur-[150px]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Screen                                                      */
/* ------------------------------------------------------------------ */

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex-1 w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        <p className="text-sm text-foreground/40 font-semibold tracking-wide animate-pulse">
          {t('loading')}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Branding                                                            */
/* ------------------------------------------------------------------ */

function Branding() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="text-center max-w-full"
    >
      <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight uppercase leading-none max-w-full">
        <span
          className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
          style={{ filter: 'drop-shadow(0 0 20px color-mix(in srgb, var(--primary) 35%, transparent)) drop-shadow(0 0 60px color-mix(in srgb, var(--primary) 15%, transparent))' }}
        >
          Blind
        </span>
        <span className="text-foreground">Test</span>
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-2 md:mt-3 text-xs md:text-sm text-foreground/40 font-semibold tracking-[0.2em] uppercase"
      >
        {t('tagline')}
      </motion.p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Action Area                                                         */
/* ------------------------------------------------------------------ */

function ActionArea({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const discordContext = isDiscordActivity();

  /* Discord voice channel state */
  const [channelName, setChannelName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<DiscordParticipant[]>([]);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordError, setDiscordError] = useState('');

  useEffect(() => {
    if (!discordContext) return;
    getChannelName().then(setChannelName).catch(() => {});
    const unsub = subscribeToParticipants(setParticipants);
    return () => unsub();
  }, [discordContext]);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const { code, playerId } = await createRoom([], undefined, 'genre');
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      onNavigate();
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('something_went_wrong'));
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim().length < 6) {
      setError(t('enter_room_code'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { code: roomCode, playerId } = await joinRoom(joinCode);
      localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
      onNavigate();
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('something_went_wrong'));
      setLoading(false);
    }
  };

  const handleDiscordPlay = async () => {
    setDiscordLoading(true);
    setDiscordError('');
    try {
      const channelId = getChannelId();
      let code: string;
      if (channelId) {
        const existing = await findRoomByChannelId(channelId);
        if (existing?.code) {
          const result = await joinRoom(existing.code);
          code = result.code;
        } else {
          const result = await createRoom([], undefined, undefined, channelId);
          code = result.code;
        }
      } else {
        const result = await createRoom([]);
        code = result.code;
      }
      const { playerId } = await joinRoom(code);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      onNavigate();
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setDiscordError(
        err instanceof Error ? err.message : t('something_went_wrong'),
      );
      setDiscordLoading(false);
    }
  };

  /* ── Discord Path ── */
  if (discordContext) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="w-full max-w-sm space-y-4"
      >
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl p-5 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#5865F2] to-[var(--accent)]" />

          <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-[#5865F2]/15 flex items-center justify-center border border-[#5865F2]/20 shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground/90 truncate">
                {channelName || t('discord_voice')}
              </h3>
              <p className="text-[10px] text-foreground/40 font-semibold">
                {participants.length} {t('connected')}
              </p>
            </div>
          </div>

          {participants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl text-[11px] text-foreground/80"
                >
                  <span className="w-5 h-5 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[9px] font-bold shrink-0">
                    {p.global_name?.[0] || p.username?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span className="truncate max-w-[120px] font-medium">
                    {p.global_name || p.username}
                  </span>
                </div>
              ))}
            </div>
          )}

          {discordError && (
            <p className="text-red-400 text-[11px] text-center font-medium bg-red-500/5 rounded-xl px-4 py-2 mb-3">
              {discordError}
            </p>
          )}

          <NeonButton
            variant="discord"
            disabled={discordLoading}
            onClick={handleDiscordPlay}
            className="w-full"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {discordLoading
              ? t('joining')
              : t('play_with_voice')}
          </NeonButton>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
            {t('or_join_with_code')}
          </span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <div className="flex gap-2">
          <NeonInput
            type="text"
            value={joinCode}
            onChange={(e) => { setError(''); setJoinCode(e.target.value.toUpperCase()); }}
            placeholder={t('room_code_placeholder')}
            maxLength={6}
            error={!!error}
          />
          <NeonButton
            variant="secondary"
            onClick={handleJoin}
            disabled={loading || joinCode.trim().length < 6}
            className="px-5 py-3 shrink-0"
            style={{
              opacity: joinCode.trim().length >= 6 ? 1 : 0.4,
            }}
          >
            {loading ? t('joining') : t('join_lobby')}
          </NeonButton>
        </div>

      {error && (
        <p className="text-red-400 text-[11px] text-center font-medium animate-pulse">
          {error}
        </p>
      )}

      <Link
        href="/leaderboard"
        className="block w-full text-center py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-extrabold tracking-wide uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/5"
      >
        🏆 {t('leaderboard_title')}
      </Link>
      </motion.div>
    );
  }

  /* ── Normal Web Path ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="w-full max-w-sm space-y-4"
    >
      <NeonButton
        variant="primary"
        onClick={handleCreate}
        disabled={loading}
        className="w-full shadow-[0_0_20px_var(--primary)] hover:shadow-[0_0_40px_var(--primary)]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {loading ? t('creating') : t('create_lobby')}
      </NeonButton>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
          {t('or_join')}
        </span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <div className="flex gap-2">
        <NeonInput
          type="text"
          value={joinCode}
          onChange={(e) => { setError(''); setJoinCode(e.target.value.toUpperCase()); }}
          placeholder={t('room_code_placeholder')}
          maxLength={6}
          error={!!error}
        />
        <NeonButton
          variant="secondary"
          onClick={handleJoin}
          disabled={loading || joinCode.trim().length < 6}
          className="px-5 py-3 shrink-0"
          style={{
            opacity: joinCode.trim().length >= 6 ? 1 : 0.4,
          }}
        >
          {loading ? t('joining') : t('join_lobby')}
        </NeonButton>
      </div>

      {error && (
        <p className="text-red-400 text-[11px] text-center font-medium animate-pulse">
          {error}
        </p>
      )}

      <Link
        href="/leaderboard"
        className="block w-full text-center py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-extrabold tracking-wide uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/5"
      >
        🏆 {t('leaderboard_title')}
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard Sidebar                                                 */
/* ------------------------------------------------------------------ */

function LeaderboardSidebar() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    getLeaderboard()
      .then((d) => {
        setLeaderboard(d);
        if (d.length > 0) setSelectedId(d[0].id);
      })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const selectedEntry = leaderboard.find(e => e.id === selectedId);

  useEffect(() => {
    if (!selectedId) { setSelectedStats(null); return; }
    setStatsLoading(true);
    import('@/lib/api').then(({ getUserStats }) => {
      getUserStats(selectedId)
        .then(setSelectedStats)
        .catch(() => setSelectedStats(null))
        .finally(() => setStatsLoading(false));
    });
  }, [selectedId]);

  const s1 = selectedStats;

  return (
    <aside className="hidden xl:flex flex-col w-full bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl overflow-y-auto max-h-[calc(100vh-12rem)]" style={{ minHeight: '500px' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground/40 flex items-center gap-2">
          <span>🏆</span> Leaderboard
        </h2>
        <Link href="/leaderboard" className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--primary)] hover:text-[var(--accent)]">
          View all
        </Link>
      </div>

      {lbLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-xs text-foreground/40 font-medium">No scores yet</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {leaderboard.slice(0, 50).map((e, i) => (
            <div key={e.id || e.player_id} onClick={() => setSelectedId(e.id)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${selectedId === e.id ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30' : 'bg-white/[0.01] hover:bg-white/[0.03] border-transparent hover:border-white/5'}`}>
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-foreground/80' : i === 2 ? 'text-amber-600' : 'text-foreground/40'}`}>
                {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <div className="w-7 h-7 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 border border-white/10">
                {e.avatar_url ? <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : (e.username || e.player_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground/70 truncate">{e.username || e.player_name || 'Unknown'}</p>
              </div>
              <span className="text-xs font-extrabold text-[var(--accent)] tabular-nums">{e.total_score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Login Screen                                                        */
/* ------------------------------------------------------------------ */

function LoginScreen() {
  const { t } = useTranslation();

  const discordUrl =
    typeof window !== 'undefined'
      ? `/api/auth/discord?redirect=${encodeURIComponent(window.location.origin)}`
      : '/api/auth/discord';

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-6 relative bg-background">
      <BackgroundOrbs />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-10 w-full max-w-sm"
      >
        <Branding />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-xs text-foreground/40 font-semibold tracking-wide text-center leading-relaxed"
        >
          {t('login_desc')}
        </motion.p>

        <motion.a
          href={discordUrl}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-foreground font-black text-sm rounded-2xl transition-all shadow-lg shadow-[#5865F2]/20 cursor-pointer"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
          </svg>
          {t('login_button')}
        </motion.a>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard (Authenticated)                                           */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const [navigating, setNavigating] = useState(false);

  const DISCORD_INVITE = 'https://discord.gg/FtFTcpVtAA';
  const handleDiscordInvite = () => {
    const sdk = getDiscordSdk();
    if (sdk?.commands?.openExternalLink) {
      sdk.commands.openExternalLink({ url: DISCORD_INVITE });
    } else {
      window.open(DISCORD_INVITE, '_blank', 'noopener,noreferrer');
    }
  };

  if (navigating) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <BackgroundOrbs />

      {/* Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] xl:grid-cols-[1fr_2fr_1fr] gap-6 px-4 md:px-6 pb-6 min-h-0 w-full pt-6 md:pt-8">
        {/* Left: Discord Card (order-last on mobile) */}
        <div className="hidden lg:flex sticky top-0 self-stretch w-full flex items-center justify-center order-last lg:order-first">
          <button
            onClick={handleDiscordInvite}
            className="w-full max-w-[300px] h-[200px] rounded-3xl bg-[var(--discord)]/10 hover:bg-[var(--discord)]/15 border border-[var(--discord)]/30 hover:border-[var(--discord)]/50 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center gap-3 p-6 group cursor-pointer text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--discord)]/20 flex items-center justify-center border border-[var(--discord)]/30 group-hover:bg-[var(--discord)]/30 transition-all">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--discord)">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[var(--discord)] font-black text-sm uppercase tracking-wider">Join our Discord</p>
              <p className="text-[var(--discord)]/60 text-[10px] font-semibold mt-1">Chat, find players, get updates</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--discord)]/40 group-hover:text-[var(--discord)]/70 transition-colors">
              Click to join →
            </span>
          </button>
        </div>

        {/* Center: Branding + Play Button & Code */}
        <div className="flex flex-col items-center justify-center gap-4 md:gap-6 w-full self-stretch">
          <Branding />
          <ActionArea onNavigate={() => setNavigating(true)} />
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            onClick={handleDiscordInvite}
            className="lg:hidden w-full max-w-xs text-center py-3 rounded-2xl bg-[var(--discord)]/10 hover:bg-[var(--discord)]/20 border border-[var(--discord)]/30 hover:border-[var(--discord)]/50 text-[var(--discord)] hover:text-[var(--discord)] text-xs font-extrabold tracking-wide uppercase transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
            </svg>
            Join our Discord
          </motion.button>
        </div>

        {/* Right: Leaderboard (sticky, same height as siblings) */}
        <div className="lg:sticky lg:top-0 self-stretch w-full flex items-center justify-center">
          <LeaderboardSidebar />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home Page                                                           */
/* ------------------------------------------------------------------ */

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

  if (processing || loading) return <LoadingScreen />;

  if (!user) return <LoginScreen />;

  return <Dashboard />;
}
