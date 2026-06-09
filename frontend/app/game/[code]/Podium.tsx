'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';

interface PodiumEntry {
  rank: number;
  name: string;
  avatarUrl?: string | null;
  score: number;
  xp: number;
  answers?: any[];
}

interface PodiumProps {
  rankings: PodiumEntry[];
  playerId: string;
  code: string;
  onPlayAgain: () => void;
}

export default function Podium({ rankings, playerId, code, onPlayAgain }: PodiumProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <div className="flex-1 flex flex-col items-center gap-8 py-8 px-4">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold"
      >
        {t('game_over')}
      </motion.h2>

      <div className="flex items-end gap-4">
        {top3.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center gap-2"
          >
            {top3[1].avatarUrl ? (
              <img src={top3[1].avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover shadow-lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-b from-zinc-300 to-zinc-500 flex items-center justify-center text-2xl font-bold shadow-lg">
                {[...top3[1].name][0]}
              </div>
            )}
            <p className="text-sm font-semibold text-zinc-300">{top3[1].name}</p>
            <p className="text-xs text-zinc-500">{top3[1].score} pts</p>
            <div className="w-20 h-24 bg-gradient-to-t from-zinc-400 to-zinc-300 rounded-t-xl flex items-center justify-center shadow-md">
              <span className="text-3xl font-black text-zinc-700">2</span>
            </div>
          </motion.div>
        )}

        {top3.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col items-center gap-2"
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="text-3xl"
            >
              👑
            </motion.div>
            {top3[0].avatarUrl ? (
              <img src={top3[0].avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-yellow-300/50" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-500 flex items-center justify-center text-2xl font-bold shadow-lg ring-2 ring-yellow-300/50">
                {[...top3[0].name][0]}
              </div>
            )}
            <p className="text-base font-bold text-yellow-300">{top3[0].name}</p>
            <p className="text-sm text-yellow-400/80">{top3[0].score} pts</p>
            <div className="w-24 h-32 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-xl flex items-center justify-center shadow-xl">
              <span className="text-4xl font-black text-yellow-800">1</span>
            </div>
          </motion.div>
        )}

        {top3.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center gap-2"
          >
            {top3[2].avatarUrl ? (
              <img src={top3[2].avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover shadow-lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-b from-amber-600 to-amber-800 flex items-center justify-center text-xl font-bold shadow-lg">
                {[...top3[2].name][0]}
              </div>
            )}
            <p className="text-sm font-semibold text-amber-600">{top3[2].name}</p>
            <p className="text-xs text-amber-600/70">{top3[2].score} pts</p>
            <div className="w-16 h-20 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-xl flex items-center justify-center shadow-md">
              <span className="text-2xl font-black text-amber-900">3</span>
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        <p className="text-xs text-zinc-500 uppercase tracking-wider text-center">{t('xp_earned')}</p>
        {rankings.map(r => {
          const baseXp = r.score * 10;
          const placementXp = r.rank === 1 ? 500 : r.rank === 2 ? 250 : 0;
          return (
            <div
              key={r.rank}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                r.rank <= 3
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-[var(--surface)]'
              } ${r.rank === 1 ? 'ring-1 ring-yellow-500/30' : ''}`}
            >
              <span className="text-lg font-bold text-zinc-500 w-6 text-center">
                {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.name}</p>
                <p className="text-[11px] text-zinc-500">
                  {baseXp} {t('base_xp')} {placementXp > 0 ? `+ ${placementXp} ${t('placement_xp')}` : ''}
                </p>
              </div>
              <span className="text-sm font-bold text-[var(--accent)]">{r.xp} {t('xp_label')}</span>
            </div>
          );
        })}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        onClick={onPlayAgain}
        className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl transition-colors"
      >
        {t('play_again')}
      </motion.button>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        onClick={() => router.push('/')}
        className="px-8 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 font-medium rounded-xl transition-colors"
      >
        {t('main_menu')}
      </motion.button>
    </div>
  );
}
