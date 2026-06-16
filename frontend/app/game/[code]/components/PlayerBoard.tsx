'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { Player } from '@/lib/api';

interface PlayerBoardProps {
  players: Player[];
  playerId: string;
  hostId?: string | null;
}

function PlayerCard({ player, isMe, isHost }: { player: Player; isMe: boolean; isHost: boolean }) {
  const hasFoundArtist = player.foundArtist || player.foundBoth;
  const hasFoundTitle = player.foundTitle || player.foundBoth;
  const hasFoundBoth = player.foundBoth;

  const statusBorder = hasFoundBoth
    ? 'border-emerald-400 shadow-[0_0_8px_#34d399]'
    : hasFoundArtist || hasFoundTitle
      ? 'border-accent/40'
      : 'border-white/10';

  const meBorder = isMe ? 'border-l-2 border-l-accent' : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl border ${statusBorder} ${meBorder} bg-surface/60 backdrop-blur-sm`}
    >
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs md:text-sm font-bold text-primary shrink-0 overflow-hidden">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        ) : (
          player.name?.charAt(0).toUpperCase() || '?'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs md:text-sm font-semibold text-foreground truncate">
            {player.name}
          </span>
          {isMe && (
            <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold leading-none">
              YOU
            </span>
          )}
          {isHost && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold leading-none">
              HOST
            </span>
          )}
        </div>
      </div>
      <span className="text-xs md:text-sm font-mono font-bold text-primary shrink-0">
        {player.score.toLocaleString()}
      </span>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          backgroundColor: hasFoundBoth
            ? '#34d399'
            : hasFoundArtist || hasFoundTitle
              ? 'var(--accent)'
              : '#a1a1aa',
        }}
      />
    </motion.div>
  );
}

export default function PlayerBoard({ players, playerId, hostId }: PlayerBoardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <aside className="w-72 lg:w-80 xl:w-96 shrink-0 flex flex-col border-r border-white/10 bg-black/30">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
          Players
        </h2>
        <span className="text-xs text-white/30 font-mono">{players.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {sorted.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === playerId}
              isHost={player.id === hostId}
            />
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
