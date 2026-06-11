'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  getMe,
  getAdminUsers,
  getAdminStats,
  getAdminRooms,
  getLeaderboard,
  updateUserRole,
  deleteUser,
  wipeUserScores,
  testDeezer,
  testDeezerGenre,
  getDbStatus,
  testGenre,
  getSongCache,
  fetchGenres,
  getAiStats,
  searchAiTracks,
  getAiRecent,
  getCuratedStats,
  getCuratedByGenre,
  getCuratedDiscovery,
  importToCurated,
  verifyCuratedSong,
  updateCuratedSongGenre,
  adminStartRoom,
  adminKickPlayer,
  adminDestroyRoom
} from '@/lib/api';

type Tab = 'system' | 'users' | 'rooms' | 'leaderboard' | 'music' | 'curated' | 'ai' | 'api';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'system', label: 'System', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'rooms', label: 'Rooms', icon: '🎮' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'music', label: 'Music Cache', icon: '💾' },
  { id: 'curated', label: 'Curated', icon: '✨' },
  { id: 'ai', label: 'AI Tags', icon: '🧠' },
  { id: 'api', label: 'API & Tester', icon: '⚡' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) {
      router.push('/login');
      return;
    }

    getMe()
      .then(u => {
        if (u.role !== 'admin') {
          router.push('/');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        localStorage.removeItem('blindtest_token');
        router.push('/login');
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, [router]);

  if (loadingUser) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#07070f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-zinc-500 text-sm animate-pulse">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex-1 flex min-h-screen bg-[#07070f] text-foreground font-sans selection:bg-[var(--primary)]/30 selection:text-white">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-surface/30 backdrop-blur-xl border-r border-white/5 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } hidden md:flex`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <span className="text-2xl">🎵</span>
            {sidebarOpen && (
              <span className="font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent tracking-wide">
                BlindTest Admin
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative group ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="text-lg relative z-10">{tab.icon}</span>
                {sidebarOpen && <span className="relative z-10">{tab.label}</span>}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-surface border border-white/10 rounded text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {tab.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>
        </div>
      </aside>

      {/* Main Panel Wrapper */}
      <div className={`flex-1 flex flex-col md:pl-${sidebarOpen ? '64' : '20'} transition-all duration-300 min-w-0`}>
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-surface/10 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 md:hidden"
            >
              ☰
            </button>
            <h2 className="font-bold text-lg text-white">
              {tabs.find(t => t.id === activeTab)?.label} Dashboard
            </h2>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
          >
            ← Back to Game
          </button>
        </header>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden bg-surface/30 backdrop-blur-xl border-b border-white/5 p-2 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id ? 'bg-[var(--primary)] text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content area */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'system' && <SystemTab />}
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'rooms' && <RoomsTab />}
              {activeTab === 'leaderboard' && <LeaderboardTab />}
              {activeTab === 'music' && <MusicTab />}
              {activeTab === 'curated' && <CuratedTab />}
              {activeTab === 'ai' && <AiTab />}
              {activeTab === 'api' && <ApiTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ------------------ SYSTEM TAB ------------------ */

function SystemTab() {
  const [stats, setStats] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSystemData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, db] = await Promise.all([getAdminStats(), getDbStatus()]);
      setStats(s);
      setDbStatus(db);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="👥" />
        <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" glowColor="rgba(0,206,201,0.15)" icon="🎵" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={stats?.activeRooms ?? '-'} label="Active Lobbies" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="🎮" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Postgres Status Card */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="text-xl">🐘</span> PostgreSQL Status
              </h3>
              <button
                onClick={loadSystemData}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>

            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    <span className="text-sm font-semibold text-zinc-300">Database connected & online</span>
                  </div>

                  {/* Custom progress bars indicating DB distribution */}
                  <div className="space-y-4">
                    <ProgressMeter
                      label="Round Guesses (V2)"
                      value={dbStatus.tables?.round_results_v2 ?? 0}
                      max={5000}
                      color="bg-[var(--accent)]"
                    />
                    <ProgressMeter
                      label="Users Recorded"
                      value={dbStatus.tables?.users ?? 0}
                      max={100}
                      color="bg-[var(--primary)]"
                    />
                    <ProgressMeter
                      label="Completed Games"
                      value={dbStatus.tables?.games ?? 0}
                      max={500}
                      color="bg-purple-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-red-400 font-medium">{dbStatus.error || 'Connection failure'}</p>
                </div>
              )
            ) : (
              <p className="text-zinc-500 text-sm">Testing connectivity...</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex justify-between text-xs text-zinc-500">
            <span>Type: Local Postgres Container</span>
            <span>Uptime check: OK</span>
          </div>
        </div>

        {/* Server Performance Card */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-xl">🖥️</span> Service Performance
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Uptime</span>
                <span className="text-xl font-bold text-white tabular-nums">
                  {stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Local Cache Size</span>
                <span className="text-xl font-bold text-[var(--primary)] tabular-nums">
                  {stats?.songCacheTotal ?? 0} songs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Average Socket Latency</span>
                <span className="text-xl font-bold text-[var(--accent)] tabular-nums">Normal (&lt; 10ms)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All local networks healthy
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, color, glowColor, icon }: { value: number | string; label: string; color: string; glowColor: string; icon: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group shadow-lg"
      style={{ boxShadow: `0 10px 30px -10px ${glowColor}` }}
    >
      <div className="absolute top-4 right-4 text-2xl opacity-20 group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-4xl font-extrabold tracking-tight" style={{ color }}>{value}</p>
      <p className="text-zinc-400 mt-2 text-xs font-semibold uppercase tracking-wider">{label}</p>
    </motion.div>
  );
}

function ProgressMeter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-medium mb-1.5">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200 tabular-nums">{value.toLocaleString()} / {max.toLocaleString()} ({percentage}%)</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

/* ------------------ USERS TAB ------------------ */

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getAdminUsers());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return users;
    const q = debouncedSearch.toLowerCase();
    return users.filter(
      u => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }, [users, debouncedSearch]);

  const handleRole = async (userId: string, role: string) => {
    await updateUserRole(userId, role);
    loadUsers();
  };

  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`Are you absolutely sure you want to delete user "${username}"? This will permanently wipe all associated scores, games, and friends.`)) return;
    await deleteUser(userId);
    loadUsers();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search registered players by username or Discord ID..."
          className="w-full pl-10 pr-4 py-3 bg-surface/20 backdrop-blur-md border border-white/5 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-all text-sm"
        />
      </div>

      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-white/5 text-xs uppercase tracking-wider">
                <th className="text-left py-4 px-6">User Profile</th>
                <th className="text-left py-4 px-4">Access Level</th>
                <th className="text-left py-4 px-4 hidden sm:table-cell">Date Joined</th>
                <th className="text-right py-4 px-6">Administration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border border-white/10">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          u.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate text-sm">{u.username}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-zinc-400 text-xs hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex gap-3 justify-end items-center">
                      <select
                        value={u.role}
                        onChange={e => handleRole(u.id, e.target.value)}
                        className="bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--primary)]"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-16">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
            <p className="text-zinc-500 text-xs">Querying database...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-zinc-500 text-center py-16 text-sm">No players match the search criteria.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------ ROOMS TAB (INTERACTIVE CONTROL) ------------------ */

function RoomsTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [activeInspector, setActiveInspector] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getAdminRooms();
      setRooms(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRooms();
    const t = setInterval(loadRooms, 6000);
    return () => clearInterval(t);
  }, [loadRooms]);

  const filtered = showAll ? rooms : rooms.filter(r => r.state !== 'game_over');

  const handleStart = async (code: string) => {
    try {
      await adminStartRoom(code);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to start game');
    }
  };

  const handleKick = async (code: string, playerId: string, playerName: string) => {
    if (!confirm(`Kick player "${playerName}" from lobby "${code}"?`)) return;
    try {
      await adminKickPlayer(code, playerId);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to kick player');
    }
  };

  const handleDestroy = async (code: string) => {
    if (!confirm(`Shutdown room "${code}" immediately? This will force remove all players.`)) return;
    try {
      await adminDestroyRoom(code);
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to shutdown room');
    }
  };

  const stateBadge = (s: string) => {
    const config: Record<string, { label: string; classes: string }> = {
      waiting: { label: 'Waiting', classes: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      round_preparing: { label: 'Preparing', classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      playing: { label: 'Playing', classes: 'bg-green-500/20 text-green-400 border border-green-500/30' },
      round_result: { label: 'Pause/Result', classes: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      game_over: { label: 'Finished', classes: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' },
    };
    const c = config[s] || { label: s, classes: 'bg-zinc-500/10 text-zinc-400' };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.classes}`}>{c.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAll(false); setLoading(true); loadRooms(); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              !showAll
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/10'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => { setShowAll(true); setLoading(true); loadRooms(); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              showAll
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/10'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            All Rooms
          </button>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Showing {filtered.length} of {rooms.length} rooms (Auto-refresh 6s)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(r => (
          <div
            key={r.code}
            className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between shadow-lg hover:border-white/10 transition-colors"
          >
            <div>
              {/* Room Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-black tracking-widest text-[var(--primary)]">{r.code}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono">Source: {r.settings?.audioSource || 'deezer'}</p>
                </div>
                {stateBadge(r.state)}
              </div>

              {/* Lobby settings */}
              <div className="grid grid-cols-3 gap-2 bg-white/[0.02] border border-white/5 p-3 rounded-xl mb-4 text-xs">
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Rounds</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.rounds || r.totalRounds} rounds</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Duration</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.roundTime || 15}s</span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 uppercase block">Auto-Start</span>
                  <span className="font-semibold text-zinc-200">{r.settings?.autoStart ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Genres list */}
              <div className="mb-4">
                <span className="text-[9px] text-zinc-500 uppercase block mb-1">Active Genres</span>
                <div className="flex flex-wrap gap-1">
                  {r.genres?.length > 0 ? (
                    r.genres.map((g: string) => (
                      <span key={g} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-zinc-400 font-medium border border-white/[0.02]">{g}</span>
                    ))
                  ) : (
                    <span className="text-zinc-600 text-xs italic">All genres enabled</span>
                  )}
                </div>
              </div>

              {/* Player list block */}
              <div className="border-t border-white/5 pt-4">
                <button
                  onClick={() => setActiveInspector(activeInspector === r.code ? null : r.code)}
                  className="w-full flex justify-between items-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  <span>Players ({r.playerCount})</span>
                  <span>{activeInspector === r.code ? '▼ Hide list' : '▶ Show list'}</span>
                </button>

                {activeInspector === r.code && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {r.players?.length > 0 ? (
                      r.players.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-black/20 rounded-xl border border-white/[0.02] text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-zinc-700 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.name[0].toUpperCase()
                              )}
                            </div>
                            <span className="font-medium text-zinc-300 truncate">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-500 font-bold uppercase">{p.role}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--accent)] font-bold tabular-nums">{p.score} pts</span>
                            <button
                              onClick={() => handleKick(r.code, p.id, p.name)}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Kick
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-600 italic py-2 text-center">No players connected</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Room Controls */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/5">
              {r.state === 'waiting' ? (
                <button
                  onClick={() => handleStart(r.code)}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-xl transition-all"
                >
                  Force Start
                </button>
              ) : (
                <div className="flex items-center justify-center bg-white/5 border border-white/5 text-zinc-500 text-xs rounded-xl font-medium">
                  Round {r.currentRound}/{r.totalRounds}
                </div>
              )}
              <button
                onClick={() => handleDestroy(r.code)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-xl transition-all"
              >
                Shut Down
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-zinc-500 text-xs">Querying lobbies...</p>
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-zinc-500 text-center py-16 text-sm">{showAll ? 'No rooms configured on server.' : 'No active game lobbies.'}</p>
      )}
    </div>
  );
}

/* ------------------ LEADERBOARD TAB ------------------ */

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      setLeaderboard(await getLeaderboard());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleWipe = async (userId: string, username: string) => {
    if (!confirm(`Wipe all historic scores, game stats, and metrics for user "${username}"? This will delete all record of this player from leaderboard and logs. THIS CANNOT BE UNDONE.`)) return;
    try {
      await wipeUserScores(userId);
      loadLeaderboard();
    } catch {}
  };

  // Group top 3 and others
  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
  const restList = useMemo(() => leaderboard.slice(3), [leaderboard]);

  return (
    <div className="space-y-6">
      {/* Top 3 podium styling */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topThree.map((e, index) => {
            const colors = [
              { border: 'border-yellow-500/30 bg-yellow-500/5', icon: '🥇', label: 'Gold Champ' },
              { border: 'border-zinc-300/30 bg-zinc-300/5', icon: '🥈', label: 'Silver Runner' },
              { border: 'border-amber-600/30 bg-amber-600/5', icon: '🥉', label: 'Bronze Place' },
            ][index];
            return (
              <div
                key={e.id || e.player_id}
                className={`p-6 rounded-2xl border ${colors.border} flex flex-col items-center justify-between text-center relative overflow-hidden shadow-lg`}
              >
                <div className="absolute top-4 right-4 text-3xl">{colors.icon}</div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-700 border-2 border-white/10 overflow-hidden mb-3">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      (e.username || e.player_name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <h4 className="font-bold text-white text-lg">{e.username || e.player_name || 'Unknown'}</h4>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{colors.label}</span>
                </div>

                <div className="mt-4 w-full bg-black/20 rounded-xl p-3 grid grid-cols-2 text-xs border border-white/[0.02]">
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Games</span>
                    <span className="font-bold text-zinc-300">{e.games_played}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 block">Total Points</span>
                    <span className="font-bold text-[var(--accent)]">{e.total_score}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleWipe(e.id || e.player_id, e.username || e.player_name)}
                  className="mt-4 w-full px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 text-xs font-semibold rounded-xl transition-all"
                >
                  Wipe Score
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranks 4+ */}
      {restList.length > 0 && (
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Remaining Ranks</h3>
            <span className="text-xs text-zinc-500">{restList.length} players</span>
          </div>
          <div className="space-y-1 p-2 max-h-[400px] overflow-y-auto">
            {restList.map((e, idx) => {
              const rank = idx + 4;
              return (
                <div
                  key={e.id || e.player_id}
                  className="flex items-center gap-3 px-4 py-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.02] rounded-xl transition-all"
                >
                  <span className="w-8 text-center text-xs font-semibold text-zinc-500">{rank}</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0 border border-white/10">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (e.username || e.player_name || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-zinc-200 truncate">{e.username || e.player_name || 'Unknown'}</p>
                    <p className="text-[10px] text-zinc-500">{e.games_played} games played</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{e.total_score} pts</span>
                  <button
                    onClick={() => handleWipe(e.id || e.player_id, e.username || e.player_name)}
                    className="ml-4 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-lg text-xs font-medium transition-all"
                  >
                    Wipe
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-zinc-500 text-xs">Querying leaderboard...</p>
        </div>
      )}
      {!loading && leaderboard.length === 0 && (
        <p className="text-zinc-500 text-center py-16 text-sm">No historical scores in database yet.</p>
      )}
    </div>
  );
}

/* ------------------ MUSIC CACHE TAB ------------------ */

function MusicTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSongCache()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-zinc-500 text-xs">Loading local cache stats...</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const totalPlays = data?.plays ?? 0;
  const genreList = data?.genres ?? [];
  const genreCount = data?.genreCount ?? 0;
  const played = data?.played ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-[var(--primary)]">{total.toLocaleString()}</p>
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mt-1">Cached Tracks</p>
        </div>
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-[var(--accent)]">{totalPlays.toLocaleString()}</p>
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mt-1">Total Hits</p>
        </div>
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 text-center shadow-lg">
          <p className="text-3xl font-extrabold text-purple-400">{genreCount}</p>
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mt-1">Classified Genres</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Played cached songs */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg flex flex-col">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Top Played Cache</h3>
            <span className="text-[10px] font-mono text-zinc-500">{played.length} unique songs</span>
          </div>
          <div className="overflow-y-auto max-h-[500px] flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr className="text-zinc-500 border-b border-white/5 text-xs">
                  <th className="text-left py-3 px-6 w-12">#</th>
                  <th className="text-left py-3 px-2">Track & Artist</th>
                  <th className="text-left py-3 px-2 hidden sm:table-cell">Genres</th>
                  <th className="text-center py-3 px-2 w-16">Plays</th>
                  <th className="text-right py-3 px-6">Last Played</th>
                </tr>
              </thead>
              <tbody>
                {played.map((s: any, i: number) => (
                  <tr key={s.id} className="border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors">
                    <td className="py-2.5 px-6 text-zinc-600 font-semibold tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <p className="font-medium text-zinc-200 truncate max-w-[220px]">{s.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate max-w-[220px]">{s.artist}</p>
                    </td>
                    <td className="py-2.5 px-2 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-white/5 text-zinc-400 font-medium border border-white/[0.01]">
                        {s.genres && s.genres.length > 0 ? s.genres.join(', ') : s.genre || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-[var(--primary)] tabular-nums">{s.play_count}</td>
                    <td className="py-2.5 px-6 text-right text-xs text-zinc-500">
                      {s.last_played ? new Date(s.last_played).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {played.length === 0 && <p className="text-zinc-600 text-center py-12 text-sm italic">No songs have been played yet.</p>}
          </div>
        </div>

        {/* Cached genres */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-6">Volume by Genre</h3>
          <div className="space-y-4 overflow-y-auto max-h-[500px] flex-1 pr-1">
            {genreList.map((g: any) => {
              const pct = total > 0 ? (g.count / total) * 100 : 0;
              return (
                <div key={g.genre} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-400 truncate w-36">
                      {g.genre.charAt(0).toUpperCase() + g.genre.slice(1).replace(/-/g, ' ')}
                    </span>
                    <span className="text-zinc-300 tabular-nums">{g.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ CURATED TAB ------------------ */

function CuratedTab() {
  const [stats, setStats] = useState<any>(null);
  const [byGenre, setByGenre] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreSongs, setGenreSongs] = useState<any[]>([]);
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryTracks, setDiscoveryTracks] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [updatingGenre, setUpdatingGenre] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await getCuratedStats();
      setStats(s);
      setByGenre(s.byGenre || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    fetchGenres().then(setAllGenres).catch(() => {});
  }, [loadStats]);

  const loadGenreSongs = async (genre: string) => {
    if (selectedGenre === genre) {
      setSelectedGenre(null);
      return;
    }
    setSelectedGenre(genre);
    setSongsLoading(true);
    const songs = await getCuratedByGenre(genre);
    setGenreSongs(songs);
    setSongsLoading(false);
  };

  const toggleVerify = async (songId: string, currentlyVerified: boolean) => {
    await verifyCuratedSong(songId, !currentlyVerified);
    setGenreSongs(prev => prev.map(s => (s.id === songId ? { ...s, verified: !currentlyVerified } : s)));
    loadStats();
  };

  const changeGenre = async (songId: string, newGenre: string) => {
    setUpdatingGenre(songId);
    await updateCuratedSongGenre(songId, newGenre);
    setGenreSongs(prev => prev.map(s => (s.id === songId ? { ...s, genre: newGenre } : s)));
    setUpdatingGenre(null);
    loadStats();
  };

  const loadDiscovery = async (genre?: string) => {
    setDiscoveryLoading(true);
    const tracks = await getCuratedDiscovery(genre);
    setDiscoveryTracks(tracks);
    setDiscoveryLoading(false);
  };

  const handleImport = async (songIds: string[], destGenre?: string) => {
    setImporting(prev => new Set([...prev, ...songIds]));
    await importToCurated(songIds, destGenre);
    setImporting(prev => {
      const next = new Set(prev);
      songIds.forEach(id => next.delete(id));
      return next;
    });
    loadDiscovery(selectedGenre || undefined);
    loadStats();
    if (selectedGenre) {
      const songs = await getCuratedByGenre(selectedGenre);
      setGenreSongs(songs);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-zinc-500 text-xs">Querying curated list...</p>
      </div>
    );
  }

  const verifiedPct = stats?.total ? ((stats.verified / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Curated status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Curated" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="✨" />
        <StatCard value={stats?.verified ?? '-'} label={`Verified (${verifiedPct}%)`} color="#10b981" glowColor="rgba(16,185,129,0.15)" icon="✓" />
        <StatCard value={stats?.unverified ?? '-'} label="Unverified" color="#f59e0b" glowColor="rgba(245,158,11,0.15)" icon="⌛" />
        <StatCard value={stats?.total_plays ?? '-'} label="Total Plays" color="var(--accent)" glowColor="rgba(0,206,201,0.15)" icon="🎵" />
        <StatCard value={stats?.genres ?? '-'} label="Genres" color="#8b5cf6" glowColor="rgba(139,92,246,0.15)" icon="📁" />
      </div>

      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Curated Songs by Genre</h3>
          <button
            onClick={() => {
              setShowDiscovery(!showDiscovery);
              if (!showDiscovery) loadDiscovery();
            }}
            className="text-xs px-3.5 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/25 transition-all font-semibold"
          >
            {showDiscovery ? 'Close Discovery Panel' : '🔍 Discovery Import Mode'}
          </button>
        </div>

        {/* Discovery Box */}
        {showDiscovery && (
          <div className="mb-6 bg-white/[0.01] rounded-2xl p-4 border border-white/5 animate-slide-up">
            <div className="mb-4">
              <h4 className="text-sm font-bold text-white">Discovery Queue</h4>
              <p className="text-xs text-zinc-500 mt-1">Import songs fetched from Deezer editorial/charts into the curated database.</p>
            </div>

            {discoveryLoading ? (
              <p className="text-zinc-500 text-xs py-4">Scanning cache candidates...</p>
            ) : discoveryTracks.length === 0 ? (
              <p className="text-zinc-600 text-xs py-4 text-center">No outstanding cache candidates found. Try running some Live API tests first.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-white/5 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface/80 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                    <tr>
                      <th className="text-left py-2 px-4 w-24">
                        <button
                          onClick={() => handleImport(discoveryTracks.map(t => t.id), selectedGenre || undefined)}
                          className="text-[10px] text-[var(--accent)] hover:text-white transition-colors"
                          title="Import all displayed"
                        >
                          Import All
                        </button>
                      </th>
                      <th className="text-left py-2 px-2">Track</th>
                      <th className="text-left py-2 px-2">Artist</th>
                      <th className="text-left py-2 px-2 hidden sm:table-cell">Genre (Cache)</th>
                      <th className="text-right py-2 px-4">Deezer Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discoveryTracks.map((t: any) => (
                      <tr key={t.id} className="border-b border-white/[0.01] hover:bg-white/[0.01]">
                        <td className="py-2 px-4">
                          <button
                            onClick={() => handleImport([t.id], selectedGenre || undefined)}
                            disabled={importing.has(t.id)}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 hover:bg-[var(--accent)]/35 transition-all disabled:opacity-30"
                          >
                            {importing.has(t.id) ? '...' : 'Import'}
                          </button>
                        </td>
                        <td className="py-2 px-2 font-medium text-zinc-200 truncate max-w-[180px]">{t.name}</td>
                        <td className="py-2 px-2 text-zinc-400 truncate max-w-[140px]">{t.artist}</td>
                        <td className="py-2 px-2 hidden sm:table-cell text-zinc-500">{t.genre || t.genres?.[0] || '-'}</td>
                        <td className="py-2 px-4 text-right tabular-nums text-zinc-500 font-mono">#{t.rank?.toLocaleString() || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Curated list */}
        {byGenre.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center italic">No curated songs. Use the discovery mode to import some!</p>
        ) : (
          <div className="space-y-2">
            {byGenre.map((g: any) => (
              <div key={g.genre} className="border border-white/5 rounded-xl overflow-hidden bg-black/10">
                <button
                  onClick={() => loadGenreSongs(g.genre)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-white w-40 truncate">{g.genre.replace(/-/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${(g.total / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-12 text-right">{g.total}</span>
                  <span className="text-[10px] text-zinc-500 w-24 text-right font-medium">
                    {g.verified} / {g.total} verified
                  </span>
                  <span className="text-[10px] text-zinc-500 w-16 text-right tabular-nums">{g.total_plays} plays</span>
                  <svg
                    className={`w-3 h-3 text-zinc-500 transition-transform ${selectedGenre === g.genre ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {selectedGenre === g.genre && (
                  <div className="p-4 bg-black/20 border-t border-white/5">
                    {songsLoading ? (
                      <p className="text-zinc-500 text-xs py-2">Loading...</p>
                    ) : genreSongs.length === 0 ? (
                      <p className="text-zinc-600 text-xs py-2">No curated tracks found.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-white/5 rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                            <tr>
                              <th className="text-left py-2 px-4">Track</th>
                              <th className="text-left py-2 px-2">Artist</th>
                              <th className="text-left py-2 px-2">Genre Override</th>
                              <th className="text-right py-2 px-2 w-16">Plays</th>
                              <th className="text-center py-2 px-2 w-24">Verification</th>
                              <th className="text-right py-2 px-4 w-16">Audio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {genreSongs.map((s: any) => (
                              <tr key={s.id} className="border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors">
                                <td className="py-2 px-4 font-semibold text-zinc-200 truncate max-w-[180px]">{s.name}</td>
                                <td className="py-2 px-2 text-zinc-400 truncate max-w-[140px]">{s.artist}</td>
                                <td className="py-2 px-2">
                                  <select
                                    value={s.genre}
                                    onChange={e => changeGenre(s.id, e.target.value)}
                                    disabled={updatingGenre === s.id}
                                    className="text-[10px] bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none focus:border-[var(--primary)]"
                                  >
                                    {allGenres.map(g => (
                                      <option key={g.id} value={g.id}>{g.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-2 text-right font-bold tabular-nums text-zinc-400">{s.played_count}</td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    onClick={() => toggleVerify(s.id, s.verified)}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                      s.verified
                                        ? 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/35'
                                        : 'bg-zinc-500/10 text-zinc-400 border-white/5 hover:bg-zinc-500/20'
                                    }`}
                                  >
                                    {s.verified ? 'Verified' : 'Verify'}
                                  </button>
                                </td>
                                <td className="py-2 px-4 text-right">
                                  <span className={`text-xs ${s.has_preview ? 'text-green-500' : 'text-red-500'}`}>
                                    {s.has_preview ? '✓' : '✗'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------ AI TAGS TAB ------------------ */

function AiTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  const loadAiData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getAiStats(), getAiRecent(50)]);
      setStats(s);
      setRecentTracks(r?.tracks ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await searchAiTracks(q);
      setSearchResults(res);
    } catch {
      setSearchResults(null);
    }
    setSearching(false);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-zinc-500 text-xs">Querying AI stats...</p>
      </div>
    );
  }

  const pct = (n: number) => (stats?.total ? ((n / stats.total) * 100).toFixed(1) : '0');

  return (
    <div className="space-y-6">
      {/* AI stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Enriched" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="🧠" />
        <StatCard value={stats?.processed ?? '-'} label="Processed" color="#10b981" glowColor="rgba(16,185,129,0.15)" icon="✓" />
        <StatCard value={stats?.unprocessed ?? '-'} label="Queue Size" color="#f59e0b" glowColor="rgba(245,158,11,0.15)" icon="⌛" />
        <StatCard value={stats?.errors ?? '-'} label="Failures" color="#ef4444" glowColor="rgba(239,68,68,0.15)" icon="✗" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Genre distribution */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span>📊</span> AI Genre Breakdown
            </h3>
            {stats?.distribution?.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {stats.distribution.map((g: any) => (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400 truncate w-32">{g.genre}</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{g.count} ({pct(g.count)}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(g.count / stats.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-600 text-xs italic">No classification data recorded.</p>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-zinc-500">
            Last model run: {stats?.last_processed ? new Date(stats.last_processed).toLocaleString() : 'Never'}
          </div>
        </div>

        {/* AI Tag Search Panel */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>🔍</span> Search AI Taxonomy
          </h3>
          <p className="text-xs text-zinc-500 mb-4">Query database cache using music descriptors, moods, beats, or tags.</p>

          <input
            value={searchQ}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search e.g. 'synthwave', 'melancholic piano', 'upbeat'..."
            className="w-full px-4 py-3 bg-black/25 border border-white/5 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] transition-all text-sm mb-4"
          />

          {searching && <p className="text-zinc-500 text-xs animate-pulse">Scanning taxonomy index...</p>}

          {searchResults?.tracks?.length > 0 && (
            <div className="overflow-x-auto max-h-80 border border-white/5 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-left py-2 px-4">Track</th>
                    <th className="text-left py-2 px-2">Artist</th>
                    <th className="text-left py-2 px-2">AI Genres</th>
                    <th className="text-left py-2 px-4">AI Descriptive Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.tracks.map((t: any) => (
                    <tr key={t.id} className="border-b border-white/[0.01] hover:bg-white/[0.01]">
                      <td className="py-2.5 px-4 font-semibold text-zinc-200">{t.name}</td>
                      <td className="py-2.5 px-2 text-zinc-400">{t.artist}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {(t.ai_genres || []).map((g: string) => (
                            <span key={g} className="px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)] text-[9px] font-bold uppercase">{g}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {(t.ai_tags || []).slice(0, 4).map((tag: string) => (
                            <span key={tag} className="px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 text-[9px] border border-white/[0.02]">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {searchQ && !searching && searchResults?.tracks?.length === 0 && (
            <p className="text-zinc-500 text-xs italic py-4 text-center">No cached tracks match the descriptor query.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------ API & LIVE TESTER TAB ------------------ */

const API_SOURCES = [
  { id: 'deezer', label: 'Deezer Core API', desc: 'Queries official charts and searches.' },
];

function ApiTab() {
  const [deezerResult, setDeezerResult] = useState<any>(null);
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);

  const [genreList, setGenreList] = useState<{ id: string; label: string }[]>([]);
  const [genre, setGenre] = useState('pop');
  const [count, setCount] = useState(30);
  const [source, setSource] = useState('deezer');
  const [results, setResults] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [error, setError] = useState('');

  // Audio preview player state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchGenres().then(setGenreList).catch(() => {});
    getDbStatus().then(setDbStatus).catch(() => {});
  }, []);

  const runConnectivity = () => {
    setDeezerLoading(true);
    testDeezer()
      .then(setDeezerResult)
      .catch(() => setDeezerResult({ error: 'Connectivity failed' }))
      .finally(() => setDeezerLoading(false));
  };

  const runTester = async () => {
    setTesterLoading(true);
    setError('');
    setResults(null);
    setPlayingTrackId(null);
    setPreviewUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    try {
      const res = source === 'deezer' ? await testDeezerGenre(genre, count) : await testGenre(genre, count);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Llive query failed');
    }
    setTesterLoading(false);
  };

  const handlePlayPreview = (trackId: string, url: string) => {
    if (playingTrackId === trackId) {
      // Pause
      setPlayingTrackId(null);
      setPreviewUrl(null);
      if (audioRef.current) audioRef.current.pause();
    } else {
      setPlayingTrackId(trackId);
      setPreviewUrl(url);
      // Wait for React to mount the src and autoplay
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden audio element for preview players */}
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          autoPlay
          onEnded={() => {
            setPlayingTrackId(null);
            setPreviewUrl(null);
          }}
          className="hidden"
        />
      )}

      {/* Connectivity cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Deezer Live Endpoints</h3>
            {deezerResult ? (
              <div className="space-y-2 text-xs font-mono">
                {deezerResult.error ? (
                  <p className="text-red-400">{deezerResult.error}</p>
                ) : (
                  (deezerResult.tests || []).map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/[0.01] pb-1.5">
                      <span className="text-zinc-500">{t.label || t.endpoint}</span>
                      <span className={t.ok ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {t.ok ? `${t.ms || t.latencyMs}ms ✓` : 'Offline ✗'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-xs italic">No latency metrics recorded.</p>
            )}
          </div>
          <button
            onClick={runConnectivity}
            disabled={deezerLoading}
            className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl border border-white/10 transition-colors disabled:opacity-50"
          >
            {deezerLoading ? 'Pinging endpoints...' : 'Ping Deezer API'}
          </button>
        </div>

        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Internal postgresql</h3>
            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Database Driver</span>
                    <span>Postgres Client Pool</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Status</span>
                    <span className="text-green-400 font-bold">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">User records</span>
                    <span className="text-zinc-300 font-bold">{dbStatus.tables?.users ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Round Guesses</span>
                    <span className="text-zinc-300 font-bold">{dbStatus.tables?.round_results_v2 ?? 0}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-400 font-mono">{dbStatus.error || 'Failed'}</p>
              )
            ) : (
              <p className="text-zinc-500 text-xs italic">Checking database status...</p>
            )}
          </div>
          <div className="text-xs text-zinc-500 pt-3 border-t border-white/5">
            Active connection pool size: 10
          </div>
        </div>
      </div>

      {/* Genre Tester and Audio Player */}
      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg">
        <div className="mb-4">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Live Genre API Tester</h3>
          <p className="text-xs text-zinc-500 mt-1">Directly query Deezer music catalog for specific genres, list ranks, and verify audio clips.</p>
        </div>

        <div className="flex flex-wrap items-end gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl mb-6">
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1.5">Query Source</label>
            <div className="flex gap-1">
              {API_SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSource(s.id);
                    setResults(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                    source === s.id
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg'
                      : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
                  }`}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1.5">Genre</label>
            <select
              value={genre}
              onChange={e => {
                setGenre(e.target.value);
                setResults(null);
              }}
              className="bg-surface border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--primary)]"
            >
              {genreList.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1.5">Quantity</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={100}
                value={count}
                onChange={e => {
                  setCount(Number(e.target.value));
                  setResults(null);
                }}
                className="w-24 accent-[var(--primary)] h-1.5 cursor-pointer"
              />
              <span className="text-xs text-zinc-400 font-bold font-mono w-6 tabular-nums">{count}</span>
            </div>
          </div>

          <button
            onClick={runTester}
            disabled={testerLoading}
            className="px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary)]/10"
          >
            {testerLoading ? 'Fetching Live API...' : 'Fetch Catalog'}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs py-3">{error}</p>}

        {/* Results grid */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs font-semibold text-zinc-500 border-b border-white/5 pb-2">
              <span>Found: {results.count ?? results.tracks?.length} tracks</span>
              {results.previewCount != null && <span className="text-green-400">{results.previewCount} with audio previews</span>}
              {results.latencyMs != null && <span className="text-zinc-600">Response time: {results.latencyMs}ms</span>}
            </div>

            <div className="overflow-y-auto max-h-96 border border-white/5 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-right py-3 px-4 w-16">Rank</th>
                    <th className="text-left py-3 px-2">Track Title</th>
                    <th className="text-left py-3 px-2 hidden sm:table-cell">Artist</th>
                    <th className="text-center py-3 px-4 w-24">Live Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {(results.tracks || []).map((t: any, i: number) => {
                    const hasAudio = !!t.previewUrl || !!t.preview;
                    const audioUrl = t.previewUrl || t.preview;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-white/[0.01] hover:bg-white/[0.01] transition-colors ${
                          t.rank >= 1000000 ? 'bg-purple-500/5' : t.rank >= 100000 ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-500">
                          {t.rank > 0 ? `#${t.rank.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-zinc-200 truncate max-w-[200px]">{t.name || t.title}</td>
                        <td className="py-2.5 px-2 text-zinc-400 hidden sm:table-cell truncate max-w-[200px]">{t.artist}</td>
                        <td className="py-2.5 px-4 text-center">
                          {hasAudio ? (
                            <button
                              onClick={() => handlePlayPreview(t.id || `test-${i}`, audioUrl)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                playingTrackId === (t.id || `test-${i}`)
                                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/20 shadow-lg'
                                  : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              {playingTrackId === (t.id || `test-${i}`) ? '⏸ Pause' : '▶ Play'}
                            </button>
                          ) : (
                            <span className="text-zinc-600 italic text-[10px]">No audio</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sticky Audio Control Bar overlay */}
            {previewUrl && (
              <div className="mt-4 p-4 bg-surface/50 border border-white/10 backdrop-blur-md rounded-2xl flex items-center justify-between animate-slide-up shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl animate-pulse">🔊</span>
                  <div>
                    <p className="text-xs font-bold text-white">Playing Audio Preview</p>
                    <p className="text-[10px] text-zinc-500">Listening to the selected track preview clip.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPlayingTrackId(null);
                    setPreviewUrl(null);
                    if (audioRef.current) audioRef.current.pause();
                  }}
                  className="px-3.5 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all"
                >
                  Stop Clip
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
