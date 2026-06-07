'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { getMe, getAdminUsers, getAdminStats, getAdminRooms, getLeaderboard, updateUserRole, deleteUser, wipeUserScores, testSpotify, testGenre, testYouTube } from '@/lib/api';

type Tab = 'system' | 'users' | 'rooms' | 'leaderboard' | 'diagnostics';

const tabs: { id: Tab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'users', label: 'Users' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'diagnostics', label: 'Diagnostics' },
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
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
      </motion.div>
    </div>
  );
}

function SystemTab() {
  const [stats, setStats] = useState<any>(null);
  const [ytStatus, setYtStatus] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
    testYouTube('test', 'test').then(r => {
      setYtStatus(r.ok && r.videoId ? 'ok' : r.error ? 'error' : 'no-video');
    }).catch(() => setYtStatus('error'));
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" />
      <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" />
      <StatCard value={stats?.activeRooms ?? '-'} label="Active Rooms" color="#10b981" />
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-8 text-center">
        <p className={`text-3xl font-bold ${ytStatus === 'ok' ? 'text-green-400' : ytStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
          {ytStatus === 'ok' ? 'Online' : ytStatus === 'error' ? 'Error' : ytStatus === 'no-video' ? 'Quota' : '...'}
        </p>
        <p className="text-zinc-500 mt-2 text-sm uppercase tracking-wider">YouTube API</p>
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
    try {
      const u = await getAdminUsers();
      setUsers(u);
    } catch {}
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
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
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

  const load = useCallback(async () => {
    setLoading(true);
    try { setRooms(await getAdminRooms()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

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
      {rooms.map(r => {
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
                {r.genres.join(', ') || 'no genres'}
              </p>
            </div>
          </div>
        );
      })}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && rooms.length === 0 && <p className="text-zinc-500 text-center py-8">No active rooms.</p>}
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
          key={e.id}
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
              <img src={e.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              e.username[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{e.username}</p>
            <p className="text-xs text-zinc-500">{e.games_played} games</p>
          </div>
          <span className="text-lg font-bold text-[var(--accent)]">{e.total_score}</span>
          <button
            onClick={() => handleWipe(e.id, e.username)}
            className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors shrink-0"
          >
            Wipe
          </button>
        </div>
      ))}
      {loading && <p className="text-zinc-500 text-center py-8">Loading...</p>}
      {!loading && leaderboard.length === 0 && <p className="text-zinc-500 text-center py-8">No scores yet.</p>}
    </div>
  );
}

const GENRES = [
  'pop', 'rock', 'hip-hop', 'r-n-b', 'electronic', 'jazz', 'classical',
  'country', 'metal', 'indie', 'alternative', 'soul', 'funk', 'blues',
  'reggae', 'punk', 'latin', 'dance', 'edm', 'acoustic',
];

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
      {ok ? 'PASS' : 'FAIL'}
    </span>
  );
}

function DiagnosticsTab() {
  const [spotifyResult, setSpotifyResult] = useState<any>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [genreResult, setGenreResult] = useState<any>(null);
  const [genreLoading, setGenreLoading] = useState(false);
  const [ytName, setYtName] = useState('');
  const [ytArtist, setYtArtist] = useState('');
  const [ytResult, setYtResult] = useState<any>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const runSpotifyTest = async () => {
    setSpotifyLoading(true);
    setSpotifyResult(null);
    try { setSpotifyResult(await testSpotify()); }
    catch (e: any) { setSpotifyResult({ ok: false, error: e.message }); }
    setSpotifyLoading(false);
  };

  const runGenreTest = async () => {
    setGenreLoading(true);
    setGenreResult(null);
    try { setGenreResult(await testGenre(selectedGenre)); }
    catch (e: any) { setGenreResult({ ok: false, error: e.message }); }
    setGenreLoading(false);
  };

  const runYtTest = async () => {
    setYtLoading(true);
    setYtResult(null);
    try { setYtResult(await testYouTube(ytName, ytArtist)); }
    catch (e: any) { setYtResult({ ok: false, error: e.message }); }
    setYtLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Spotify API Test */}
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Spotify API</h2>
          {spotifyResult && <StatusBadge ok={!!spotifyResult.ok} />}
        </div>
        <p className="text-sm text-zinc-500 mb-4">Tests connectivity by running endpoint checks against the Spotify Web API.</p>
        <button
          onClick={runSpotifyTest}
          disabled={spotifyLoading}
          className="px-4 py-2 bg-[var(--primary)]/20 text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)]/30 transition-colors disabled:opacity-50"
        >
          {spotifyLoading ? 'Testing...' : 'Run Spotify Tests'}
        </button>
        {spotifyResult && (
          <div className="mt-4 bg-black/20 rounded-xl p-4 font-mono text-xs space-y-1 overflow-x-auto max-h-64 overflow-y-auto">
            {Array.isArray(spotifyResult) ? spotifyResult.map((r: any, i: number) => (
              <div key={i} className="flex gap-2">
                <span className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.ok ? '✓' : '✗'}</span>
                <span className="text-zinc-400">{r.label}</span>
                <span className="text-zinc-600">({r.status})</span>
              </div>
            )) : (
              <p className="text-red-400">{spotifyResult.error || 'Unknown error'}</p>
            )}
          </div>
        )}
      </div>

      {/* Genre Track Fetch Test */}
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Genre Track Fetch</h2>
          {genreResult && <StatusBadge ok={!!genreResult.ok} />}
        </div>
        <p className="text-sm text-zinc-500 mb-4">Fetches sample tracks for a genre and shows preview URL availability.</p>
        <div className="flex gap-3 mb-4">
          <select
            value={selectedGenre}
            onChange={e => setSelectedGenre(e.target.value)}
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            {GENRES.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <button
            onClick={runGenreTest}
            disabled={genreLoading}
            className="px-4 py-2 bg-[var(--accent)]/20 text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-[var(--accent)]/30 transition-colors disabled:opacity-50 shrink-0"
          >
            {genreLoading ? 'Fetching...' : 'Test Genre'}
          </button>
        </div>
        {genreResult && (
          <div className="bg-black/20 rounded-xl p-4 font-mono text-xs space-y-1 overflow-x-auto max-h-80 overflow-y-auto">
            <p>
              <span className="text-zinc-400">Tracks fetched: </span>
              <span className="text-white">{genreResult.count || 0}</span>
              {genreResult.tracks && (
                <span className="text-zinc-500 ml-2">
                  (previews: {genreResult.tracks.filter((t: any) => t.previewUrl).length})
                </span>
              )}
            </p>
            {genreResult.error && <p className="text-red-400">Error: {genreResult.error}</p>}
            {genreResult.tracks && genreResult.tracks.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-zinc-400">Sample tracks:</p>
                {genreResult.tracks.map((t: any, i: number) => (
                  <p key={i} className="text-white/80">
                    [{t.genre}] {t.name} — {t.artist}{' '}
                    <span className={t.previewUrl ? 'text-green-400' : 'text-red-400'}>
                      {t.previewUrl ? '(preview ✓)' : '(no preview)'}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* YouTube Search Test */}
      <div className="bg-[var(--surface)] rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">YouTube Search</h2>
          {ytResult && <StatusBadge ok={!!(ytResult.ok && ytResult.videoId)} />}
        </div>
        <p className="text-sm text-zinc-500 mb-4">Tests YouTube Data API quota and search functionality.</p>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={ytName}
            onChange={e => setYtName(e.target.value)}
            placeholder="Track name"
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <input
            value={ytArtist}
            onChange={e => setYtArtist(e.target.value)}
            placeholder="Artist"
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <button
            onClick={runYtTest}
            disabled={ytLoading || !ytName || !ytArtist}
            className="px-4 py-2 bg-[var(--primary)]/20 text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[var(--primary)]/30 transition-colors disabled:opacity-50 shrink-0"
          >
            {ytLoading ? 'Searching...' : 'Test'}
          </button>
        </div>
        {ytResult && (
          <div className="bg-black/20 rounded-xl p-4 font-mono text-xs space-y-1 overflow-x-auto">
            {ytResult.videoId
              ? <p>Video ID: <span className="text-green-400">{ytResult.videoId}</span></p>
              : <p className="text-red-400">No video found</p>
            }
            {ytResult.error && <p className="text-red-400">Error: {ytResult.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
