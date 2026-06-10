'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, getMyScores, getFriends, getMyStats, sendFriendRequest, acceptFriendRequest, removeFriend } from '@/lib/api';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) { router.push('/login'); return; }

    getMe().then(setUser).catch(() => { localStorage.removeItem('blindtest_token'); router.push('/login'); });
    getMyScores().then(setScores).catch(() => {});
    getMyStats().then(setStats).catch(() => {});
    getFriends().then(d => { setFriends(d.friends); setPending(d.pending); }).catch(() => {});
  }, [router]);

  const handleAddFriend = async () => {
    if (!friendInput.trim()) return;
    setFriendError('');
    try {
      await sendFriendRequest(friendInput.trim());
      setFriendInput('');
    } catch (err: any) {
      setFriendError(err.message);
    }
  };

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(id);
    const d = await getFriends();
    setFriends(d.friends);
    setPending(d.pending);
  };

  const handleRemove = async (id: string) => {
    await removeFriend(id);
    const d = await getFriends();
    setFriends(d.friends);
  };

  if (!user) return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-2xl mx-auto w-full gap-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 bg-white/[0.01] border border-white/5 p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-extrabold text-[var(--primary)] overflow-hidden border-2 border-[var(--primary)] shadow-md">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            user.username[0].toUpperCase()
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{user.username}</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-500 font-semibold uppercase tracking-wider">User ID: {user.id}</span>
            {user.role === 'admin' && (
              <span className="text-[10px] bg-[#00cec9]/15 text-[#00cec9] px-2 py-0.5 rounded font-bold border border-[#00cec9]/30">ADMIN</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-[var(--accent)] tabular-nums">{stats?.totalPoints ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Total Points</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-[var(--primary)] tabular-nums">
            {stats?.averageSpeedMs != null ? `${(stats.averageSpeedMs / 1000).toFixed(1)}s` : '-'}
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Avg Speed</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all truncate">
          <p className="text-xl font-bold text-white capitalize truncate">{stats?.bestGenre ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1.5">Best Genre</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-[var(--accent)] tabular-nums">{stats?.gamesPlayed ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Games Played</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-[var(--primary)] tabular-nums">{stats?.bestScore ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Best Score</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-white tabular-nums">{stats?.perfects ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Perfects</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-white tabular-nums">{stats?.totalRounds ?? '-'}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Rounds</p>
        </div>
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-center shadow-md hover:bg-white/[0.02] hover:border-white/10 transition-all">
          <p className="text-2xl font-bold text-white tabular-nums">{friends.length}</p>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-1">Friends</p>
        </div>
      </div>

      {/* Friends Section */}
      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-zinc-200">Friends</h2>

        <div className="flex gap-2">
          <input
            type="text"
            value={friendInput}
            onChange={e => setFriendInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
            placeholder="Enter user ID to add friend..."
            className="flex-1 px-4 py-2.5 bg-black/20 border border-white/5 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30 transition-colors text-sm"
          />
          <button onClick={handleAddFriend} className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
            Add
          </button>
        </div>
        {friendError && <p className="text-red-400 text-xs font-medium bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-xl">{friendError}</p>}

        {pending.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Pending Requests ({pending.length})</p>
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.01] border border-white/5 rounded-xl shadow-sm">
                <span className="font-semibold text-sm text-zinc-300">{p.username}</span>
                <button onClick={() => handleAccept(p.id)} className="px-3.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-1">
          {friends.map(f => (
            <div key={f.id} className="group flex items-center justify-between px-4 py-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-xl transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold overflow-hidden border border-white/10">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    f.username[0].toUpperCase()
                  )}
                </div>
                <span className="font-semibold text-sm text-zinc-300">{f.username}</span>
              </div>
              <button onClick={() => handleRemove(f.id)} className="text-red-400/80 group-hover:text-red-400 text-xs font-semibold transition-colors border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-2.5 py-1.5 rounded-lg cursor-pointer">
                Remove
              </button>
            </div>
          ))}
          {friends.length === 0 && pending.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-4">No friends yet. Add someone by their user ID.</p>
          )}
        </div>
      </div>

      {/* Recent Games */}
      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-zinc-200">Recent Games</h2>
        <div className="space-y-2">
          {scores.slice(0, 10).map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-xl transition-all shadow-sm">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-zinc-300">Room {s.game_code}</p>
                <p className="text-[10px] text-zinc-500 font-medium">{new Date(s.played_at).toLocaleDateString()}</p>
              </div>
              <span className="text-base font-extrabold text-[var(--accent)] tabular-nums bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-3 py-1 rounded-lg">
                {s.score}/{s.total_rounds * 100}
              </span>
            </div>
          ))}
          {scores.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">No games played yet.</p>}
        </div>
      </div>

      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 text-center transition-colors font-medium">
        Back Home
      </Link>
    </div>
  );
}
