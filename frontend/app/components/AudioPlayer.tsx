'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

let apiLoaded = false;

function loadAPI() {
  if (apiLoaded || typeof window === 'undefined') return;
  if (document.getElementById('youtube-iframe-api')) return;
  apiLoaded = true;
  const tag = document.createElement('script');
  tag.id = 'youtube-iframe-api';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

export default function AudioPlayer({
  youtubeVideoId,
  previewUrl,
  audioOffset,
  durationMs,
  state,
  onPlaying,
  onTimeUpdate,
}: {
  youtubeVideoId: string | null;
  previewUrl: string | null;
  audioOffset: number;
  durationMs: number;
  state: string;
  onPlaying: () => void;
  onTimeUpdate: (t: number, d?: number) => void;
}) {
  const { settings } = useSettings();
  const volRef = useRef(settings.masterVolume);
  volRef.current = settings.masterVolume;
  const ytRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytReadyRef = useRef(false);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const htmlReadyRef = useRef(false);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  const sourceRef = useRef<'youtube' | 'html5' | 'none'>('none');
  onPlayingRef.current = onPlaying;
  offsetRef.current = audioOffset;

  const src: 'youtube' | 'html5' | 'none' = youtubeVideoId ? 'youtube' : previewUrl ? 'html5' : 'none';

  useEffect(() => { loadAPI(); }, []);

  // Create/destroy player
  useEffect(() => {
    const shouldCreate = state === 'playing' && src !== 'none';
    if (!shouldCreate) {
      if (ytRef.current) { ytRef.current.destroy(); ytRef.current = null; ytReadyRef.current = false; }
      if (htmlAudioRef.current) { htmlAudioRef.current.pause(); htmlAudioRef.current.src = ''; htmlAudioRef.current = null; htmlReadyRef.current = false; }
      firedRef.current = false;
      return;
    }

    firedRef.current = false;
    sourceRef.current = src;

    if (src === 'youtube') {
      if (htmlAudioRef.current) { htmlAudioRef.current.pause(); htmlAudioRef.current.src = ''; htmlAudioRef.current = null; }
      if (ytRef.current) return;

      const init = () => {
        if (ytRef.current || !ytContainerRef.current) return;
        ytReadyRef.current = false;
        ytRef.current = new window.YT.Player(ytContainerRef.current, {
          height: '300',
          width: '300',
          videoId: youtubeVideoId,
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, start: offsetRef.current },
          events: { onReady: () => { ytReadyRef.current = true; } },
        });
      };

      if (typeof window.YT !== 'undefined' && window.YT.Player) {
        init();
      } else {
        const existing = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (existing) existing(); init(); };
      }
    } else if (src === 'html5') {
      if (ytRef.current) { ytRef.current.destroy(); ytRef.current = null; }
      const audio = new Audio(previewUrl!);
      audio.preload = 'auto';
      audio.volume = volRef.current;
      htmlReadyRef.current = false;
      const setReady = () => { htmlReadyRef.current = true; };
      audio.addEventListener('canplaythrough', setReady, { once: true });
      audio.addEventListener('loadedmetadata', setReady, { once: true });
      htmlAudioRef.current = audio;
    }

    return () => {
      if (ytRef.current) { ytRef.current.destroy(); ytRef.current = null; ytReadyRef.current = false; }
      if (htmlAudioRef.current) { htmlAudioRef.current.pause(); htmlAudioRef.current.src = ''; htmlAudioRef.current = null; htmlReadyRef.current = false; }
    };
  }, [youtubeVideoId, previewUrl, state, src]);

  // Seek and play
  useEffect(() => {
    if (state !== 'playing') return;
    firedRef.current = false;

    let stopped = false;
    const s = sourceRef.current;

    const tryStart = () => {
      if (stopped) return;
      if (s === 'youtube') {
        const p = ytRef.current;
        if (!p || !ytReadyRef.current) { setTimeout(tryStart, 100); return; }
        try { p.seekTo(offsetRef.current, true); p.setVolume(Math.round(volRef.current * 100)); p.playVideo(); }
        catch { setTimeout(tryStart, 100); }
      } else if (s === 'html5') {
        const a = htmlAudioRef.current;
        if (!a || !htmlReadyRef.current) { setTimeout(tryStart, 100); return; }
        try { a.currentTime = offsetRef.current; a.volume = volRef.current; a.play(); }
        catch { setTimeout(tryStart, 100); }
      }
    };
    tryStart();

    const onGesture = () => {
      if (stopped || firedRef.current) return;
      try {
        if (s === 'youtube') { const p = ytRef.current; if (p && ytReadyRef.current) p.playVideo(); }
        else if (s === 'html5') { const a = htmlAudioRef.current; if (a) a.play(); }
      } catch {}
    };
    document.addEventListener('click', onGesture, { once: true });
    document.addEventListener('touchstart', onGesture, { once: true });

    return () => {
      stopped = true;
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchstart', onGesture);
    };
  }, [state]);

  // Live volume update — reacts to settings changes during playback
  useEffect(() => {
    const src = sourceRef.current;
    const vol = settings.masterVolume;
    if (src === 'youtube' && ytRef.current && ytReadyRef.current) {
      try { ytRef.current.setVolume(Math.round(vol * 100)); } catch {}
    } else if (src === 'html5' && htmlAudioRef.current) {
      htmlAudioRef.current.volume = vol;
    }
  }, [settings.masterVolume]);

  const tick = useCallback(() => {
    const s = sourceRef.current;
    if (s === 'youtube') {
      const p = ytRef.current;
      if (!p || !ytReadyRef.current) return;
      try {
        const t = p.getCurrentTime();
        const d = p.getDuration();
        onTimeUpdate(t, d > 0 ? d : (durationMs / 1000 || 30));
        if (!firedRef.current && t >= offsetRef.current + 0.1) { firedRef.current = true; onPlayingRef.current(); }
      } catch {}
    } else if (s === 'html5') {
      const a = htmlAudioRef.current;
      if (!a) return;
      const t = a.currentTime;
      const d = durationMs / 1000 || 30;
      onTimeUpdate(t, d);
      if (!firedRef.current && t >= offsetRef.current + 0.1) { firedRef.current = true; onPlayingRef.current(); }
    }
  }, [onTimeUpdate, durationMs]);

  useEffect(() => {
    if (state !== 'playing') return;
    const interval = setInterval(tick, 80);
    return () => clearInterval(interval);
  }, [state, tick]);

  return (
    <div
      ref={ytContainerRef}
      style={{ position: 'fixed', top: '10px', right: '10px', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
    />
  );
}
