'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, getDiscordAuthUrl } from '@/lib/api';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err) {
      setError(decodeURIComponent(err));
      return;
    }

    if (token) {
      localStorage.setItem('blindtest_token', token);
      getMe().then(setUser).catch(() => {
        localStorage.removeItem('blindtest_token');
      });
      return;
    }

    const existing = localStorage.getItem('blindtest_token');
    if (existing) {
      getMe().then(setUser).catch(() => {
        localStorage.removeItem('blindtest_token');
      });
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('blindtest_token');
    setUser(null);
    router.push('/');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-3xl font-bold">Account</h1>

      {error && (
        <div className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-center max-w-sm">
          {error}
        </div>
      )}

      {user ? (
        <div className="flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-[var(--surface)] flex items-center justify-center text-3xl font-bold text-[var(--primary)] overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              user.username[0].toUpperCase()
            )}
          </div>
          <p className="text-xl font-semibold">{user.username}</p>
          {user.role === 'admin' && (
            <span className="px-3 py-1 bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-medium rounded-full">Admin</span>
          )}

          <div className="w-full flex flex-col gap-2 mt-4">
            <Link href="/profile" className="w-full px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-light)] rounded-xl text-center transition-colors">
              My Profile
            </Link>
            <Link href="/leaderboard" className="w-full px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-light)] rounded-xl text-center transition-colors">
              Leaderboard
            </Link>
            {user.role === 'admin' && (
              <Link href="/admin" className="w-full px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-light)] rounded-xl text-center transition-colors">
                Admin Panel
              </Link>
            )}
            <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors">
              Logout
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <a
            href={getDiscordAuthUrl()}
            className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-xl transition-colors flex items-center gap-3"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
            </svg>
            Login with Discord
          </a>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Back Home
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-zinc-400">Loading...</p></div>}>
      <LoginContent />
    </Suspense>
  );
}
