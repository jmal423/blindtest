'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '@/app/context/SettingsContext';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
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
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = settings.masterVolume * 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const resetDefaults = () => {
    updateSettings({
      masterVolume: 1,
      sfxVolume: 0.8,
      autoFocusInput: true,
      reducedMotion: false,
      colorblindMode: false,
      theme: 'dark',
    });
  };

  const toggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const inner = (
    <>
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <h2 className="text-lg font-bold">Settings</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-6 max-h-[65vh] overflow-y-auto">
        {/* Audio */}
        <section>
          <h3 className="text-xs font-semibold mb-3 text-zinc-400 uppercase tracking-wider">Audio</h3>
          <div className="space-y-4">
            <SliderRow
              label="Master Volume"
              value={settings.masterVolume}
              onChange={v => updateSettings({ masterVolume: v })}
              min={0} max={1} step={0.05}
              format={v => Math.round(v * 100) + '%'}
            />
            <SliderRow
              label="Sound Effects"
              value={settings.sfxVolume}
              onChange={v => updateSettings({ sfxVolume: v })}
              min={0} max={1} step={0.05}
              format={v => Math.round(v * 100) + '%'}
            />
            <button
              onClick={testAudio}
              className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-sm text-white rounded-xl border border-white/10 transition-colors"
            >
              Test Audio
            </button>
          </div>
        </section>

        {/* Gameplay */}
        <section>
          <h3 className="text-xs font-semibold mb-3 text-zinc-400 uppercase tracking-wider">Gameplay</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Auto-focus input"
              description="Automatically focus the guess bar when a round starts"
              value={settings.autoFocusInput}
              onChange={() => toggle('autoFocusInput')}
            />
          </div>
        </section>

        {/* Accessibility */}
        <section>
          <h3 className="text-xs font-semibold mb-3 text-zinc-400 uppercase tracking-wider">Accessibility</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Reduced motion"
              description="Disable animations and transitions"
              value={settings.reducedMotion}
              onChange={() => toggle('reducedMotion')}
            />
            <ToggleRow
              label="Colorblind mode"
              description="Use high-contrast patterns instead of colors"
              value={settings.colorblindMode}
              onChange={() => toggle('colorblindMode')}
            />
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="text-xs font-semibold mb-3 text-zinc-400 uppercase tracking-wider">Appearance</h3>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => updateSettings({ theme: t })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize ${
                  settings.theme === t
                    ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/50'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
                }`}
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
        </section>

        {/* Reset */}
        <button
          onClick={resetDefaults}
          className="w-full px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </>
  );

  if (settings.reducedMotion) {
    return (
      <div className="relative w-full max-w-md mx-4 sm:mx-0 bg-[var(--surface)] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative w-full max-w-md mx-4 sm:mx-0 bg-[var(--surface)] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
    >
      {inner}
    </motion.div>
  );
}

function SliderRow({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)] h-2"
      />
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-300">{label}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors ${value ? 'bg-[var(--primary)]' : 'bg-zinc-600'}`}
      >
        <span className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${value ? 'left-[22px]' : 'left-[2px]'}`} />
      </button>
    </div>
  );
}
