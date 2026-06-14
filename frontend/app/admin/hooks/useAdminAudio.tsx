'use client';

import { useState, useRef, useEffect } from 'react';
import { getTrackPreviewUrl } from '@/lib/api';

export function useAdminAudio() {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackRef = useRef<string | null>(null);

  const togglePreview = async (trackId: string, url?: string) => {
    if (activeTrackRef.current === trackId) {
      stopPreview();
    } else {
      activeTrackRef.current = trackId;
      setPlayingTrackId(trackId);
      setPreviewUrl(null);

      let urlToPlay = url;

      if (trackId && !trackId.startsWith('test-')) {
        try {
          const res = await getTrackPreviewUrl(trackId);
          if (activeTrackRef.current === trackId && res.ok && res.previewUrl) {
            urlToPlay = res.previewUrl;
          }
        } catch (err) {
          console.error('[useAdminAudio] Failed to fetch fresh preview url:', err);
        }
      }

      if (activeTrackRef.current === trackId) {
        if (urlToPlay) {
          setPreviewUrl(urlToPlay);
        } else {
          stopPreview();
        }
      }
    }
  };

  const stopPreview = () => {
    activeTrackRef.current = null;
    setPlayingTrackId(null);
    setPreviewUrl(null);
    if (audioRef.current) audioRef.current.pause();
  };

  useEffect(() => {
    if (!audioRef.current) return;
    if (previewUrl) {
      audioRef.current.src = previewUrl;
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.error('[useAdminAudio] Playback failed:', err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [previewUrl]);

  const AudioPlayerOverlay = (
    <>
      <audio ref={audioRef} onEnded={stopPreview} className="hidden" />
      {previewUrl && (
        <div className="fixed bottom-6 right-6 p-4 bg-surface border border-white/10 backdrop-blur-md rounded-2xl flex items-center gap-4 animate-slide-up shadow-2xl z-50">
          <div className="flex items-center gap-3">
            <span className="text-xl animate-pulse">🔊</span>
            <div>
              <p className="text-xs font-bold text-foreground">Playing Audio Preview</p>
              <p className="text-[10px] text-foreground/40">Listening to active clip.</p>
            </div>
          </div>
          <button
            onClick={stopPreview}
            className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all"
          >
            Stop
          </button>
        </div>
      )}
    </>
  );

  return { playingTrackId, togglePreview, AudioPlayerOverlay, stopPreview };
}

