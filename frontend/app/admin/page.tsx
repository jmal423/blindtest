'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAdminStats, getDbStatus, getAiStats, getSongCache } from '@/lib/api';
import { StatCard } from './components/StatCard';

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [songCache, setSongCache] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      getAdminStats().then(setStats).catch(() => {}),
      getAiStats().then(setAiStats).catch(() => {}),
      getDbStatus().then(setDbStatus).catch(() => {}),
      getSongCache().then(setSongCache).catch(() => {}),
    ]);
  }, []);

  const unclassifiedCount = aiStats?.unprocessed ?? 0;
  const curatedCount = dbStatus?.tables?.curation ?? 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {unclassifiedCount > 0 && (
        <Link href="/admin/catalog/triage" className="block rounded-2xl p-5 transition-all hover:scale-[1.005]"
          style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 10%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm text-foreground/90">{unclassifiedCount} Tracks Need Classification</p>
              <p className="text-xs text-foreground/50 mt-0.5">Run the AI pipeline or triage manually</p>
            </div>
            <span className="ml-auto text-xs font-extrabold uppercase tracking-wider text-foreground/40">Triage →</span>
          </div>
        </Link>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(255,45,120,0.15)" icon="👥" />
        <StatCard value={songCache?.total ?? '-'} label="Tracks in Library" color="var(--accent)" glowColor="rgba(240,192,64,0.15)" icon="💿" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={curatedCount || '-'} label="Curated Tracks" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="✨" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <span className="text-lg">🐘</span> Database Health
          </h3>
          {dbStatus ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${dbStatus.ok ? 'bg-green-500' : 'bg-red-500'} ${dbStatus.ok ? 'animate-ping' : ''}`} />
                <span className="text-sm font-semibold" style={{ color: 'color-mix(in srgb, var(--foreground) 80%, transparent)' }}>
                  {dbStatus.ok ? 'Connected' : 'Error'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {dbStatus.tables && Object.entries(dbStatus.tables).map(([table, count]) => (
                  <div key={table} className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
                    <p className="text-lg font-bold">{count as number}</p>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/40">{table.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground/40">Loading...</div>
          )}
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl p-6 space-y-2" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--foreground)' }}>Quick Actions</h3>
          {[
            { href: '/admin/catalog/triage', icon: '🔍', label: 'Triage Queue', badge: unclassifiedCount > 0 ? unclassifiedCount : null },
            { href: '/admin/catalog/curated', icon: '✨', label: 'Curated Library' },
            { href: '/admin/catalog/flags', icon: '🚩', label: 'Reported Songs' },
            { href: '/admin/catalog/library', icon: '💾', label: 'Song Library' },
            { href: '/admin/game/leaderboard', icon: '🏆', label: 'Leaderboard' },
            { href: '/admin/system/metrics', icon: '📈', label: 'System Metrics' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground transition-all"
              style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <span>{item.icon}</span> {item.label}
              {item.badge !== null && item.badge !== undefined && (
                <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* AI Stats */}
      {aiStats && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--foreground)' }}>🤖 AI Classification</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: aiStats.total },
              { label: 'Classified', value: aiStats.processed, color: 'var(--accent)' },
              { label: 'Unclassified', value: aiStats.unprocessed, color: aiStats.unprocessed > 0 ? '#f59e0b' : undefined },
              { label: 'UNCLASSIFIED', value: aiStats.distribution?.find((d: any) => d.genre === 'UNCLASSIFIED')?.count || 0, color: '#f59e0b' },
              { label: 'Errors', value: aiStats.errors, color: aiStats.errors > 0 ? '#ef4444' : undefined },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
                <p className="text-xl font-bold" style={item.color ? { color: item.color } : {}}>{item.value ?? '-'}</p>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
