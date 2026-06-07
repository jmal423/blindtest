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
  audioOffset,
  state,
  onPlaying,
  onTimeUpdate,
}: {
  youtubeVideoId: string | null;
  audioOffset: number;
  state: string;
  onPlaying: () => void;
  onTimeUpdate: (t: number) => void;
}) {
  const { settings } = useSettings();
  const volRef = useRef(settings.masterVolume);
  volRef.current = settings.masterVolume;
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  const readyRef = useRef(false);
  onPlayingRef.current = onPlaying;
  offsetRef.current = audioOffset;

  useEffect(() => { loadAPI(); }, []);

  // Create/destroy player when videoId changes
  useEffect(() => {
    const shouldCreate = !(state === 'waiting' || state === 'finished' || state === 'game_over') && youtubeVideoId;
    if (!shouldCreate) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        readyRef.current = false;
      }
      firedRef.current = false;
      return;
    }

    if (playerRef.current) return;

    const init = () => {
      if (playerRef.current || !containerRef.current) return;
      readyRef.current = false;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '300',
        width: '300',
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => { readyRef.current = true; },
        },
      });
    };

    if (typeof window.YT !== 'undefined' && window.YT.Player) {
      init();
    } else {
      const existing = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existing) existing();
        init();
      };
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        readyRef.current = false;
      }
    };
  }, [youtubeVideoId, state]);

  // Seek and play when state becomes 'playing'
  useEffect(() => {
    if (state !== 'playing' || !playerRef.current) return;
    firedRef.current = false;

    let stopped = false;
    const trySeek = () => {
      if (stopped) return;
      const player = playerRef.current;
      if (!player || !readyRef.current) {
        setTimeout(trySeek, 100);
        return;
      }
      try {
        player.seekTo(offsetRef.current, true);
        player.setVolume(Math.round(volRef.current * 100));
        player.playVideo();
      } catch {
        setTimeout(trySeek, 100);
      }
    };
    trySeek();

    // Mobile: one-shot gesture handler for first playback
    const onGesture = () => {
      if (stopped) return;
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      try {
        player.seekTo(offsetRef.current, true);
        player.setVolume(Math.round(volRef.current * 100));
        player.playVideo();
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

  const tick = useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    try {
      const t = player.getCurrentTime();
      onTimeUpdate(t);
      if (!firedRef.current && t >= offsetRef.current + 0.1) {
        firedRef.current = true;
        onPlayingRef.current();
      }
    } catch { /* player not ready yet */ }
  }, [onTimeUpdate]);

  useEffect(() => {
    if (state !== 'playing') return;
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [state, tick]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '1px',
        height: '1px',
        opacity: 0.01,
        pointerEvents: 'none',
      }}
    />
  );
}
