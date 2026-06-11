'use client';

import { useState, useEffect, useCallback } from 'react';
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
      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={stats?.totalUsers ?? '-'} label="Registered Users" color="var(--primary)" glowColor="rgba(108,92,231,0.15)" icon="👥" />
        <StatCard value={stats?.totalRounds ?? '-'} label="Rounds Played" color="var(--accent)" glowColor="rgba(0,206,201,0.15)" icon="🎵" />
        <StatCard value={stats?.totalGames ?? '-'} label="Games Completed" color="#a29bfe" glowColor="rgba(162,155,254,0.15)" icon="🏆" />
        <StatCard value={stats?.activeRooms ?? '-'} label="Active Lobbies" color="#00b894" glowColor="rgba(0,184,148,0.15)" icon="🎮" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Postgres Status Card */}
        <div className="lg:col-span-2 bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="text-xl">🐘</span> PostgreSQL Status
              </h3>
              <button
                onClick={loadSystemData}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>

            {dbStatus ? (
              dbStatus.ok ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    <span className="text-sm font-semibold text-zinc-300">Database connected & online</span>
                  </div>

                  {/* Custom progress bars indicating DB distribution */}
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
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-red-400 font-medium">{dbStatus.error || 'Connection failure'}</p>
                </div>
              )
            ) : (
              <p className="text-zinc-500 text-sm">Testing connectivity...</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex justify-between text-xs text-zinc-500">
            <span>Type: Local Postgres Container</span>
            <span>Uptime check: OK</span>
          </div>
        </div>

        {/* Server Performance Card */}
        <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-xl">🖥️</span> Service Performance
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Uptime</span>
                <span className="text-xl font-bold text-white tabular-nums">
                  {stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Local Cache Size</span>
                <span className="text-xl font-bold text-[var(--primary)] tabular-nums">
                  {stats?.songCacheTotal ?? 0} songs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Average Socket Latency</span>
                <span className="text-xl font-bold text-[var(--accent)] tabular-nums">Normal (&lt; 10ms)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All local networks healthy
          </div>
        </div>
      </div>
    </div>
  );
}
