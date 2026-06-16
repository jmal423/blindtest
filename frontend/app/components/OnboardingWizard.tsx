'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '@/app/context/SettingsContext';
import LanguageSwitcher from './LanguageSwitcher';

const ONBOARDING_KEY = 'blindtest_onboarding_done';

function useOnboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShow(true);
  }, []);
  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShow(false);
  };
  return { show, dismiss };
}

export default function OnboardingWizard() {
  const { show, dismiss } = useOnboarding();
  const { settings, updateSettings } = useSettings();
  const [step, setStep] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const playSound = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio('/onboarding-test.mp3');
    audio.volume = settings.masterVolume;
    audio.addEventListener('ended', () => setPlaying(false));
    audio.play().then(() => { audioRef.current = audio; setPlaying(true); }).catch(() => setPlaying(false));
  };

  const handleVolumeChange = (v: number) => {
    updateSettings({ masterVolume: v });
    if (audioRef.current) audioRef.current.volume = v;
  };

  const finish = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    dismiss();
  };

  const steps = [
    // Step 0: Welcome + Language
    {
      content: (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto text-2xl shadow-lg">🎵</div>
          <div>
            <p className="text-xl font-black tracking-tight uppercase">
              <span className="text-primary">Blind</span><span className="text-foreground">Test</span>
            </p>
            <p className="text-sm text-foreground/50 mt-2">Pick your language to get started</p>
          </div>
          <div className="flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      ),
    },
    // Step 1: Sound
    {
      content: (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center mx-auto text-2xl shadow-lg">🔊</div>
          <div>
            <p className="text-xl font-black tracking-tight uppercase text-foreground">Sound Check</p>
            <p className="text-sm text-foreground/50 mt-2">Adjust your volume</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-xs text-foreground/40 font-bold">🔈</span>
            <input
              type="range" min={0.05} max={1} step={0.05}
              value={settings.masterVolume}
              onChange={e => handleVolumeChange(Number(e.target.value))}
              className="w-40 accent-[var(--primary)] h-1.5 cursor-pointer"
            />
            <span className="text-xs text-foreground/40 font-bold">🔊</span>
          </div>
          <button
            onClick={playSound}
            className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
          >
            {playing ? '🔊 Playing...' : '▶ Test Sound'}
          </button>
        </div>
      ),
    },
    // Step 2: Theme
    {
      content: (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto text-2xl shadow-lg">🎨</div>
          <div>
            <p className="text-xl font-black tracking-tight uppercase text-foreground">Choose Theme</p>
            <p className="text-sm text-foreground/50 mt-2">Pick a look you like</p>
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {[
              { id: 'dark' as const, label: 'Dark', emoji: '🌙' },
              { id: 'noir' as const, label: 'Neon Noir', emoji: '🌃' },
            ].map(th => (
              <button
                key={th.id}
                onClick={() => updateSettings({ theme: th.id })}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  settings.theme === th.id
                    ? 'bg-primary text-foreground border-transparent shadow-md'
                    : 'text-foreground/50 hover:text-foreground border border-white/10'
                }`}
              >
                {th.emoji} {th.label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  if (!show) return null;

  const total = steps.length;
  const isLast = step >= total - 1;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm bg-background border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        {steps[step].content}

        {/* Stepper dots */}
        <div className="flex justify-center gap-1.5 mt-6">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/20'}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-20 text-foreground/50 hover:text-foreground"
          >
            Back
          </button>
          {isLast ? (
            <button
              onClick={finish}
              className="px-6 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-gradient-to-r from-primary to-accent text-foreground shadow-md hover:brightness-110"
            >
              Start Playing 🎮
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-6 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-white/10 hover:bg-white/15 text-foreground"
            >
              Next
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
