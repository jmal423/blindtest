'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { getMe, getToken, getDiscordAuthUrl, getLeaderboard, createRoom, joinRoom, fetchGenres } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (getToken()) {
      getMe().then(u => { setUser(u); setChecking(false); }).catch(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center max-w-md">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-[var(--primary)]">Blind</span>Test
          </h1>
          <p className="text-zinc-400 text-lg">Listen, guess, and compete with your friends.</p>
        </div>

        <motion.a
          href={getDiscordAuthUrl()}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="px-10 py-5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-lg rounded-2xl transition-colors flex items-center gap-4 shadow-lg shadow-[#5865F2]/25"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
          Login with Discord
        </motion.a>
      </div>
    );
  }

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: any }) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);
  const [createGenres, setCreateGenres] = useState<string[]>(['pop']);
  const [createRounds, setCreateRounds] = useState(10);
  const [createTime, setCreateTime] = useState(15);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLeaderboard().then(setLeaderboard).catch(() => {});
    fetchGenres().then(setAllGenres).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const { code, playerId } = await createRoom(user.username, createGenres, user.avatar_url, user.role);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
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
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const toggleGenre = (id: string) => {
    const set = new Set(createGenres);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    if (set.size > 0) setCreateGenres(Array.from(set));
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 space-y-5">
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
                <p className="text-sm text-zinc-400">Playing as</p>
                <p className="font-semibold">
                  {user.username}
                  {user.role === 'admin' && (
                    <span className="ml-2 rounded bg-[#00cec9]/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#00cec9] ring-1 ring-[#00cec9]/50">
                      ADMIN
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-zinc-400 font-medium mb-2">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {allGenres.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      createGenres.includes(g.id)
                        ? 'bg-[var(--primary)]/20 border-[var(--primary)]/50 text-[var(--primary)]'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 font-medium">Rounds</label>
                <input
                  type="number"
                  value={createRounds}
                  onChange={e => setCreateRounds(Math.max(3, Math.min(25, Number(e.target.value))))}
                  className="w-full mt-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 font-medium">Round Time (s)</label>
                <input
                  type="number"
                  value={createTime}
                  onChange={e => setCreateTime(Math.max(8, Math.min(30, Number(e.target.value))))}
                  className="w-full mt-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold">Join a Room</h3>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code (e.g. ABCD)"
              maxLength={4}
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-zinc-500 text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:border-[var(--primary)] transition-colors uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold rounded-xl border border-white/10 transition-colors"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1"
        >
          <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-5 sticky top-20">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9z"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9z"/>
                <path d="M4 22h16"/>
                <path d="M10 22V2h4v20"/>
              </svg>
              Leaderboard
            </h3>
            <div className="space-y-1">
              {leaderboard.slice(0, 10).map((e: any, i: number) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                    i === 0 ? 'bg-yellow-500/10' : i === 1 ? 'bg-zinc-300/5' : i === 2 ? 'bg-amber-600/10' : ''
                  }`}
                >
                  <span className={`w-5 text-center text-xs font-bold ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center text-[10px] font-bold">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      e.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="flex-1 text-sm truncate">{e.username}</span>
                  <span className="text-xs font-semibold text-[var(--accent)]">{e.total_score}</span>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">No games played yet.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
