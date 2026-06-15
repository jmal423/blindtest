'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', destructive = true }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{destructive ? '⚠️' : '🗑️'}</span>
          <div>
            <p className="font-bold text-sm text-foreground/90">{title}</p>
            <p className="text-xs text-foreground/50 mt-0.5">{message}</p>
          </div>
        </div>
        <p className="text-xs text-foreground/40">Type <strong className="text-foreground/70">DELETE</strong> to confirm:</p>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="Type DELETE"
          className="w-full px-3 py-2 rounded-xl text-sm bg-surface border border-white/10 text-foreground placeholder-foreground/30 focus:outline-none focus:border-red-500/50 transition-all"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setTyped(''); onClose(); }}
            className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors text-foreground/40 hover:text-foreground cursor-pointer"
            style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (typed === 'DELETE') { setTyped(''); onConfirm(); } }}
            disabled={typed !== 'DELETE'}
            className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              destructive ? 'text-red-400' : 'text-foreground'
            }`}
            style={{ backgroundColor: destructive ? 'color-mix(in srgb, #ef4444 15%, transparent)' : 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
