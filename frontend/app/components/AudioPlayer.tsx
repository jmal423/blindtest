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
  const srcRef = useRef<string | null>(null);
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
      if (!a) return false;
      try {
        a.volume = volRef.current;
        await a.play();
        return true;
      } catch {
        return false;
      }
    },
  }));

  useEffect(() => {
    const url = (state === 'playing' || state === 'round_preparing') ? previewUrl : null;

    if (!url) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        srcRef.current = null;
        readyRef.current = false;
      }
      firedRef.current = false;
      return;
    }

    if (srcRef.current === url && audioRef.current) {
      return;
    }

    firedRef.current = false;
    readyRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volRef.current;
    audio.src = url;

    const onReady = () => { readyRef.current = true; };
    const onError = () => {
      console.error('[Audio] Failed to load:', url, audio.error?.code, audio.error?.message);
      readyRef.current = false;
    };

    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('loadedmetadata', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });

    audioRef.current = audio;
    srcRef.current = url;

    if (state !== 'playing') {
      audio.pause();
    }

    return () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('loadedmetadata', onReady);
      audio.removeEventListener('error', onError);
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
        srcRef.current = null;
        readyRef.current = false;
      }
    };
  }, [previewUrl, state]);

  useEffect(() => {
    if (state !== 'playing') return;
    firedRef.current = false;

    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryStart = () => {
      if (stopped) return;
      const a = audioRef.current;
      if (!a) {
        retryTimer = setTimeout(tryStart, 100);
        return;
      }
      if (!readyRef.current) {
        retryTimer = setTimeout(tryStart, 150);
        return;
      }
      try {
        a.currentTime = offsetRef.current;
        a.volume = volRef.current;
        const promise = a.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            if (stopped) return;
            if (err.name === 'NotAllowedError') {
              onBlockedRef.current?.();
            } else {
              console.error('[Audio] Play error:', err.name, err.message);
            }
          });
        }
      } catch (err) {
        onBlockedRef.current?.();
      }
    };
    tryStart();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
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