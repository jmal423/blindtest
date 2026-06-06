'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, getAdminUsers, updateUserRole, deleteUser } from '@/lib/api';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) { router.push('/login'); return; }

    getMe().then(u => {
      if (u.role !== 'admin') { router.push('/'); return; }
      loadUsers();
    }).catch(() => {
      localStorage.removeItem('blindtest_token');
      router.push('/login');
    });
  }, [router]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const u = await getAdminUsers();
      setUsers(u);
    } catch {}
    setLoading(false);
  };

  const handleRole = async (userId: string, role: string) => {
    await updateUserRole(userId, role);
    loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user and all their data?')) return;
    await deleteUser(userId);
    loadUsers();
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full gap-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

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
                        <img src={`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar_url}.png`} alt="" className="w-full h-full object-cover" />
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
        {users.length === 0 && <p className="text-zinc-500 text-center py-8">No users yet.</p>}
      </div>

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors">
        Back Home
      </Link>
    </div>
  );
}
