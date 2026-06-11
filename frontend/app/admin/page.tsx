'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { getMe } from '@/lib/api';

// Dynamic tabs
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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#07070f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
          <p className="text-zinc-500 text-sm animate-pulse">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex-1 flex min-h-screen bg-[#07070f] text-foreground font-sans selection:bg-[var(--primary)]/30 selection:text-white">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-surface/30 backdrop-blur-xl border-r border-white/5 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } hidden md:flex`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <span className="text-2xl">🎵</span>
            {sidebarOpen && (
              <span className="font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent tracking-wide">
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
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="text-lg relative z-10">{tab.icon}</span>
                {sidebarOpen && <span className="relative z-10">{tab.label}</span>}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-surface border border-white/10 rounded text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {tab.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? '◀ Collapse' : '▶'}
          </button>
        </div>
      </aside>

      {/* Main Panel Wrapper */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'} transition-all duration-300 min-w-0`}>
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-surface/10 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 md:hidden"
            >
              ☰
            </button>
            <h2 className="font-bold text-lg text-white">
              {tabs.find(t => t.id === activeTab)?.label} Dashboard
            </h2>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
          >
            ← Back to Game
          </button>
        </header>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden bg-surface/30 backdrop-blur-xl border-b border-white/5 p-2 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id ? 'bg-[var(--primary)] text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content area */}
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
