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

  return (
    <div className="space-y-6">
      {/* Quick Action Alerts */}
      {unclassifiedCount > 0 && (
        <Link
          href="/admin/catalog/triage"
          className="block rounded-2xl p-5 transition-all hover:scale-[1.005]"
          style={{
            backgroundColor: 'color-mix(in srgb, #f59e0b 10%, transparent)',
            border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm text-foreground/90">
                {unclassifiedCount} Unclassified Song{unclassifiedCount !== 1 ? 's' : ''} Pending Triage
              </p>
              <p className="text-xs text-foreground/50 mt-0.5">
                Review and assign genres to automatically classify these tracks
              </p>
            </div>
            <span className="ml-auto text-xs font-extrabold uppercase tracking-wider text-foreground/40">
              Review →
            </span>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(255,45,120,0.15)" icon="👥" />
        <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" glowColor="rgba(240,192,64,0.15)" icon="🎵" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={stats?.activeRooms ?? '-'} label="Active Lobbies" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="🎮" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DB Status */}
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <span className="text-lg">🐘</span> System Health
          </h3>
          {dbStatus ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${dbStatus.ok ? 'bg-green-500 animate-ping' : 'bg-red-500'} `} />
                <span className="text-sm font-semibold" style={{ color: 'color-mix(in srgb, var(--foreground) 80%, transparent)' }}>
                  {dbStatus.ok ? 'Database connected & online' : 'Database error'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {dbStatus.tables && Object.entries(dbStatus.tables).map(([table, count]) => (
                  <div key={table} className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
                    <p className="text-xl font-bold">{count as number}</p>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">{table.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground/40">Loading...</div>
          )}
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--foreground)' }}>Quick Actions</h3>
          <Link href="/admin/catalog/triage" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground transition-all" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
            <span>🔍</span> Triage Queue {unclassifiedCount > 0 && <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{unclassifiedCount}</span>}
          </Link>
          <Link href="/admin/catalog/curated" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground transition-all" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
            <span>✨</span> Curated Library
          </Link>
          <Link href="/admin/game/rooms" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground transition-all" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
            <span>🎮</span> Active Rooms
          </Link>
          <Link href="/admin/system/metrics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground transition-all" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
            <span>📈</span> System Metrics
          </Link>
        </div>
      </div>

      {/* Song Cache Overview */}
      {songCache && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--foreground)' }}>Song Cache</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <p className="text-xl font-bold">{songCache.total ?? '-'}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">Total Tracks</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <p className="text-xl font-bold">{songCache.genreCount ?? '-'}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">Genres</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <p className="text-xl font-bold">{songCache.plays ?? '-'}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">Total Plays</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
              <p className="text-xl font-bold">{unclassifiedCount}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/40">Unclassified</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
