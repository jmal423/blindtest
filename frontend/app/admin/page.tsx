'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { getMe, getAdminUsers, getAdminStats, getAdminRooms, getLeaderboard, updateUserRole, deleteUser, wipeUserScores, testDeezer, testDeezerGenre, getDbStatus, testGenre, getSongCache, fetchGenres, getAiStats, searchAiTracks, getAiRecent, getCuratedStats, getCuratedByGenre, getCuratedDiscovery, importToCurated, verifyCuratedSong } from '@/lib/api';

type Tab = 'system' | 'users' | 'rooms' | 'leaderboard' | 'music' | 'curated' | 'ai' | 'api';

const tabs: { id: Tab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'users', label: 'Users' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'music', label: 'Music' },
  { id: 'curated', label: 'Curated' },
  { id: 'ai', label: 'AI' },
  { id: 'api', label: 'API' },
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
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full gap-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 border border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-bg"
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
        {activeTab === 'rooms' && <RoomsTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'music' && <MusicTab />}
        {activeTab === 'curated' && <CuratedTab />}
        {activeTab === 'ai' && <AiTab />}
        {activeTab === 'api' && <ApiTab />}
      </motion.div>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">Database</h2>
        {dbStatus ? (
          dbStatus.ok ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${dbStatus.hasData ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-sm">PostgreSQL</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${dbStatus.hasData ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {dbStatus.hasData ? 'Has data' : 'Empty'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                <div className="text-center">
                  <p className="text-lg font-bold">{dbStatus.tables?.users ?? 0}</p>
                  <p className="text-[10px] text-zinc-500">Users</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{dbStatus.tables?.game_scores ?? 0}</p>
                  <p className="text-[10px] text-zinc-500">Scores</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{dbStatus.tables?.round_results ?? 0}</p>
                  <p className="text-[10px] text-zinc-500">Rounds</p>
                </div>
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

function StatCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-8 text-center">
      <p className="text-5xl font-bold" style={{ color }}>{value}</p>
      <p className="text-zinc-500 mt-2 text-sm uppercase tracking-wider">{label}</p>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getAdminUsers()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() =>
    search ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase())) : users,
    [users, search]
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
        onChange={e => setSearch(e.target.value)}
        placeholder="Search users..."
        className="w-full px-4 py-2 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors text-sm"
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
                      <p className="font-medium truncate">{u.username}</p>
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
                      className="bg-[var(--surface)] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
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
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRooms(await getAdminRooms()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const filtered = showAll ? rooms : rooms.filter(r => r.state !== 'game_over');

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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setShowAll(false)}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${!showAll ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
        >
          Active
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${showAll ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
        >
          All rooms
        </button>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {filtered.length} room{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      {filtered.map(r => {
        const s = stateLabel(r.state);
        return (
          <div key={r.code} className="bg-[var(--surface)] rounded-xl border border-white/10 p-4 flex items-center gap-4 flex-wrap">
            <div className="text-center min-w-[60px]">
              <p className="text-xl font-bold tracking-[0.2em] text-[var(--primary)]">{r.code}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>{s.text}</span>
                <span className="text-xs text-zinc-500">{r.players} player{r.players !== 1 ? 's' : ''}</span>
                {r.state !== 'waiting' && (
                  <span className="text-xs text-zinc-500">Round {r.currentRound}/{r.totalRounds}</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1 truncate">
                {r.genres?.join(', ') || 'no genres'}
              </p>
            </div>
          </div>
        );
      })}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && filtered.length === 0 && <p className="text-zinc-500 text-center py-8">{showAll ? 'No rooms.' : 'No active rooms.'}</p>}
      {!loading && rooms.length > 0 && (
        <p className="text-[10px] text-zinc-600 text-center pt-2">Auto-refreshes every 10s</p>
      )}
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

  return (
    <div className="space-y-1">
      {leaderboard.map((e: any, i: number) => (
        <div
          key={e.id || e.player_id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
            i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20'
              : i === 1 ? 'bg-zinc-300/5 border border-white/5'
              : i === 2 ? 'bg-amber-600/10 border border-amber-600/20'
              : 'bg-[var(--surface)]'
          }`}
        >
          <span className={`w-6 text-center text-sm font-bold ${
            i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
          }`}>
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
            <p className="font-medium text-sm truncate">{e.username || e.player_name || 'Unknown'}</p>
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

function CuratedTab() {
  const [stats, setStats] = useState<any>(null);
  const [byGenre, setByGenre] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreSongs, setGenreSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryTracks, setDiscoveryTracks] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCuratedStats().then(s => {
      setStats(s);
      setByGenre(s.byGenre || []);
    }).catch(() => {}).finally(() => setLoading(false));
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Songs by Genre</h2>
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
                      <th className="text-right py-2 pl-2 w-16"></th>
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
                        <td className="py-1.5 pr-2 font-medium truncate max-w-[180px]">{t.name}</td>
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
                              <th className="text-right py-2 px-2">Plays</th>
                              <th className="text-center py-2 px-2">Verified</th>
                              <th className="text-right py-2 pl-2">Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {genreSongs.map((s: any) => (
                              <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-2 truncate max-w-[200px] font-medium text-zinc-200">{s.name}</td>
                                <td className="py-1.5 px-2 truncate max-w-[150px] text-zinc-400">{s.artist}</td>
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
        <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 text-center">
          <p className="text-3xl font-bold text-[var(--primary)]">{total.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Songs</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 text-center">
          <p className="text-3xl font-bold text-[var(--accent)]">{totalPlays.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Plays</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6 text-center">
          <p className="text-3xl font-bold text-purple-400">{genreCount}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Genres</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Most Played</h2>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">By Genre</h2>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">AI Genre Distribution</h2>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">Unprocessed Queue</h2>
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
                    <td className="py-1.5 px-2 truncate max-w-[180px]">{t.name}</td>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">Search AI Tags</h2>
        <p className="text-xs text-zinc-500 mb-4">Search tracks by AI-generated tags, genres, name, or artist.</p>
        <input
          value={searchQ}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder="e.g. sad piano, upbeat rock, chill..."
          className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] transition-colors text-sm"
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
                    <td className="py-1.5 pr-2 font-medium">{t.name}</td>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recently Processed</h2>
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

const SOURCES = [
  { id: 'deezer', label: 'Deezer', desc: 'Free, has rank data' },
];

function ApiTab() {
  const [deezerResult, setDeezerResult] = useState<any>(null);
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);

  const [genreList, setGenreList] = useState<{ id: string; label: string }[]>([]);
  const [genre, setGenre] = useState('pop');
  const [count, setCount] = useState(50);
  const [source, setSource] = useState('deezer');
  const [results, setResults] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchGenres().then(setGenreList).catch(() => {}); }, []);

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
        <div className="bg-[var(--surface)] rounded-xl border border-white/10 p-5">
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

        <div className="bg-[var(--surface)] rounded-xl border border-white/10 p-5">
          <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Database</h3>
          {dbStatus ? (
            dbStatus.ok ? (
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Type</span>
                  <span>PostgreSQL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className={dbStatus.hasData ? 'text-green-400' : 'text-yellow-400'}>
                    {dbStatus.hasData ? 'Has data' : 'Empty'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Users</span>
                  <span>{dbStatus.tables?.users ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Scores</span>
                  <span>{dbStatus.tables?.game_scores ?? 0}</span>
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

      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <h2 className="text-sm font-semibold mb-4">Genre Tester</h2>
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
              className="bg-[var(--surface)] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {genreList.map(g => (
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
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${t.previewUrl ? 'bg-green-400' : 'bg-zinc-600'}`} />
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
