'use client';

import { useEffect, useRef, useCallback } from 'react';

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
  onTimeUpdate: (t: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  onPlayingRef.current = onPlaying;
  offsetRef.current = audioOffset;

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = 1;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state === 'waiting' || state === 'finished' || !previewUrl) {
      audio.pause();
      audio.src = '';
      firedRef.current = false;
      return;
    }

    if (state === 'round_preparing') {
      firedRef.current = false;
      audio.src = previewUrl;
      audio.preload = 'auto';
      audio.load();
      return;
    }

    if (state === 'playing') {
      const start = () => {
        const safeOffset = Math.min(offsetRef.current, (audio.duration || 30) - 1);
        if (safeOffset > 0) audio.currentTime = safeOffset;
        audio.play().catch(err => console.error('Autoplay blocked:', err));
      };

      if (audio.readyState >= 1) {
        start();
      } else {
        audio.addEventListener('loadedmetadata', start, { once: true });
      }
      return;
    }

    audio.pause();
  }, [state, previewUrl]);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    onTimeUpdate(audio.currentTime);
    if (!firedRef.current && audio.currentTime >= offsetRef.current + 0.1) {
      firedRef.current = true;
      onPlayingRef.current();
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    if (state !== 'playing') return;
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [state, tick]);

  return null;
}
