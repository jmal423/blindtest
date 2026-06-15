'use client';

import { useState, useMemo, ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 25,
  loading = false,
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-foreground/40 text-xs">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-foreground/40 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 bg-surface/20 backdrop-blur-md border border-white/5 rounded-2xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-[var(--primary)] transition-all text-sm"
          />
        </div>
      )}

      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-foreground/40 border-b border-white/5 text-xs uppercase tracking-wider">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`text-left py-4 px-4 first:pl-6 last:pr-6 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-foreground/60 transition-colors' : ''}`}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    {col.label}
                    {col.sortable !== false && <span className="text-foreground/20 ml-1">{sortIndicator(col.key)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr
                  key={row[keyField]}
                  className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors"
                >
                  {columns.map(col => (
                    <td key={col.key} className="py-3 px-4 first:pl-6 last:pr-6">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <p className="text-foreground/40 text-center py-16 text-sm">{emptyMessage}</p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 text-xs text-foreground/50">
            <span>
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
              {search ? ` for "${search}"` : ''}
              {totalPages > 1 ? ` — page ${page + 1} of ${totalPages}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded-lg transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
