'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { getMe, getAdminUsers, getAdminStats, getAdminRooms, getLeaderboard, updateUserRole, deleteUser, wipeUserScores, testDeezer, testDeezerGenre, getDbStatus, testGenre, getSongCache, fetchGenres, getAiStats, searchAiTracks, getAiRecent, getCuratedStats, getCuratedByGenre, getCuratedDiscovery, importToCurated, verifyCuratedSong, updateCuratedSongGenre, adminStartRoom, adminKickPlayer, adminDestroyRoom } from '@/lib/api';

type Tab = 'system' | 'users' | 'rooms' | 'leaderboard' | 'music' | 'curated' | 'ai' | 'api';

const GENRE_OPTIONS: { id: string; label: string }[] = [
  { id: 'fado', label: 'Fado' },
  { id: 'traditional_pimba', label: 'Tradicional / Pimba' },
  { id: 'pop_tuga', label: 'Pop Tuga' },
  { id: 'pop_rock_tuga', label: 'Pop / Rock Tuga' },
  { id: 'hip_hop_tuga', label: 'Hip Hop Tuga' },
  { id: 'classica_tuga', label: 'Clássica Tuga' },
  { id: 'kizomba', label: 'Kizomba' },
  { id: 'pop_urbano_nova_tuga', label: 'Pop Urbano / Nova Tuga' },
  { id: 'pop_us', label: 'Pop US' },
  { id: 'hip_hop_trap_us', label: 'Hip Hop / Trap US' },
  { id: 'country_americana', label: 'Country / Americana' },
  { id: 'rock_alternative_us', label: 'Rock / Alternative US' },
  { id: 'pop_uk', label: 'Pop UK' },
  { id: 'uk_drill_grime_hip_hop', label: 'UK Drill / Grime / Hip Hop' },
  { id: 'britpop_rock_uk', label: 'Britpop / Rock UK' },
  { id: 'uk_garage_drum_bass', label: 'UK Garage / Drum & Bass' },
];

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'system', label: 'System', icon: 'M4 8a4 4 0 014-4h8a4 4 0 014 4v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8z' },
  { id: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'rooms', label: 'Rooms', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'music', label: 'Music', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { id: 'curated', label: 'Curated', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { id: 'ai', label: 'AI', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'api', label: 'API', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

const SOURCES = [
  { id: 'deezer', label: 'Deezer', desc: 'Free, has rank data' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [authorized, setAuthorized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const handleTogglePreview = useCallback((trackId: string, previewUrl: string) => {
    if (playingTrackId === trackId) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = '';
      setPlayingTrackId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audio = new Audio(previewUrl);
      audio.play();
      audio.addEventListener('ended', () => {
        audio.src = '';
        setPlayingTrackId(null);
      });
      audioRef.current = audio;
      setPlayingTrackId(trackId);
    }
  }, [playingTrackId]);

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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  if (!authorized) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)]">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 fixed left-0 top-16 bottom-0 bg-black/80 backdrop-blur-md border-r border-white/10 z-30 overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-bold">Admin Panel</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Bottom bar — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 z-30 flex justify-around px-2 py-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 ${
              activeTab === tab.id ? 'text-white' : 'text-zinc-500'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span className="text-[10px] leading-tight">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 ml-0 md:ml-56 p-4 md:p-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
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
            {activeTab === 'curated' && <CuratedTab onTogglePreview={handleTogglePreview} playingTrackId={playingTrackId} />}
            {activeTab === 'ai' && <AiTab />}
            {activeTab === 'api' && <ApiTab onTogglePreview={handleTogglePreview} playingTrackId={playingTrackId} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
      <p className="text-5xl font-bold" style={{ color }}>{value}</p>
      <p className="text-zinc-500 mt-2 text-sm uppercase tracking-wider">{label}</p>
    </div>
  );
}

function VolumeBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 font-mono">{value.toLocaleString()}</span>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function SystemTab() {
  const [stats, setStats] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
    getDbStatus().then(setDbStatus).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" />
        <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#8b5cf6" />
        <StatCard value={stats?.activeRooms ?? '-'} label="Active Rooms" color="#10b981" />
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold mb-4">Database</h2>
        {dbStatus ? (
          dbStatus.ok ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${dbStatus.hasData ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-sm text-zinc-300">PostgreSQL</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${dbStatus.hasData ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {dbStatus.hasData ? 'Has data' : 'Empty'}
                </span>
              </div>
              <div className="space-y-3 pt-3 border-t border-white/5">
                <VolumeBar value={dbStatus.tables?.users ?? 0} max={10000} label="Users" color="var(--primary)" />
                <VolumeBar value={dbStatus.tables?.game_scores ?? 0} max={50000} label="Scores" color="var(--accent)" />
                <VolumeBar value={dbStatus.tables?.round_results ?? 0} max={50000} label="Rounds" color="#8b5cf6" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-sm text-red-400">{dbStatus.error || 'Connection failed'}</span>
            </div>
          )
        ) : (
          <p className="text-zinc-500 text-sm">Checking...</p>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getAdminUsers()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 250);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const filtered = useMemo(() =>
    debouncedSearch ? users.filter(u => u.username.toLowerCase().includes(debouncedSearch.toLowerCase())) : users,
    [users, debouncedSearch]
  );

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
    <div className="space-y-4">
      <input
        value={search}
        onChange={e => handleSearchChange(e.target.value)}
        placeholder="Search users..."
        className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors text-sm"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-white/10">
              <th className="text-left py-3 px-2">User</th>
              <th className="text-left py-3 px-2">Role</th>
              <th className="text-left py-3 px-2 hidden md:table-cell">Joined</th>
              <th className="text-right py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        u.username[0].toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-zinc-300">{u.username}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'admin' ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-2 text-zinc-500 hidden md:table-cell">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <select
                      value={u.role}
                      onChange={e => handleRole(u.id, e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <button onClick={() => handleDelete(u.id)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && users.length === 0 && <p className="text-zinc-500 text-center py-8">No users yet.</p>}
      {!loading && search && filtered.length === 0 && <p className="text-zinc-500 text-center py-8">No users matching "{search}"</p>}
    </div>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setRooms(await getAdminRooms()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const stateLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      waiting: { text: 'Waiting', cls: 'bg-yellow-500/20 text-yellow-400' },
      round_preparing: { text: 'Starting', cls: 'bg-blue-500/20 text-blue-400' },
      playing: { text: 'Playing', cls: 'bg-green-500/20 text-green-400' },
      round_result: { text: 'Pause', cls: 'bg-purple-500/20 text-purple-400' },
      game_over: { text: 'Finished', cls: 'bg-zinc-500/20 text-zinc-400' },
    };
    return map[s] || { text: s, cls: 'text-zinc-500' };
  };

  const genreLabel = (id: string) => {
    const g = GENRE_OPTIONS.find(x => x.id === id);
    return g ? g.label : id;
  };

  const handleStart = async (code: string) => {
    setActionLoading(prev => ({ ...prev, [`start-${code}`]: true }));
    try { await adminStartRoom(code); load(); } catch {}
    setActionLoading(prev => ({ ...prev, [`start-${code}`]: false }));
  };

  const handleKick = async (code: string, playerId: string) => {
    setActionLoading(prev => ({ ...prev, [`kick-${code}-${playerId}`]: true }));
    try { await adminKickPlayer(code, playerId); load(); } catch {}
    setActionLoading(prev => ({ ...prev, [`kick-${code}-${playerId}`]: false }));
  };

  const handleDestroy = async (code: string) => {
    if (!confirm(`Shut down room "${code}"? This action cannot be undone.`)) return;
    setActionLoading(prev => ({ ...prev, [`destroy-${code}`]: true }));
    try { await adminDestroyRoom(code); load(); } catch {}
    setActionLoading(prev => ({ ...prev, [`destroy-${code}`]: false }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-zinc-600 ml-auto">
          {rooms.length} room{rooms.length !== 1 ? 's' : ''} · auto-refresh 5s
        </span>
      </div>
      {rooms.map(r => {
        const s = stateLabel(r.state);
        return (
          <div key={r.code} className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center min-w-[80px]">
                <p className="text-2xl font-bold tracking-[0.15em] text-[var(--primary)] font-mono">{r.code}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>{s.text}</span>
                  <span className="text-xs text-zinc-500">{r.players} player{r.players !== 1 ? 's' : ''}</span>
                  {r.state !== 'waiting' && (
                    <span className="text-xs text-zinc-500">Round {r.currentRound}/{r.totalRounds}</span>
                  )}
                </div>
                {r.genres?.length > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-1 truncate">
                    {r.genres.map((g: string) => genreLabel(g)).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.state === 'waiting' && (
                  <button
                    onClick={() => handleStart(r.code)}
                    disabled={actionLoading[`start-${r.code}`]}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading[`start-${r.code}`] ? '...' : 'Start'}
                  </button>
                )}
                <button
                  onClick={() => handleDestroy(r.code)}
                  disabled={actionLoading[`destroy-${r.code}`]}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading[`destroy-${r.code}`] ? '...' : 'Kill'}
                </button>
                <button
                  onClick={() => setExpandedCode(expandedCode === r.code ? null : r.code)}
                  className="px-3 py-1.5 bg-white/5 text-zinc-400 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
                >
                  {expandedCode === r.code ? 'Hide Players' : 'Inspect Players'}
                </button>
              </div>
            </div>
            {expandedCode === r.code && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
              >
                {r.playersList && r.playersList.length > 0 ? (
                  <div className="space-y-2">
                    {r.playersList.map((p: any) => (
                      <div key={p.id || p.player_id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            (p.username || p.player_name || '?')[0].toUpperCase()
                          )}
                        </div>
                        <span className="text-sm text-zinc-300 flex-1 truncate">{p.username || p.player_name || 'Unknown'}</span>
                        <span className="text-xs text-zinc-500">{p.score ?? '-'}</span>
                        <button
                          onClick={() => handleKick(r.code, p.id || p.player_id)}
                          disabled={actionLoading[`kick-${r.code}-${p.id || p.player_id}`]}
                          className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          {actionLoading[`kick-${r.code}-${p.id || p.player_id}`] ? '...' : 'Kick'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 text-center py-3">No player data available.</p>
                )}
              </motion.div>
            )}
          </div>
        );
      })}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && rooms.length === 0 && <p className="text-zinc-500 text-center py-8">No rooms.</p>}
    </div>
  );
}

function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLeaderboard(await getLeaderboard()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWipe = async (userId: string, username: string) => {
    if (!confirm(`Wipe all scores for "${username}"? This cannot be undone.`)) return;
    try { await wipeUserScores(userId); load(); } catch {}
  };

  const topBorder = (i: number) => {
    if (i === 0) return 'border-yellow-400/30 bg-yellow-500/[0.04]';
    if (i === 1) return 'border-zinc-300/20 bg-zinc-300/[0.03]';
    if (i === 2) return 'border-amber-600/20 bg-amber-600/[0.04]';
    return 'border-white/10';
  };

  const rankColor = (i: number) => {
    if (i === 0) return 'text-yellow-400';
    if (i === 1) return 'text-zinc-300';
    if (i === 2) return 'text-amber-600';
    return 'text-zinc-500';
  };

  return (
    <div className="space-y-2">
      {leaderboard.map((e: any, i: number) => (
        <div
          key={e.id || e.player_id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-md border ${topBorder(i)}`}
        >
          <span className={`w-7 text-center text-sm font-bold ${rankColor(i)}`}>
            {i + 1}
          </span>
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-zinc-700 flex items-center justify-center text-xs font-bold">
            {e.avatar_url ? (
              <img src={e.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              (e.username || e.player_name || '?')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate text-zinc-300">{e.username || e.player_name || 'Unknown'}</p>
            <p className="text-xs text-zinc-500">{e.games_played} games · {e.wins || 0} wins</p>
          </div>
          <span className="text-lg font-bold text-[var(--accent)]">{e.total_score}</span>
          <button onClick={() => handleWipe(e.id || e.player_id, e.username || e.player_name)} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors shrink-0">
            Wipe
          </button>
        </div>
      ))}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && leaderboard.length === 0 && <p className="text-zinc-500 text-center py-8">No scores yet.</p>}
    </div>
  );
}

function CuratedTab({ onTogglePreview, playingTrackId }: { onTogglePreview?: (trackId: string, previewUrl: string) => void; playingTrackId?: string | null }) {
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

  useEffect(() => {
    getCuratedStats().then(s => {
      setStats(s);
      setByGenre(s.byGenre || []);
    }).catch(() => {}).finally(() => setLoading(false));
    fetchGenres().then(setAllGenres).catch(() => {});
  }, []);

  const loadGenreSongs = async (genre: string) => {
    setSelectedGenre(genre);
    setSongsLoading(true);
    const songs = await getCuratedByGenre(genre);
    setGenreSongs(songs);
    setSongsLoading(false);
  };

  const toggleVerify = async (songId: string, currentlyVerified: boolean) => {
    await verifyCuratedSong(songId, !currentlyVerified);
    setGenreSongs(prev => prev.map(s => s.id === songId ? { ...s, verified: !currentlyVerified } : s));
    setStats(null);
    getCuratedStats().then(s => { setStats(s); setByGenre(s.byGenre || []); });
  };

  const changeGenre = async (songId: string, newGenre: string) => {
    setUpdatingGenre(songId);
    await updateCuratedSongGenre(songId, newGenre);
    setGenreSongs(prev => prev.map(s => s.id === songId ? { ...s, genre: newGenre } : s));
    setUpdatingGenre(null);
    setStats(null);
    getCuratedStats().then(s => { setStats(s); setByGenre(s.byGenre || []); });
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
    getCuratedStats().then(s => { setStats(s); setByGenre(s.byGenre || []); });
    if (selectedGenre) loadGenreSongs(selectedGenre);
  };

  if (loading) return <p className="text-zinc-500 text-center py-8">Loading...</p>;

  const verifiedPct = stats?.total ? ((stats.verified / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Curated" color="var(--primary)" />
        <StatCard value={stats?.verified ?? '-'} label={`Verified (${verifiedPct}%)`} color="#10b981" />
        <StatCard value={stats?.unverified ?? '-'} label="Unverified" color="#f59e0b" />
        <StatCard value={stats?.total_plays ?? '-'} label="Total Plays" color="var(--accent)" />
        <StatCard value={stats?.genres ?? '-'} label="Genres" color="#8b5cf6" />
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300">Songs by Genre</h2>
          <button
            onClick={() => { setShowDiscovery(!showDiscovery); if (!showDiscovery) loadDiscovery(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-colors"
          >
            {showDiscovery ? 'Close Discovery' : 'Discovery (Import) →'}
          </button>
        </div>

        {showDiscovery && (
          <div className="mb-6 bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <h3 className="text-xs font-medium text-zinc-400 mb-3">Discovery — songs in old cache not yet curated</h3>
            {discoveryLoading ? (
              <p className="text-zinc-500 text-xs">Loading...</p>
            ) : discoveryTracks.length === 0 ? (
              <p className="text-zinc-600 text-xs">No discovery candidates found.</p>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--surface)]">
                    <tr className="text-zinc-500 border-b border-white/10">
                      <th className="text-left py-2 pr-2 w-8">
                        <button
                          onClick={() => handleImport(discoveryTracks.map(t => t.id), selectedGenre || undefined)}
                          className="text-[10px] text-[var(--accent)] hover:text-white transition-colors"
                          title="Import all"
                        >
                          All
                        </button>
                      </th>
                      <th className="text-left py-2 pr-2">Track</th>
                      <th className="text-left py-2 px-2">Artist</th>
                      <th className="text-left py-2 px-2 hidden sm:table-cell">Genre</th>
                      <th className="text-right py-2 pl-2">Rank</th>
                      <th className="text-right py-2 pl-2 w-16">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discoveryTracks.map((t: any) => (
                      <tr key={t.id} className="border-b border-white/5">
                        <td className="py-1.5 pr-2">
                          <button
                            onClick={() => handleImport([t.id], selectedGenre || undefined)}
                            disabled={importing.has(t.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-colors disabled:opacity-30"
                          >
                            {importing.has(t.id) ? '...' : 'Import'}
                          </button>
                        </td>
                        <td className="py-1.5 pr-2 font-medium truncate max-w-[180px] text-zinc-300">{t.name}</td>
                        <td className="py-1.5 px-2 truncate max-w-[150px] text-zinc-400">{t.artist}</td>
                        <td className="py-1.5 px-2 hidden sm:table-cell text-zinc-500">{t.genre || t.genres?.[0] || '-'}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-500">{t.rank > 0 ? `#${t.rank.toLocaleString()}` : '-'}</td>
                        <td className="py-1.5 pl-2 text-right">
                          <span className={`text-[10px] ${t.preview_url ? 'text-green-500' : 'text-red-500'}`}>
                            {t.preview_url ? '✓' : '✗'}
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

        {byGenre.length === 0 ? (
          <p className="text-zinc-600 text-sm">No curated songs yet.</p>
        ) : (
          <div className="space-y-2">
            {byGenre.map((g: any) => (
              <div key={g.genre}>
                <button
                  onClick={() => loadGenreSongs(g.genre)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span className="text-xs text-zinc-400 font-medium w-40 truncate">{g.genre}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(g.total / stats.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-16 text-right">{g.total}</span>
                  <span className="text-[10px] text-zinc-600 w-16 text-right">
                    {g.verified}/{g.total} verified
                  </span>
                  <span className="text-[10px] text-zinc-600 w-16 text-right">{g.total_plays} plays</span>
                  <svg className={`w-3 h-3 text-zinc-600 transition-transform ${selectedGenre === g.genre ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                {selectedGenre === g.genre && (
                  <div className="ml-6 pl-3 border-l border-white/10">
                    {songsLoading ? (
                      <p className="text-zinc-500 text-xs py-2">Loading...</p>
                    ) : genreSongs.length === 0 ? (
                      <p className="text-zinc-600 text-xs py-2">No songs in this genre.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[var(--surface)]">
                            <tr className="text-zinc-500 border-b border-white/10">
                              <th className="text-left py-2 pr-2">Track</th>
                              <th className="text-left py-2 px-2">Artist</th>
                              <th className="text-left py-2 px-2">Genre</th>
                              <th className="text-right py-2 px-2">Plays</th>
                              <th className="text-center py-2 px-2">Verified</th>
                              <th className="text-center py-2 px-2">Play</th>
                              <th className="text-right py-2 pl-2">Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {genreSongs.map((s: any) => (
                              <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-2 truncate max-w-[140px] font-medium text-zinc-200">{s.name}</td>
                                <td className="py-1.5 px-2 truncate max-w-[100px] text-zinc-400">{s.artist}</td>
                                <td className="py-1.5 px-2">
                                  <select
                                    value={s.genre}
                                    onChange={e => changeGenre(s.id, e.target.value)}
                                    disabled={updatingGenre === s.id}
                                    className="text-[10px] bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-zinc-300 max-w-[120px] truncate focus:outline-none focus:border-[var(--accent)]"
                                  >
                                    {allGenres.map(g => (
                                      <option key={g.id} value={g.id}>{g.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-zinc-500">{s.played_count}</td>
                                <td className="py-1.5 px-2 text-center">
                                  <button
                                    onClick={() => toggleVerify(s.id, s.verified)}
                                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                                      s.verified
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                        : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30'
                                    }`}
                                  >
                                    {s.verified ? 'Verified' : 'Unverified'}
                                  </button>
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  {onTogglePreview && s.preview_url ? (
                                    <button
                                      onClick={() => onTogglePreview(s.id, s.preview_url)}
                                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
                                    >
                                      {playingTrackId === s.id ? '⏸' : '▶'}
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-zinc-600">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 pl-2 text-right">
                                  <span className={`text-[10px] ${s.has_preview ? 'text-green-500' : 'text-red-500'}`}>
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

function MusicTab() {
  const [data, setData] = useState<{ total: number; genreCount: number; plays: number; genres: { genre: string; count: number; last_fetched: string }[]; played: { id: string; name: string; artist: string; genre: string; genres: string[]; chartSource: string | null; rank: number; play_count: number; last_played: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSongCache().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-500 text-center py-8">Loading...</p>;

  const total = data?.total ?? 0;
  const totalPlays = data?.plays ?? 0;
  const genreList = data?.genres ?? [];
  const genreCount = data?.genreCount ?? 0;
  const played = data?.played ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-3xl font-bold text-[var(--primary)]">{total.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Songs</p>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-3xl font-bold text-[var(--accent)]">{totalPlays.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Plays</p>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-3xl font-bold text-purple-400">{genreCount}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Genres</p>
        </div>
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Most Played</h2>
          <span className="text-[10px] text-zinc-500">{played.length} songs</span>
        </div>
        <div className="overflow-y-auto max-h-[50vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--surface)]">
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-3 px-6">#</th>
                <th className="text-left py-3 px-2">Track</th>
                <th className="text-left py-3 px-2 hidden md:table-cell">Genre</th>
                <th className="text-center py-3 px-2">Plays</th>
                <th className="text-right py-3 px-6">Last Played</th>
              </tr>
            </thead>
            <tbody>
              {played.map((s: any, i: number) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-6 text-zinc-600 tabular-nums">{i + 1}</td>
                  <td className="py-2.5 px-2">
                    <p className="font-medium text-zinc-200 truncate max-w-[200px]">{s.name}</p>
                    <p className="text-[10px] text-zinc-600 truncate max-w-[200px]">{s.artist}</p>
                  </td>
                  <td className="py-2.5 px-2 hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-zinc-400">{(s.genres && s.genres.length > 0) ? s.genres.join(', ') : (s.genre || '-')}</span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-[var(--primary)] tabular-nums">{s.play_count}</td>
                  <td className="py-2.5 px-6 text-right text-xs text-zinc-500">
                    {s.last_played ? new Date(s.last_played).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {played.length === 0 && <p className="text-zinc-600 text-center py-8">No songs played yet</p>}
        </div>
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">By Genre</h2>
        <div className="space-y-2">
          {genreList.map((g: any) => {
            const pct = total > 0 ? (g.count / total) * 100 : 0;
            return (
              <div key={g.genre} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 truncate">{g.genre.charAt(0).toUpperCase() + g.genre.slice(1).replace(/-/g, ' ')}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">{g.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AiTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getAiStats(),
      getAiRecent(50),
    ]).then(([s, r]) => {
      setStats(s);
      setRecentTracks(r?.tracks ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await searchAiTracks(q);
      setSearchResults(res);
    } catch { setSearchResults(null) }
    setSearching(false);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 300);
  };

  if (loading) return <p className="text-zinc-500 text-center py-8">Loading...</p>;

  const pct = (n: number) => stats?.total ? ((n / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard value={stats?.total ?? '-'} label="Total Songs" color="var(--primary)" />
        <StatCard value={stats?.processed ?? '-'} label="Processed" color="#10b981" />
        <StatCard value={stats?.unprocessed ?? '-'} label="Unprocessed" color="#f59e0b" />
        <StatCard value={stats?.errors ?? '-'} label="Errors" color="#ef4444" />
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">AI Genre Distribution</h2>
        {stats?.distribution?.length > 0 ? (
          <div className="space-y-2">
            {stats.distribution.map((g: any) => (
              <div key={g.genre} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28 truncate">{g.genre}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${(g.count / stats.total) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">{g.count}</span>
                <span className="text-[10px] text-zinc-600 w-12 text-right">{pct(g.count)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">No AI enriched tracks yet.</p>
        )}
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Unprocessed Queue</h2>
        {stats?.unprocessedTracks?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-white/10">
                  <th className="text-left py-2 pr-2">#</th>
                  <th className="text-left py-2 px-2">Track</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Artist</th>
                  <th className="text-right py-2 pl-2">Rank</th>
                </tr>
              </thead>
              <tbody>
                {stats.unprocessedTracks.map((t: any, i: number) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="py-1.5 pr-2 text-zinc-600 tabular-nums">{i + 1}</td>
                    <td className="py-1.5 px-2 truncate max-w-[180px] text-zinc-300">{t.name}</td>
                    <td className="py-1.5 px-2 truncate max-w-[180px] hidden sm:table-cell text-zinc-400">{t.artist}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-500">{t.rank > 0 ? `#${t.rank.toLocaleString()}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">All tracks processed.</p>
        )}
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Search AI Tags</h2>
        <p className="text-xs text-zinc-500 mb-4">Search tracks by AI-generated tags, genres, name, or artist.</p>
        <input
          value={searchQ}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder="e.g. sad piano, upbeat rock, chill..."
          className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] transition-colors text-sm"
        />
        {searching && <p className="text-zinc-500 text-xs mt-2">Searching...</p>}
        {searchResults?.tracks?.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-white/10">
                  <th className="text-left py-2 pr-2">Track</th>
                  <th className="text-left py-2 px-2">Artist</th>
                  <th className="text-left py-2 px-2">AI Genres</th>
                  <th className="text-left py-2 pl-2">AI Tags</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.tracks.map((t: any) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="py-1.5 pr-2 font-medium text-zinc-300">{t.name}</td>
                    <td className="py-1.5 px-2 text-zinc-400">{t.artist}</td>
                    <td className="py-1.5 px-2">
                      <span className="flex gap-1 flex-wrap">
                        {(t.ai_genres || []).map((g: string) => (
                          <span key={g} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent)]/20 text-[var(--accent)]">{g}</span>
                        ))}
                      </span>
                    </td>
                    <td className="py-1.5 pl-2">
                      <span className="flex gap-1 flex-wrap">
                        {(t.ai_tags || []).slice(0, 6).map((tag: string) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-400">{tag}</span>
                        ))}
                        {(t.ai_tags || []).length > 6 && <span className="text-[10px] text-zinc-600">+{t.ai_tags.length - 6}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {searchQ && !searching && searchResults?.tracks?.length === 0 && (
          <p className="text-zinc-600 text-sm mt-4">No tracks match "{searchQ}"</p>
        )}
        {searchResults?.error && (
          <p className="text-red-400 text-sm mt-2">{searchResults.error}</p>
        )}
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Recently Processed</h2>
          <span className="text-[10px] text-zinc-500">{recentTracks.length} tracks</span>
        </div>
        <div className="overflow-y-auto max-h-[50vh]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--surface)]">
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-2 px-6">Track</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">Artist</th>
                <th className="text-left py-2 px-2 hidden md:table-cell">AI Genres</th>
                <th className="text-left py-2 px-2 hidden lg:table-cell">AI Tags</th>
                <th className="text-right py-2 px-6">Processed</th>
              </tr>
            </thead>
            <tbody>
              {recentTracks.map((t: any) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2 px-6 truncate max-w-[200px] font-medium text-zinc-200">{t.name}</td>
                  <td className="py-2 px-2 truncate max-w-[150px] hidden sm:table-cell text-zinc-400">{t.artist}</td>
                  <td className="py-2 px-2 hidden md:table-cell">
                    <span className="flex gap-1 flex-wrap">
                      {(t.ai_genres || []).map((g: string) => (
                        <span key={g} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent)]/20 text-[var(--accent)]">{g}</span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 px-2 hidden lg:table-cell">
                    <span className="flex gap-1 flex-wrap">
                      {(t.ai_tags || []).slice(0, 4).map((tag: string) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-400">{tag}</span>
                      ))}
                      {(t.ai_tags || []).length > 4 && <span className="text-[10px] text-zinc-600">+{t.ai_tags.length - 4}</span>}
                    </span>
                  </td>
                  <td className="py-2 px-6 text-right text-zinc-500 whitespace-nowrap">
                    {t.ai_processed_at ? new Date(t.ai_processed_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentTracks.length === 0 && <p className="text-zinc-600 text-center py-8">No processed tracks yet.</p>}
        </div>
      </div>

      <div className="text-xs text-zinc-600">
        Last processed: {stats?.last_processed ? new Date(stats.last_processed).toLocaleString() : 'Never'}
      </div>
    </div>
  );
}

function ApiTab({ onTogglePreview, playingTrackId }: { onTogglePreview?: (trackId: string, previewUrl: string) => void; playingTrackId?: string | null }) {
  const [deezerResult, setDeezerResult] = useState<any>(null);
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);

  const [genre, setGenre] = useState('pop_us');
  const [count, setCount] = useState(50);
  const [source, setSource] = useState('deezer');
  const [results, setResults] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [error, setError] = useState('');

  const runConnectivity = () => {
    setDeezerLoading(true);
    testDeezer().then(setDeezerResult).catch(() => setDeezerResult({ error: 'Request failed' })).finally(() => setDeezerLoading(false));
  };

  useEffect(() => { getDbStatus().then(setDbStatus).catch(() => {}); }, []);

  const runTester = async () => {
    setTesterLoading(true);
    setError('');
    try {
      const res = source === 'deezer'
        ? await testDeezerGenre(genre, count)
        : await testGenre(genre, count);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Test failed');
    }
    setTesterLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Deezer API</h3>
          {deezerResult ? (
            <div className="space-y-1.5 text-[10px] font-mono">
              {deezerResult.error ? (
                <p className="text-red-400">{deezerResult.error}</p>
              ) : (
                deezerResult.tests?.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-zinc-500">{t.endpoint}</span>
                    <span className={t.ok ? 'text-green-400' : 'text-red-400'}>
                      {t.ok ? `${t.latencyMs}ms ✓` : '✗'}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600">Not tested</p>
          )}
          <button
            onClick={() => runConnectivity()}
            disabled={deezerLoading}
            className="mt-3 w-full px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs rounded-lg border border-white/10 transition-colors disabled:opacity-50"
          >
            {deezerLoading ? 'Testing...' : 'Test Deezer'}
          </button>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Database</h3>
          {dbStatus ? (
            dbStatus.ok ? (
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-zinc-300">PostgreSQL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className={dbStatus.hasData ? 'text-green-400' : 'text-yellow-400'}>
                    {dbStatus.hasData ? 'Has data' : 'Empty'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Users</span>
                  <span className="text-zinc-300">{dbStatus.tables?.users ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Scores</span>
                  <span className="text-zinc-300">{dbStatus.tables?.game_scores ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-red-400">{dbStatus.error || 'Failed'}</p>
            )
          ) : (
            <p className="text-[10px] text-zinc-600">Checking...</p>
          )}
        </div>
      </div>

      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Genre Tester</h2>
        <p className="text-xs text-zinc-500 mb-4">Fetches tracks from live APIs and shows rank/popularity data.</p>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Source</label>
            <div className="flex gap-1">
              {SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSource(s.id); setResults(null); }}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    source === s.id ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Genre</label>
            <select
              value={genre}
              onChange={e => { setGenre(e.target.value); setResults(null); }}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {GENRE_OPTIONS.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Count</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={5} max={200} value={count}
                onChange={e => { setCount(Number(e.target.value)); setResults(null); }}
                className="w-20 accent-[var(--primary)] h-1"
              />
              <span className="text-xs text-zinc-400 tabular-nums w-8">{count}</span>
            </div>
          </div>
          <button
            onClick={runTester}
            disabled={testerLoading}
            className="px-4 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {testerLoading ? 'Fetching...' : 'Fetch'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}

        {results && (
          <div>
            <div className="flex items-center gap-4 mb-3 text-[10px]">
              <span className="text-zinc-500">{results.count ?? results.tracks?.length} tracks</span>
              {results.previewCount != null && (
                <span className="text-green-400">{results.previewCount} with preview</span>
              )}
              {results.latencyMs != null && (
                <span className="text-zinc-600">{results.latencyMs}ms</span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="text-zinc-500 border-b border-white/10">
                    <th className="text-right py-2 pr-2 w-10">#</th>
                    <th className="text-left py-2 px-2">Track</th>
                    <th className="text-left py-2 px-2 hidden md:table-cell">Artist</th>
                    <th className="text-center py-2 px-2 w-14">Preview</th>
                    <th className="text-center py-2 px-2 w-14">Play</th>
                  </tr>
                </thead>
                <tbody>
                  {(results.tracks || []).map((t: any, i: number) => (
                    <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.02] ${
                      t.rank >= 1000000 ? 'bg-purple-500/5' : t.rank >= 100000 ? 'bg-blue-500/5' : t.rank >= 10000 ? 'bg-cyan-500/5' : ''
                    }`}>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        <span className={
                          t.rank >= 1000000 ? 'text-purple-400' : t.rank >= 100000 ? 'text-blue-400' : t.rank >= 10000 ? 'text-cyan-400' : 'text-zinc-500'
                        }>
                          {t.rank > 0 ? `#${t.rank.toLocaleString()}` : '-'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 truncate max-w-[200px] text-zinc-300">{t.name}</td>
                      <td className="py-1.5 px-2 truncate max-w-[200px] hidden md:table-cell text-zinc-500">{t.artist}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${t.previewUrl || t.preview_url ? 'bg-green-400' : 'bg-zinc-600'}`} />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {onTogglePreview && (t.previewUrl || t.preview_url) ? (
                          <button
                            onClick={() => onTogglePreview(t.id || `${i}`, t.previewUrl || t.preview_url)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
                          >
                            {playingTrackId === t.id ? '⏸' : '▶'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
