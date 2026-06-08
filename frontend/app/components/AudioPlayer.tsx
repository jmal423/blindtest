'use client';

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

export interface AudioPlayerHandle {
  resume: () => Promise<boolean>;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, {
  previewUrl: string | null;
  audioOffset: number;
  state: string;
  onPlaying: () => void;
  onTimeUpdate: (t: number, d?: number) => void;
  onBlocked?: () => void;
}>(function AudioPlayer({
  previewUrl,
  audioOffset,
  state,
  onPlaying,
  onTimeUpdate,
  onBlocked,
}, ref) {
  const { settings } = useSettings();
  const volRef = useRef(settings.masterVolume);
  volRef.current = settings.masterVolume;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readyRef = useRef(false);
  const onPlayingRef = useRef(onPlaying);
  const onBlockedRef = useRef(onBlocked);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  onPlayingRef.current = onPlaying;
  onBlockedRef.current = onBlocked;
  offsetRef.current = audioOffset;

  useImperativeHandle(ref, () => ({
    resume: async () => {
      const a = audioRef.current;
      if (!a || !readyRef.current) return false;
      try {
        a.currentTime = offsetRef.current;
        a.volume = volRef.current;
        await a.play();
        return true;
      } catch {
        return false;
      }
    },
  }));

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
        const promise = a.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            if (stopped) return;
            if (err.name === 'NotAllowedError') {
              onBlockedRef.current?.();
            }
          });
        }
      } catch {
        onBlockedRef.current?.();
      }
    };
    tryStart();

    const onGesture = () => {
      if (stopped) return;
      const a = audioRef.current;
      if (!a) return;
      try {
        a.volume = volRef.current;
        a.play().catch(() => {});
      } catch {}
    };
    document.addEventListener('click', onGesture, { once: true });
    document.addEventListener('touchstart', onGesture, { once: true, passive: true });

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
});

export default AudioPlayer;