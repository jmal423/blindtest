'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '@/app/context/SettingsContext';
import { useTranslation } from '@/lib/useTranslation';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
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
  const { t } = useTranslation();

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
      masterVolume: 0.2,
      sfxVolume: 0.8,
      autoFocusInput: true,
      reducedMotion: false,
      colorblindMode: false,
      theme: 'dark',
      language: 'en',
    });
  };

  const toggle = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] });
  };

  const inner = (
    <>
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.01]">
        <h2 className="text-base font-black tracking-tight text-zinc-100 uppercase">{t('settings_title')}</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto scrollbar-thin">
        {/* Audio */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('audio_section')}</h3>
          <div className="space-y-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
            <SliderRow
              label={t('master_volume')}
              value={settings.masterVolume}
              onChange={v => updateSettings({ masterVolume: v })}
              min={0}
              max={1}
              step={0.05}
              format={v => Math.round(v * 100) + '%'}
            />
            <SliderRow
              label={t('sfx_volume')}
              value={settings.sfxVolume}
              onChange={v => updateSettings({ sfxVolume: v })}
              min={0}
              max={1}
              step={0.05}
              format={v => Math.round(v * 100) + '%'}
            />
            <button
              onClick={testAudio}
              className="w-full mt-2 px-4 py-2.5 bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 border border-[var(--primary)]/25 text-xs text-[var(--primary)] hover:text-white rounded-xl font-bold transition-all cursor-pointer text-center"
            >
              {t('test_audio')}
            </button>
          </div>
        </section>

        {/* Gameplay & Accessibility */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Preferences</h3>
          <div className="space-y-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
            <ToggleRow
              label={t('auto_focus')}
              description={t('auto_focus_desc')}
              value={settings.autoFocusInput}
              onChange={() => toggle('autoFocusInput')}
            />
            <div className="h-px bg-white/5" />
            <ToggleRow
              label={t('reduced_motion')}
              description={t('reduced_motion_desc')}
              value={settings.reducedMotion}
              onChange={() => toggle('reducedMotion')}
            />
            <div className="h-px bg-white/5" />
            <ToggleRow
              label={t('colorblind')}
              description={t('colorblind_desc')}
              value={settings.colorblindMode}
              onChange={() => toggle('colorblindMode')}
            />
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('appearance_section')}</h3>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(theme => {
              const active = settings.theme === theme;
              return (
                <button
                  key={theme}
                  onClick={() => updateSettings({ theme })}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    active
                      ? 'bg-gradient-to-r from-primary to-accent text-white border-transparent shadow-lg shadow-primary/15 scale-[1.02]'
                      : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                  }`}
                >
                  {theme === 'dark' ? `🌙 ${t('dark_theme')}` : `☀️ ${t('light_theme')}`}
                </button>
              );
            })}
          </div>
        </section>

        {/* Language */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('language_section')}</h3>
          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
            <LanguageSwitcher />
          </div>
        </section>

        {/* Reset */}
        <button
          onClick={resetDefaults}
          className="w-full py-2 text-center text-xs text-zinc-500 hover:text-zinc-300 font-bold transition-colors cursor-pointer uppercase tracking-wider"
        >
          {t('reset_defaults')}
        </button>
      </div>
    </>
  );

  if (settings.reducedMotion) {
    return (
      <div className="relative w-full max-w-md mx-4 sm:mx-0 bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      className="relative w-full max-w-md mx-4 sm:mx-0 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      {inner}
    </motion.div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400 font-bold">{label}</span>
        <span className="text-zinc-300 font-extrabold tabular-nums bg-white/5 px-2 py-0.5 rounded border border-white/5">
          {format(value)}
        </span>
      </div>
      <div className="relative flex items-center group">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-lg appearance-none bg-zinc-800 focus:outline-none cursor-pointer 
            [&::-webkit-slider-runnable-track]:bg-zinc-800/60
            [&::-webkit-slider-thumb]:appearance-none 
            [&::-webkit-slider-thumb]:h-4 
            [&::-webkit-slider-thumb]:w-4 
            [&::-webkit-slider-thumb]:rounded-full 
            [&::-webkit-slider-thumb]:bg-white 
            [&::-webkit-slider-thumb]:border-2 
            [&::-webkit-slider-thumb]:border-[var(--primary)] 
            [&::-webkit-slider-thumb]:shadow-lg 
            [&::-webkit-slider-thumb]:shadow-[var(--primary)]/20
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:group-hover:scale-110"
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-xs font-bold text-zinc-200">{label}</p>
        <p className="text-[10px] text-zinc-500 leading-normal max-w-[240px]">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-all duration-300 ease-out focus:outline-none cursor-pointer ${
          value
            ? 'bg-gradient-to-r from-primary to-accent shadow-md shadow-primary/10'
            : 'bg-zinc-800 border border-white/5'
        }`}
      >
        <motion.div
          animate={{ x: value ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-[3px] w-4 h-4 rounded-full shadow transition-colors ${
            value ? 'bg-white' : 'bg-zinc-400'
          }`}
        />
      </button>
    </div>
  );
}
