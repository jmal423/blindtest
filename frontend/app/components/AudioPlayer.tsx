'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

export default function AudioPlayer({
  previewUrl,
  audioOffset,
  state,
  onPlaying,
  onTimeUpdate,
}: {
  previewUrl: string | null;
  audioOffset: number;
  state: string;
  onPlaying: () => void;
  onTimeUpdate: (t: number, d?: number) => void;
}) {
  const { settings } = useSettings();
  const volRef = useRef(settings.masterVolume);
  volRef.current = settings.masterVolume;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readyRef = useRef(false);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  onPlayingRef.current = onPlaying;
  offsetRef.current = audioOffset;

  useEffect(() => {
    if (state !== 'playing' || !previewUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
        readyRef.current = false;
      }
      firedRef.current = false;
      return;
    }

    firedRef.current = false;
    readyRef.current = false;

    const audio = new Audio(previewUrl);
    audio.preload = 'auto';
    audio.volume = volRef.current;
    audio.addEventListener('canplaythrough', () => { readyRef.current = true; }, { once: true });
    audio.addEventListener('loadedmetadata', () => { readyRef.current = true; }, { once: true });
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      readyRef.current = false;
    };
  }, [previewUrl, state]);

  useEffect(() => {
    if (state !== 'playing') return;
    firedRef.current = false;

    let stopped = false;

    const tryStart = () => {
      if (stopped) return;
      const a = audioRef.current;
      if (!a || !readyRef.current) { setTimeout(tryStart, 100); return; }
      try {
        a.currentTime = offsetRef.current;
        a.volume = volRef.current;
        a.play();
      } catch { setTimeout(tryStart, 100); }
    };
    tryStart();

    const onGesture = () => {
      if (stopped || firedRef.current) return;
      try { const a = audioRef.current; if (a) a.play(); } catch {}
    };
    document.addEventListener('click', onGesture, { once: true });
    document.addEventListener('touchstart', onGesture, { once: true });

    return () => {
      stopped = true;
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchstart', onGesture);
    };
  }, [state]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.masterVolume;
    }
  }, [settings.masterVolume]);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.currentTime;
    const d = a.duration || 30;
    onTimeUpdate(t, d);
    if (!firedRef.current && t >= offsetRef.current + 0.1) {
      firedRef.current = true;
      onPlayingRef.current();
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    if (state !== 'playing') return;
    const interval = setInterval(tick, 80);
    return () => clearInterval(interval);
  }, [state, tick]);

  return null;
}