'use client';

import { useEffect, useRef, useCallback } from 'react';

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
  tag.onload = () => apiLoaded = true;
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
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onPlayingRef = useRef(onPlaying);
  const firedRef = useRef(false);
  const offsetRef = useRef(audioOffset);
  const readyResolve = useRef<(() => void) | null>(null);
  onPlayingRef.current = onPlaying;
  offsetRef.current = audioOffset;

  useEffect(() => { loadAPI(); }, []);

  useEffect(() => {
    if (state === 'waiting' || state === 'finished' || !youtubeVideoId) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      firedRef.current = false;
      return;
    }

    if (playerRef.current) return;

    const init = () => {
      if (playerRef.current || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '0',
        width: '0',
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (readyResolve.current) readyResolve.current();
          },
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
      }
    };
  }, [youtubeVideoId, state]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || state !== 'playing') return;
    firedRef.current = false;
    const seekAndPlay = () => {
      player.seekTo(offsetRef.current, true);
      player.playVideo();
    };

    if (player.getPlayerState?.() === -1 || player.getPlayerState?.() === 5) {
      const check = setInterval(() => {
        if (player.getPlayerState?.() !== -1 && player.getPlayerState?.() !== 5) {
          clearInterval(check);
          seekAndPlay();
        }
      }, 100);
      setTimeout(() => clearInterval(check), 5000);
    } else {
      seekAndPlay();
    }
  }, [state]);

  const tick = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const t = player.getCurrentTime();
    onTimeUpdate(t);
    if (!firedRef.current && t >= offsetRef.current + 0.1) {
      firedRef.current = true;
      onPlayingRef.current();
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    if (state !== 'playing') return;
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [state, tick]);

  return <div ref={containerRef} className="hidden" />;
}
