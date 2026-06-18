'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMe,
  getMyScores,
  getFriends,
  getMyStats,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  searchUsers
} from '@/lib/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/lib/useTranslation';

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [user, setUser] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'friends' | 'history'>('overview');
  const [friendsSearch, setFriendsSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadProfileData = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      localStorage.removeItem('blindtest_token');
      router.push('/login');
      return;
    }

    try {
      const s = await getMyScores();
      setScores(s);
    } catch (err) {
      console.error('Failed to load scores:', err);
    }
    try {
      const st = await getMyStats();
      setStats(st);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
    try {
      const fr = await getFriends();
      setFriends(fr.friends || []);
      setPending(fr.pending || []);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('blindtest_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadProfileData();
  }, [router, loadProfileData]);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    if (!friendInput.trim()) return;
    setFriendError('');
    setFriendSuccess('');
    try {
      await sendFriendRequest(friendInput.trim());
      setFriendSuccess('Friend request sent!');
      setFriendInput('');
      const d = await getFriends();
      setFriends(d.friends || []);
      setPending(d.pending || []);
    } catch (err: any) {
      setFriendError(err.message || 'Failed to send request');
    }
  };

  useEffect(() => {
    const query = friendInput.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const matches = await searchUsers(query);
        setSearchResults(matches);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [friendInput]);

  const handleAddFriendFromSearch = async (userId: string) => {
    setFriendError('');
    setFriendSuccess('');
    try {
      await sendFriendRequest(userId);
      setFriendSuccess('Friend request sent!');
      setSearchResults(prev =>
        prev.map(item =>
          item.id === userId
            ? { ...item, status: 'pending', friendship_sender: user.id }
            : item
        )
      );
      const d = await getFriends();
      setFriends(d.friends || []);
      setPending(d.pending || []);
    } catch (err: any) {
      setFriendError(err.message || 'Failed to send request');
    }
  };

  const handleAcceptFromSearch = async (userId: string) => {
    try {
      await acceptFriendRequest(userId);
      setSearchResults(prev =>
        prev.map(item =>
          item.id === userId
            ? { ...item, status: 'accepted' }
            : item
        )
      );
      const d = await getFriends();
      setFriends(d.friends || []);
      setPending(d.pending || []);
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await acceptFriendRequest(id);
      const d = await getFriends();
      setFriends(d.friends || []);
      setPending(d.pending || []);
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeFriend(id);
      const d = await getFriends();
      setFriends(d.friends || []);
      setPending(d.pending || []);
    } catch (err) {
      console.error('Failed to remove/decline friend:', err);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-4 border-surface-light border-t-[var(--primary)] rounded-full"
        />
      </div>
    );
  }

  // Filter current friends by search term
  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(friendsSearch.toLowerCase())
  );

  // Calculate some custom performance statistics
  const perfectRatio = stats?.totalRounds ? ((stats.perfects / stats.totalRounds) * 100).toFixed(1) : '0.0';
  const averagePointsPerGame = stats?.gamesPlayed ? Math.round(stats.totalPoints / stats.gamesPlayed) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground flex flex-col items-center py-6 px-4 md:py-10">
      <div className="max-w-4xl w-full flex flex-col gap-6 md:gap-8">
        
        {/* Profile Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center gap-6"
        >
          {/* Glowing backlights */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-[var(--primary)]/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[var(--accent)]/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Avatar wrapper */}
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] opacity-40 blur group-hover:opacity-70 transition-all duration-300" />
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface flex items-center justify-center text-4xl font-extrabold text-[var(--primary)] overflow-hidden border-2 border-white/10 shadow-lg">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                user.username[0].toUpperCase()
              )}
            </div>
          </div>

          {/* User Meta */}
          <div className="flex-1 text-center sm:text-left space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 justify-center sm:justify-start">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">{user.username}</h1>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                  {user.role === 'admin' && (
                  <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md font-bold tracking-wider uppercase">
                    {t('admin_role')}
                  </span>
                )}
                <span className="text-[10px] bg-white/5 border border-white/10 text-foreground/60 px-2 py-0.5 rounded-md font-semibold tracking-wider">
                  {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>

            {/* Click to Copy ID Badge */}
            <div className="flex justify-center sm:justify-start">
              <button 
                onClick={handleCopyId}
                className="group flex items-center gap-2 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-xl text-foreground/60 hover:text-foreground transition-all cursor-pointer text-xs"
              >
                <span className="font-mono text-[11px] select-all">{t('user_id_label', { id: user.id })}</span>
                <div className="w-4 h-4 flex items-center justify-center text-[var(--primary)] group-hover:scale-110 transition-transform">
                  {copied ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-foreground/60 group-hover:text-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  )}
                </div>
                {copied && <span className="text-[10px] text-green-400 font-semibold">{t('copied_label')}</span>}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Custom Glassmorphism Tabs Navigation */}
        <div className="flex border-b border-white/5 p-1 gap-2 bg-white/[0.01] border rounded-2xl border-white/5 shadow-inner">
          {(['overview', 'friends', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex-1 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'text-foreground' 
                  : 'text-foreground/40 hover:text-foreground/80'
              }`}
            >
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-white/[0.03] border border-white/10 rounded-xl"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="capitalize">{tab === 'overview' ? t('tab_overview') : tab === 'history' ? t('tab_history') : t('friends_title')}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Panels with transitions */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Total Points */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-md">
                      <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a4 4 0 0 0 4-4V5H8v6a4 4 0 0 0 4 4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v4m0 0H9m3 0h3M4 11h4M16 11h4" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">{stats?.totalPoints ?? 0}</p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('total_points')}</p>
                    </div>
                  </div>

                  {/* Games Played */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-md">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="2" y="6" width="20" height="12" rx="3" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4M8 10v4M16 11h.01M18 13h.01" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">{stats?.gamesPlayed ?? 0}</p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('games_played_label')}</p>
                    </div>
                  </div>

                  {/* Best Score */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-md">
                      <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.246.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.97-2.883a1 1 0 00-1.176 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.772-.564-.373-1.81.588-1.81h4.907a1 1 0 00.95-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">{stats?.bestScore ?? 0}</p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('best_score_label')}</p>
                    </div>
                  </div>

                  {/* Avg Speed */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shadow-md">
                      <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
                        {stats?.averageSpeedMs != null ? `${(stats.averageSpeedMs / 1000).toFixed(2)}s` : 'N/A'}
                      </p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('avg_answer_speed')}</p>
                    </div>
                  </div>

                  {/* Best Genre */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-md">
                      <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 10l12-3" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-lg font-black text-foreground tracking-tight truncate capitalize">{stats?.bestGenre ? stats.bestGenre.replace(/_/g, ' ') : 'None'}</p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('best_genre')}</p>
                    </div>
                  </div>

                  {/* Perfect Rounds */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-5 shadow-lg flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/10 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-md">
                      <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">{stats?.perfects ?? 0}</p>
                      <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">{t('perfect_guesses_label')}</p>
                    </div>
                  </div>
                </div>

                {/* Extended Insights Card */}
                <div className="bg-gradient-to-br from-white/[0.02] to-transparent border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary)]/5 rounded-full blur-2xl" />
                  <h3 className="text-sm font-bold text-foreground/90 mb-4 tracking-wider uppercase">{t('performance_summary')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-foreground/60">
                        <span>Perfect Guess Rate</span>
                        <span className="font-bold text-foreground">{perfectRatio}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, parseFloat(perfectRatio))}%` }}
                          className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] h-full"
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-[10px] text-foreground/40 font-medium">Percentage of rounds where you guessed both Artist and Title.</p>
                    </div>

                    <div className="flex justify-between items-center bg-black/10 border border-white/5 rounded-2xl p-4">
                      <div>
                        <p className="text-foreground/60 text-xs font-semibold">Avg Score per Game</p>
                        <p className="text-[10px] text-foreground/40 font-medium mt-1">Average points accumulated per complete lobby match.</p>
                      </div>
                      <p className="text-2xl font-black text-[var(--accent)] tabular-nums">{averagePointsPerGame} <span className="text-[10px] text-foreground/40 font-bold">pts</span></p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Search & Add Friend Block */}
                <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-foreground/90 tracking-wider uppercase">Add New Friend</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={friendInput}
                      onChange={e => setFriendInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                      placeholder="Search users by name or ID..."
                      className="flex-1 px-4 py-3 bg-black/20 border border-white/5 hover:border-white/10 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30 rounded-2xl text-foreground placeholder-foreground/40 focus:outline-none transition-all text-sm"
                    />
                    <button 
                      onClick={handleAddFriend} 
                      className="px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-foreground rounded-2xl text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      {t('add_btn')}
                    </button>
                  </div>

                  {/* Autocomplete Search Results */}
                  <AnimatePresence>
                    {(searchLoading || searchResults.length > 0 || (friendInput.trim().length >= 2 && !searchLoading)) && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/5 pt-4 space-y-2 overflow-hidden"
                      >
                        <h4 className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">Search Results</h4>
                        
                        {searchLoading ? (
                          <div className="flex items-center gap-2 py-4 px-2 text-xs text-foreground/40">
                            <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                            Searching users...
                          </div>
                        ) : searchResults.length === 0 ? (
                          <p className="text-xs text-foreground/30 py-3 px-1">No matching users found.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {searchResults.map(result => {
                              const isFriend = result.status === 'accepted';
                              const isPendingSent = result.status === 'pending' && result.friendship_sender === user.id;
                              const isPendingReceived = result.status === 'pending' && result.friendship_sender !== user.id;

                              return (
                                <div key={result.id} className="flex items-center justify-between p-3 bg-black/20 hover:bg-black/30 border border-white/5 rounded-2xl shadow-sm transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold border border-white/10 overflow-hidden shrink-0">
                                      {result.avatar_url ? (
                                        <img src={result.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                      ) : (
                                        result.username[0].toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs text-foreground/90 truncate">{result.username}</p>
                                      <p className="text-[9px] text-foreground/40">ID: {result.id}</p>
                                    </div>
                                  </div>

                                  <div>
                                    {isFriend ? (
                                      <span className="text-[10px] text-foreground/60 bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-xl font-bold">
                                        Friends
                                      </span>
                                    ) : isPendingSent ? (
                                      <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-2.5 py-1.5 rounded-xl font-bold">
                                        Pending
                                      </span>
                                    ) : isPendingReceived ? (
                                      <button
                                        onClick={() => handleAcceptFromSearch(result.id)}
                                        className="px-3.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                      >
                                        Accept Request
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleAddFriendFromSearch(result.id)}
                                        className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-foreground rounded-xl text-[10px] font-bold shadow transition-all cursor-pointer"
                                      >
                                        Add Friend
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Status Badges */}
                  <AnimatePresence>
                    {friendError && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }}
                        className="text-red-400 text-xs font-semibold bg-red-500/5 border border-red-500/10 px-4 py-2.5 rounded-xl flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {friendError}
                      </motion.p>
                    )}
                    {friendSuccess && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }}
                        className="text-green-400 text-xs font-semibold bg-green-500/5 border border-green-500/10 px-4 py-2.5 rounded-xl flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {friendSuccess}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pending Invites */}
                {pending.length > 0 && (
                  <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 shadow-xl space-y-3">
                    <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-widest">{t('pending_requests')} ({pending.length})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {pending.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold border border-white/10 overflow-hidden">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.username[0].toUpperCase()
                              )}
                            </div>
                            <span className="font-bold text-sm text-foreground/90">{p.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleAccept(p.id)} 
                              className="px-3.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              {t('accept_btn')}
                            </button>
                            <button 
                              onClick={() => handleRemove(p.id)} 
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Friends list */}
                <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground/90 tracking-wider uppercase">Friends List ({friends.length})</h3>
                    {friends.length > 0 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={friendsSearch}
                          onChange={e => setFriendsSearch(e.target.value)}
                          placeholder="Search friends..."
                          className="w-full sm:w-60 pl-8 pr-4 py-1.5 bg-black/20 border border-white/5 focus:border-[var(--primary)] focus:outline-none rounded-xl text-xs text-foreground placeholder-foreground/30 transition-colors"
                        />
                        <svg className="w-3.5 h-3.5 text-foreground/30 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {filteredFriends.map(f => {
                      const presence = f.presence || { status: 'offline', roomCode: null };
                      let statusDot = 'bg-foreground/30';
                      let statusText = 'Offline';
                      
                      if (presence.status === 'lobby') {
                        statusDot = 'bg-emerald-500 animate-pulse';
                        statusText = `In Lobby (${presence.roomCode})`;
                      } else if (presence.status === 'playing') {
                        statusDot = 'bg-purple-500';
                        statusText = 'In Game';
                      }

                      return (
                        <div key={f.id} className="group flex items-center justify-between p-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-2xl transition-all shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center font-bold border border-white/10 overflow-hidden relative shadow-inner">
                                {f.avatar_url ? (
                                  <img src={f.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                ) : (
                                  f.username[0].toUpperCase()
                                )}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d0e12] ${statusDot}`} title={statusText} />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-foreground/90">{f.username}</span>
                                {presence.status === 'lobby' && (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold">
                                    Lobby
                                  </span>
                                )}
                                {presence.status === 'playing' && (
                                  <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-semibold">
                                    In Game
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-foreground/20">ID: {f.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {presence.status === 'lobby' && presence.roomCode && (
                              <Link 
                                href={`/game/${presence.roomCode}`}
                                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                Join
                              </Link>
                            )}
                            <button 
                              onClick={() => handleRemove(f.id)} 
                              className="opacity-40 group-hover:opacity-100 text-red-400/80 hover:text-red-400 text-xs font-bold transition-all border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-2.5 py-1.5 rounded-xl cursor-pointer"
                            >
                              {t('remove_btn')}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredFriends.length === 0 && (
                      <div className="col-span-2 py-12 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-foreground/40">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <p className="text-foreground/30 text-xs">
                          {friends.length === 0 
                            ? 'No friends added yet. Type a username or ID above to send a request!'
                            : 'No friends found matching that search.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Recent Games Panel */}
                <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-foreground/90 tracking-wider uppercase">{t('recent_games')}</h3>
                  <div className="space-y-3">
                    {scores.map(s => {
                      const maxScore = s.total_rounds * 100;
                      const scoreRatio = s.score / maxScore;
                      let performanceLabel = 'Novice';
                      let performanceColor = 'text-foreground/60 bg-foreground/10 border-foreground/10';

                      if (scoreRatio >= 0.8) {
                        performanceLabel = 'Grandmaster';
                        performanceColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                      } else if (scoreRatio >= 0.6) {
                        performanceLabel = 'Expert';
                        performanceColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                      } else if (scoreRatio >= 0.3) {
                        performanceLabel = 'Adept';
                        performanceColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
                      }

                      return (
                        <div 
                          key={s.id} 
                          className="flex items-center justify-between p-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-2xl transition-all shadow-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-foreground/90">{t('room_game_prefix')} {s.game_code}</p>
                              <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-md uppercase tracking-wider ${performanceColor}`}>
                                {performanceLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-foreground/40 font-medium">
                              {new Date(s.played_at).toLocaleDateString(undefined, { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-base font-extrabold text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-3.5 py-1.5 rounded-xl tabular-nums">
                              {s.score} <span className="text-[10px] text-foreground/40 font-bold">/ {maxScore}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {scores.length === 0 && (
                      <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-foreground/40">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-foreground/30 text-xs">{t('no_games_yet')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Back navigation footer link */}
        <Link 
          href="/" 
          className="text-xs text-foreground/30 hover:text-foreground/80 text-center transition-colors font-semibold self-center flex items-center gap-2 cursor-pointer pt-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('back_home')}
        </Link>
      </div>
    </div>
  );
}
