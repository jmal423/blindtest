'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDiscordAuthUrl, getMe, getToken } from '@/lib/api';

export default function JoinRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe().then(u => {
        setUser(u);
        setName(u.username);
        setChecking(false);
      }).catch(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleJoin = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter a room code'); return; }

    setLoading(true);
    setError('');

    try {
      const { joinRoom } = await import('@/lib/api');
      const { code: roomCode, playerId } = await joinRoom(code, name);
      localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-sm mx-auto w-full">
        <h2 className="text-2xl font-bold">Join a Room</h2>
        <p className="text-zinc-400 text-center text-sm">
          Connect with Discord to save your scores and track your stats!
        </p>
        <a
          href={getDiscordAuthUrl()}
          className="w-full px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
          Login with Discord
        </a>
        <p className="text-zinc-600 text-xs">You can also continue without Discord</p>
        <button
          onClick={() => setUser({ username: '' })}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Continue as Guest
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-sm mx-auto w-full">
      <h2 className="text-2xl font-bold">Join a Room</h2>

      {user.avatar_url && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--surface)] rounded-xl">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700">
            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar_url}.png`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm text-zinc-300">{user.username}</span>
        </div>
      )}

      <div className="w-full space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 font-medium">Room Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD"
            maxLength={4}
            className="w-full px-4 py-3 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-[var(--primary)] transition-colors uppercase"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400 font-medium">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-4 py-3 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>
    </div>
  );
}
