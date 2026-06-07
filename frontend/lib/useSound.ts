'use client';

import { useCallback, useRef } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

let ctx: AudioContext | null = null;
function getCtx() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
  return ctx;
}

function withCtx(fn: (ac: AudioContext) => void) {
  const ac = getCtx();
  if (!ac) return;
  try { fn(ac); } catch { /* audio not available */ }
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 1) {
  withCtx(ac => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume * 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  });
}

const SFX = {
  correct: () => { playTone(880, 0.12, 'sine', 1); },
  wrong: () => { playTone(220, 0.2, 'sawtooth', 0.6); },
  complete: () => {
    withCtx(ac => {
      [523, 659, 784].forEach((f, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.value = 0.25;
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15 + i * 0.1);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.1);
        osc.stop(ac.currentTime + 0.15 + i * 0.1);
      });
    });
  },
  endGame: () => {
    withCtx(ac => {
      [392, 440, 494, 523].forEach((f, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.value = 0.2;
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3 + i * 0.15);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + i * 0.15);
        osc.stop(ac.currentTime + 0.3 + i * 0.15);
      });
    });
  },
};

type SfxName = keyof typeof SFX;

export function useSound() {
  const { settings } = useSettings();
  const lastPlayed = useRef(0);

  const play = useCallback((name: SfxName) => {
    const vol = settings.masterVolume * settings.sfxVolume;
    if (vol <= 0) return;
    const now = Date.now();
    if (now - lastPlayed.current < 80) return;
    lastPlayed.current = now;
    SFX[name]();
  }, [settings.masterVolume, settings.sfxVolume]);

  return play;
}
