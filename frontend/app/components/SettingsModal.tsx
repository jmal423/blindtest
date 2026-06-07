'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '@/app/context/SettingsContext';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <SettingsPanel onClose={onClose} />
        </div>
      )}
    </AnimatePresence>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSettings();

  const testAudio = () => {
    new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=').play().catch(() => {});
  };

  const inner = (
    <>
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <h2 className="text-lg font-bold">Settings</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-6">
        <div>
          <p className="text-sm font-semibold mb-3 text-zinc-200 uppercase tracking-wider text-[11px]">Audio</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Master Volume: {Math.round(settings.masterVolume * 100)}%</label>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={settings.masterVolume}
                onChange={e => updateSettings({ masterVolume: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">SFX Volume: {Math.round(settings.sfxVolume * 100)}%</label>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={settings.sfxVolume}
                onChange={e => updateSettings({ sfxVolume: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </div>
            <button
              onClick={testAudio}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-sm text-white rounded-lg transition-colors"
            >
              Test Audio
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-3 text-zinc-200 uppercase tracking-wider text-[11px]">Theme</p>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ theme: 'dark' })}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                settings.theme === 'dark'
                  ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/50'
                  : 'bg-white/10 text-zinc-400 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Dark
              </div>
            </button>
            <button
              onClick={() => updateSettings({ theme: 'light' })}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                settings.theme === 'light'
                  ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/50'
                  : 'bg-white/10 text-zinc-400 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                Light
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (settings.reducedMotion) {
    return (
      <div className="relative w-full max-w-md bg-[var(--surface)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative w-full max-w-md bg-[var(--surface)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      {inner}
    </motion.div>
  );
}
