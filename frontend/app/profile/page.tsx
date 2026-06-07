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
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--surface)] flex items-center justify-center text-xl font-bold text-[var(--primary)] overflow-hidden">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            user.username[0].toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          {user.role === 'admin' && (
            <span className="text-xs text-[var(--primary)]">Admin</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-[var(--accent)]">{stats?.totalPoints ?? '-'}</p>
          <p className="text-xs text-zinc-500">Total Points</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-[var(--primary)]">
            {stats?.averageSpeedMs != null ? `${(stats.averageSpeedMs / 1000).toFixed(1)}s` : '-'}
          </p>
          <p className="text-xs text-zinc-500">Average Speed</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white capitalize">{stats?.bestGenre ?? '-'}</p>
          <p className="text-xs text-zinc-500">Best Genre</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-[var(--accent)]">{stats?.gamesPlayed ?? '-'}</p>
          <p className="text-xs text-zinc-500">Games Played</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-[var(--primary)]">{stats?.bestScore ?? '-'}</p>
          <p className="text-xs text-zinc-500">Best Score</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{stats?.perfects ?? '-'}</p>
          <p className="text-xs text-zinc-500">Perfect Rounds</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{stats?.totalRounds ?? '-'}</p>
          <p className="text-xs text-zinc-500">Rounds Played</p>
        </div>
        <div className="bg-[var(--surface)] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{friends.length}</p>
          <p className="text-xs text-zinc-500">Friends</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Friends</h2>

        <div className="flex gap-2">
          <input
            type="text"
            value={friendInput}
            onChange={e => setFriendInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
            placeholder="Enter user ID to add friend..."
            className="flex-1 px-4 py-2 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors text-sm"
          />
          <button onClick={handleAddFriend} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium hover:brightness-110 transition-all">
            Add
          </button>
        </div>
        {friendError && <p className="text-red-400 text-sm">{friendError}</p>}

        {pending.length > 0 && (
          <div>
            <p className="text-sm text-zinc-500 mb-2">Pending requests</p>
            {pending.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl mb-1">
                <span className="font-medium flex-1">{p.username}</span>
                <button onClick={() => handleAccept(p.id)} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors">
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}

        {friends.map(f => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] rounded-xl">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-light)] flex items-center justify-center text-xs font-bold overflow-hidden">
              {f.avatar_url ? (
                <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                f.username[0].toUpperCase()
              )}
            </div>
            <span className="font-medium flex-1">{f.username}</span>
            <button onClick={() => handleRemove(f.id)} className="text-red-400 text-xs hover:text-red-300 transition-colors">
              Remove
            </button>
          </div>
        ))}
        {friends.length === 0 && pending.length === 0 && (
          <p className="text-zinc-500 text-sm">No friends yet. Add someone by their user ID.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Games</h2>
        {scores.slice(0, 10).map(s => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-[var(--surface)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Room {s.game_code}</p>
              <p className="text-xs text-zinc-500">{new Date(s.played_at).toLocaleDateString()}</p>
            </div>
            <span className="text-lg font-bold text-[var(--accent)]">{s.score}/{s.total_rounds * 100}</span>
          </div>
        ))}
        {scores.length === 0 && <p className="text-zinc-500 text-sm">No games played yet.</p>}
      </div>

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors">
        Back Home
      </Link>
    </div>
  );
}
