'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/app/context/AuthContext';
import { getDiscordAuthUrl, createRoom, joinRoom, guestLogin } from '@/lib/api';

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
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Gatekeeper />;
  }

  return <Dashboard user={user} />;
}

function Gatekeeper() {
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const { refresh } = useAuth();
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(
      window.location.hostname === 'localhost' ||
      window.location.search.includes('dev=1') ||
      process.env.NEXT_PUBLIC_DEV_MODE === 'true'
    );
  }, []);

  const handleGuest = async () => {
    setGuestLoading(true);
    setGuestError('');
    try {
      const { token } = await guestLogin(guestName.trim() || 'Guest');
      localStorage.setItem('blindtest_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      await refresh();
    } catch (e: any) {
      setGuestError(e.message);
    }
    setGuestLoading(false);
  };

  const discordUrl = typeof window !== 'undefined'
    ? getDiscordAuthUrl(window.location.origin)
    : getDiscordAuthUrl();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-[var(--primary)]">Blind</span>Test
        </h1>
        <p className="text-zinc-400 text-lg">Listen, guess, and compete with your friends.</p>
      </div>

      <motion.a
        href={discordUrl}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="px-10 py-5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-lg rounded-2xl transition-colors flex items-center gap-4 shadow-lg shadow-[#5865F2]/25"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
        </svg>
        Login with Discord
      </motion.a>

      {isDev && (
        <div className="w-full max-w-sm">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--bg)] px-4 text-sm text-zinc-500">Dev Mode</span>
            </div>
          </div>
          <div className="mt-4 bg-[var(--surface)] rounded-2xl border border-white/10 p-6 space-y-3">
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Guest name"
              maxLength={20}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-zinc-500 text-center focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
            <button
              onClick={handleGuest}
              disabled={guestLoading}
              className="w-full px-6 py-3 bg-zinc-600/30 hover:bg-zinc-600/50 disabled:opacity-50 text-white font-semibold rounded-xl border border-white/10 transition-colors"
            >
              {guestLoading ? 'Logging in...' : 'Continue as Guest'}
            </button>
            {guestError && <p className="text-red-400 text-xs text-center">{guestError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ user }: { user: any }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const { code, playerId } = await createRoom(user.username, [], user.avatar_url, user.role);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      localStorage.setItem('blindtest_name', user.username);
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      const { code: roomCode, playerId } = await joinRoom(joinCode, user.username, user.avatar_url, user.role);
      localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
      localStorage.setItem('blindtest_name', user.username);
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-4"
      >
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-8 bg-[var(--surface)] hover:bg-[var(--primary)]/10 border-2 border-dashed border-white/20 hover:border-[var(--primary)]/50 text-white font-bold text-xl rounded-2xl transition-all duration-200 flex items-center justify-center gap-4"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Lobby
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--bg)] px-4 text-sm text-zinc-500">or</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="font-semibold text-center">Join a Lobby</h3>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={4}
            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-zinc-500 text-center text-xl font-bold tracking-[0.3em] focus:outline-none focus:border-[var(--primary)] transition-colors uppercase"
          />
          <button
            onClick={handleJoin}
            disabled={loading || !joinCode.trim()}
            className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold rounded-xl border border-white/10 transition-colors"
          >
            {loading ? 'Joining...' : 'Join Lobby'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
