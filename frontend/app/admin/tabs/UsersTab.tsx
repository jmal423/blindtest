'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAdminUsers, updateUserRole, deleteUser } from '@/lib/api';

export function UsersTab() {
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
    if (
      !confirm(
        `Are you absolutely sure you want to delete user "${username}"? This will permanently wipe all associated scores, games, and friends.`
      )
    )
      return;
    await deleteUser(userId);
    loadUsers();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-foreground/40">
          🔍
        </span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search registered players by username or Discord ID..."
          className="w-full pl-10 pr-4 py-3 bg-surface/20 backdrop-blur-md border border-white/5 rounded-2xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-[var(--primary)] transition-all text-sm"
        />
      </div>

      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-foreground/40 border-b border-white/5 text-xs uppercase tracking-wider">
                <th className="text-left py-4 px-6">User Profile</th>
                <th className="text-left py-4 px-4">Access Level</th>
                <th className="text-left py-4 px-4 hidden sm:table-cell">Date Joined</th>
                <th className="text-right py-4 px-6">Administration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr
                  key={u.id}
                  className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border border-white/10">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          u.username[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate text-sm">{u.username}</p>
                        <p className="text-[10px] text-foreground/40 font-mono truncate">{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30'
                          : 'bg-foreground/10 text-foreground/60 border border-foreground/10'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-foreground/60 text-xs hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex gap-3 justify-end items-center">
                      <select
                        value={u.role}
                        onChange={e => handleRole(u.id, e.target.value)}
                        className="bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--primary)]"
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
            <p className="text-foreground/40 text-xs">Querying database...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-foreground/40 text-center py-16 text-sm">No players match the search criteria.</p>
        )}
      </div>
    </div>
  );
}
