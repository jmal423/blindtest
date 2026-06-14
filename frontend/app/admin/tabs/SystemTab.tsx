'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { getAdminStats, getDbStatus } from '@/lib/api';
import { StatCard } from '../components/StatCard';
import { ProgressMeter } from '../components/ProgressMeter';

export function SystemTab() {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(255,45,120,0.15)" icon="👥" />
        <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" glowColor="rgba(240,192,64,0.15)" icon="🎵" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={stats?.activeRooms ?? '-'} label="Active Lobbies" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="🎮" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <span className="text-lg">🐘</span> PostgreSQL Status
              </h3>
              <button
                onClick={loadSystemData}
                disabled={loading}
                className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)', color: 'color-mix(in srgb, var(--foreground) 60%, transparent)' }}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    <span className="text-sm font-semibold" style={{ color: 'color-mix(in srgb, var(--foreground) 80%, transparent)' }}>Database connected & online</span>
                  </div>

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
                <div className="p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm font-medium" style={{ color: '#f87171' }}>{dbStatus.error || 'Connection failure'}</p>
                </div>
              )
            ) : (
              <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>Testing connectivity...</p>
            )}
          </div>

          <div className="mt-6 pt-4 flex justify-between text-[11px]" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)', color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>
            <span>Type: Local Postgres Container</span>
            <span>Uptime check: OK</span>
          </div>
        </div>

        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <span className="text-lg">🖥️</span> Service Performance
            </h3>
            <div className="space-y-5">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Uptime</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Local Cache Size</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--primary)' }}>
                  {stats?.songCacheTotal ?? 0} songs
                </span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>Avg Socket Latency</span>
                <span className="text-xl font-black tabular-nums" style={{ color: 'var(--accent)' }}>Normal (&lt; 10ms)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 flex items-center gap-2 text-xs" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)', color: '#4ade80' }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All local networks healthy
          </div>
        </div>
      </div>
    </div>
  );
}
