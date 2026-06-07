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
          <p className="text-sm font-semibold mb-3 text-zinc-200 uppercase tracking-wider text-[11px]">Accessibility</p>
          <div className="space-y-4">
            <ToggleRow
              label="Auto-Focus Input"
              description="Automatically focus the guess input when a new round starts"
              checked={settings.autoFocusInput}
              onChange={v => updateSettings({ autoFocusInput: v })}
            />
            <ToggleRow
              label="Reduced Motion"
              description="Disable animations and transitions"
              checked={settings.reducedMotion}
              onChange={v => updateSettings({ reducedMotion: v })}
            />
            <ToggleRow
              label="Colorblind Mode"
              description="Use high-contrast indicators instead of color-only"
              checked={settings.colorblindMode}
              onChange={v => updateSettings({ colorblindMode: v })}
            />
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

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-zinc-200">{label}</p>
        <p className="text-[11px] text-zinc-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[var(--primary)]' : 'bg-zinc-600'}`}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        />
      </button>
    </div>
  );
}
