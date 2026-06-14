'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { getMe } from '@/lib/api';

import { SystemTab } from './tabs/SystemTab';
import { UsersTab } from './tabs/UsersTab';
import { RoomsTab } from './tabs/RoomsTab';
import { LeaderboardTab } from './tabs/LeaderboardTab';
import { MusicTab } from './tabs/MusicTab';
import { CuratedTab } from './tabs/CuratedTab';
import { AiTab } from './tabs/AiTab';
import { ApiTab } from './tabs/ApiTab';

type Tab = 'system' | 'users' | 'rooms' | 'leaderboard' | 'music' | 'curated' | 'ai' | 'api';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'system', label: 'System', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'rooms', label: 'Rooms', icon: '🎮' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'music', label: 'Music Cache', icon: '💾' },
  { id: 'curated', label: 'Curated', icon: '✨' },
  { id: 'ai', label: 'AI Tags', icon: '🧠' },
  { id: 'api', label: 'API & Tester', icon: '⚡' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) {
      router.push('/login');
      return;
    }

    getMe()
      .then(u => {
        if (u.role !== 'admin') {
          router.push('/');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        localStorage.removeItem('blindtest_token');
        router.push('/login');
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, [router]);

  if (loadingUser) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-foreground/40 text-sm animate-pulse">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex-1 flex min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } hidden md:flex`}
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', backdropFilter: 'blur(24px)', borderRight: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}
      >
        <div className="h-16 flex items-center justify-between px-6" style={{ borderBottom: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <span className="text-xl">🎵</span>
            {sidebarOpen && (
              <span className="font-bold text-sm tracking-wide" style={{ background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                BlindTest Admin
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative group ${
                  isActive ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/60'
                }`}
                style={isActive ? { backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' } : {}}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl"
                    style={{ border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="text-base relative z-10">{tab.icon}</span>
                {sidebarOpen && <span className="relative z-10 text-xs font-extrabold uppercase tracking-wider">{tab.label}</span>}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 rounded text-xs text-foreground opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
                  >
                    {tab.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-xl transition-colors text-foreground/40 hover:text-foreground cursor-pointer text-xs font-extrabold uppercase tracking-wider"
            style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'} transition-all duration-300 min-w-0`}>
        <header className="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
          style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg text-foreground/40 cursor-pointer"
              style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
            >
              ☰
            </button>
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-foreground">
              {tabs.find(t => t.id === activeTab)?.label}
              <span className="text-foreground/30 font-bold ml-1.5">Dashboard</span>
            </h2>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-foreground/40 hover:text-foreground transition-all cursor-pointer"
            style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
          >
            ← Back
          </button>
        </header>

        <div className="flex md:hidden p-2 gap-1 overflow-x-auto scrollbar-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id ? 'text-[var(--background)]' : 'text-foreground/40 hover:text-foreground/60'
              }`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--primary)' } : {}}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
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
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
