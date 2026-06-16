'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMe, getDiscordAuthUrl } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'motion/react';

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
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative backdrop glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[var(--primary)]/10 blur-[80px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-sm bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl relative"
      >
        <h1 className="text-xl font-black text-foreground uppercase tracking-wider text-center">
          Account
        </h1>

        {error && (
          <div className="w-full px-4 py-2.5 bg-red-500/5 border border-red-500/10 text-red-400 text-xs font-semibold rounded-xl text-center">
            {error}
          </div>
        )}

        {user ? (
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-surface-light flex items-center justify-center text-3xl font-black text-foreground overflow-hidden border-2 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/20">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  user.username[0].toUpperCase()
                )}
              </div>
              {user.role === 'admin' && (
                <span className="absolute -bottom-1 -right-1 bg-[#00cec9] text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-foreground border border-background shadow">
                  Admin
                </span>
              )}
            </div>

            <p className="text-lg font-black text-foreground">{user.username}</p>

            <div className="w-full flex flex-col gap-2 pt-2 border-t border-white/5">
              <Link href="/profile" className="w-full px-4 py-3 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-foreground/80 hover:text-foreground rounded-xl text-center text-xs font-bold transition-all cursor-pointer">
                My Profile
              </Link>
              <Link href="/leaderboard" className="w-full px-4 py-3 bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-foreground/80 hover:text-foreground rounded-xl text-center text-xs font-bold transition-all cursor-pointer">
                Leaderboard
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="w-full px-4 py-3 bg-[#00cec9]/5 border border-[#00cec9]/15 hover:bg-[#00cec9]/15 hover:border-[#00cec9]/25 text-[#00cec9] rounded-xl text-center text-xs font-bold transition-all cursor-pointer">
                  Admin Panel
                </Link>
              )}
              <div className="h-px bg-white/5 my-1" />
              <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/15 text-red-400 hover:text-red-350 rounded-xl text-xs font-bold transition-all cursor-pointer">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full pt-2">
            <a
              href={getDiscordAuthUrl()}
              className="w-full py-3.5 bg-[var(--discord)] hover:brightness-90 text-foreground font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer border border-transparent hover:border-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
              Login with Discord
            </a>
            <Link href="/" className="text-xs text-foreground/40 hover:text-foreground/80 transition-all font-bold uppercase tracking-wider mt-2">
              Back Home
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-foreground/60">Loading...</p></div>}>
      <LoginContent />
    </Suspense>
  );
}
