'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getMe, getToken } from '@/lib/api';
import { isDiscordEmbedded, authenticateDiscordActivity } from '@/lib/discordActivity';

export interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (isDiscordEmbedded()) {
        setLoading(true);
        const result = await Promise.race([
          authenticateDiscordActivity(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
        ]);
        if (cancelled) return;
        if (result) {
          localStorage.setItem('blindtest_token', result.token);
          try {
            const u = await getMe();
            setUser(u);
          } catch {
            setUser(null);
          }
          setLoading(false);
          return;
        }
      }

      await refresh();
    }

    init();
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        if (!getToken()) {
          setUser(null);
        }
      }
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const signOut = () => {
    localStorage.removeItem('blindtest_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
