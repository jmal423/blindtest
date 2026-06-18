'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { getMe } from '@/lib/api';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    label: 'Catalog & Content',
    items: [
      { href: '/admin/catalog/library', label: 'Library', icon: '💾' },
      { href: '/admin/catalog/triage', label: 'Triage', icon: '🔍' },
      { href: '/admin/catalog/curated', label: 'Curated', icon: '✨' },
      { href: '/admin/catalog/flags', label: 'Reports', icon: '🚩' },
    ],
  },
  {
    label: 'Game Operations',
    items: [
      { href: '/admin/game/rooms', label: 'Rooms', icon: '🎮' },
      { href: '/admin/game/leaderboard', label: 'Leaderboard', icon: '🏆' },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/users', label: 'Users', icon: '👥' },
    ],
  },
  {
    label: 'System & Developer',
    items: [
      { href: '/admin/system/metrics', label: 'Metrics', icon: '📈' },
      { href: '/admin/system/api-tester', label: 'API Tester', icon: '⚡' },
    ],
  },
];

function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ${
        open ? 'w-64' : 'w-20'
      } hidden md:flex`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)',
      }}
    >
      <div className="h-16 flex items-center px-6" style={{ borderBottom: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
        <div className={`flex items-center gap-3 ${!open && 'justify-center w-full'}`}>
          <span className="text-xl">🎵</span>
          {open && (
            <span className="font-bold text-sm tracking-wide" style={{ background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BlindTest Admin
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {open && (
              <p className="px-4 mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-foreground/30">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                      active ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/60'
                    }`}
                    style={active ? { backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' } : {}}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl"
                        style={{ border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="text-base relative z-10">{item.icon}</span>
                    {open && <span className="relative z-10 text-xs font-extrabold uppercase tracking-wider">{item.label}</span>}
                    {!open && (
                      <div className="absolute left-full ml-4 px-2 py-1 rounded text-xs text-foreground opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                        style={{ backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
                      >
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-xl transition-colors text-foreground/40 hover:text-foreground cursor-pointer text-xs font-extrabold uppercase tracking-wider"
          style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)' }}
        >
          {open ? '◀ Collapse' : '▶'}
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const pageTitles: Record<string, string> = {
    '/admin': 'Overview',
    '/admin/catalog/library': 'Library',
    '/admin/catalog/triage': 'Triage',
    '/admin/catalog/curated': 'Curated',
    '/admin/catalog/flags': 'Reports',
    '/admin/game/rooms': 'Rooms',
    '/admin/game/leaderboard': 'Leaderboard',
    '/admin/users': 'Users',
    '/admin/system/metrics': 'Metrics',
    '/admin/system/api-tester': 'API Tester',
  };

  const currentPage = Object.keys(pageTitles).find(p => {
    if (p === pathname) return true;
    if (pathname.startsWith(p) && p !== '/admin') return true;
    return false;
  }) || '/admin';

  const pageTitle = pageTitles[currentPage] || 'Admin';

  return (
    <div className="flex-1 flex min-h-0" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'} transition-all duration-300 min-w-0`}>
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
              {pageTitle}
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

        {/* Mobile bottom tabs */}
        <div className="flex md:hidden p-2 gap-1 overflow-x-auto scrollbar-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}
        >
          {NAV_GROUPS.flatMap(g => g.items).map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active ? 'text-[var(--background)]' : 'text-foreground/40 hover:text-foreground/60'
                }`}
                style={active ? { backgroundColor: 'var(--primary)' } : {}}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <main className="flex-1 overflow-y-auto min-h-0 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          <div key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
