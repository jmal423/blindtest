'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAdminUsers, updateUserRole, deleteUser } from '@/lib/api';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const handleRole = async (userId: string, role: string) => {
    await updateUserRole(userId, role);
    loadUsers();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    loadUsers();
  };

  const columns = [
    {
      key: 'username',
      label: 'User Profile',
      render: (u: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 border border-white/10">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              u.username[0].toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate text-sm">{u.username}</p>
            <p className="text-[10px] text-foreground/40 font-mono truncate">{u.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Access Level',
      render: (u: any) => (
        <select
          value={u.role}
          onChange={e => handleRole(u.id, e.target.value)}
          className="bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      ),
    },
    {
      key: 'created_at',
      label: 'Date Joined',
      render: (u: any) => (
        <span className="text-xs text-foreground/60">
          {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (u: any) => (
        <div className="flex justify-end">
          <button
            onClick={() => setDeleteTarget({ id: u.id, name: u.username })}
            className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all cursor-pointer"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        keyField="id"
        searchPlaceholder="Search by username or Discord ID..."
        loading={loading}
        emptyMessage="No users found."
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`This will permanently wipe all scores, games, and data for "${deleteTarget?.name}".`}
        confirmLabel="Delete User"
        destructive
      />
    </>
  );
}
