'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { getMe, getAdminUsers, getAdminStats, getLeaderboard, updateUserRole, deleteUser, wipeUserScores } from '@/lib/api';

type Tab = 'system' | 'users' | 'leaderboard';

const tabs: { id: Tab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'users', label: 'Users' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) { router.push('/login'); return; }

    getMe().then(u => {
      if (u.role !== 'admin') { router.push('/'); return; }
      setAuthorized(true);
    }).catch(() => {
      localStorage.removeItem('blindtest_token');
      router.push('/login');
    });
  }, [router]);

  if (!authorized) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full gap-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="underline"
                className="absolute inset-0 bg-white/10 rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'system' && <SystemTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
      </motion.div>
    </div>
  );
}

function SystemTab() {
  const [stats, setStats] = useState<{ totalUsers: number; totalRounds: number } | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-8 text-center">
        <p className="text-5xl font-bold text-[var(--primary)]">{stats?.totalUsers ?? '-'}</p>
        <p className="text-zinc-500 mt-2 text-sm uppercase tracking-wider">Total Registered Users</p>
      </div>
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-8 text-center">
        <p className="text-5xl font-bold text-[var(--accent)]">{stats?.totalRounds ?? '-'}</p>
        <p className="text-zinc-500 mt-2 text-sm uppercase tracking-wider">Total Rounds Logged</p>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getAdminUsers();
      setUsers(u);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRole = async (userId: string, role: string) => {
    await updateUserRole(userId, role);
    loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user and all their data?')) return;
    await deleteUser(userId);
    loadUsers();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 border-b border-white/10">
            <th className="text-left py-3 px-2">User</th>
            <th className="text-left py-3 px-2">Role</th>
            <th className="text-left py-3 px-2">Joined</th>
            <th className="text-right py-3 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-3 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      u.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="font-medium">{u.username}</span>
                </div>
              </td>
              <td className="py-3 px-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.role === 'admin' ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {u.role}
                </span>
              </td>
              <td className="py-3 px-2 text-zinc-500">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="py-3 px-2 text-right">
                <div className="flex gap-2 justify-end">
                  <select
                    value={u.role}
                    onChange={e => handleRole(u.id, e.target.value)}
                    className="bg-[var(--surface)] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && users.length === 0 && <p className="text-zinc-500 text-center py-8">No users yet.</p>}
    </div>
  );
}

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWipe = async (userId: string, username: string) => {
    if (!confirm(`Wipe all scores for "${username}"? This cannot be undone.`)) return;
    try {
      await wipeUserScores(userId);
      load();
    } catch {}
  };

  return (
    <div className="space-y-1">
      {leaderboard.map((e: any, i: number) => (
        <div
          key={e.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
            i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' : i === 1 ? 'bg-zinc-300/5 border border-white/5' : i === 2 ? 'bg-amber-600/10 border border-amber-600/20' : 'bg-[var(--surface)]'
          }`}
        >
          <span className={`w-6 text-center text-sm font-bold ${
            i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
          }`}>
            {i + 1}
          </span>
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center text-xs font-bold">
            {e.avatar_url ? (
              <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              e.username[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{e.username}</p>
            <p className="text-xs text-zinc-500">{e.games_played} games</p>
          </div>
          <span className="text-lg font-bold text-[var(--accent)] mr-3">{e.total_score}</span>
          <button
            onClick={() => handleWipe(e.id, e.username)}
            className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors shrink-0"
          >
            Wipe Stats
          </button>
        </div>
      ))}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && leaderboard.length === 0 && <p className="text-zinc-500 text-center py-8">No scores yet.</p>}
    </div>
  );
}
