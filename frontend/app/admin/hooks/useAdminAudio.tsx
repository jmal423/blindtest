'use client';

import { useState, useRef } from 'react';

export function useAdminAudio() {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePreview = (trackId: string, url: string) => {
    if (playingTrackId === trackId) {
      stopPreview();
    } else {
      setPlayingTrackId(trackId);
      setPreviewUrl(url);
    }
  };

  const stopPreview = () => {
    setPlayingTrackId(null);
    setPreviewUrl(null);
    if (audioRef.current) audioRef.current.pause();
  };

  const AudioPlayerOverlay = previewUrl ? (
    <>
      <audio ref={audioRef} src={previewUrl} autoPlay onEnded={stopPreview} className="hidden" />
      <div className="fixed bottom-6 right-6 p-4 bg-surface border border-white/10 backdrop-blur-md rounded-2xl flex items-center gap-4 animate-slide-up shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl animate-pulse">🔊</span>
          <div>
            <p className="text-xs font-bold text-white">Playing Audio Preview</p>
            <p className="text-[10px] text-zinc-500">Listening to active clip.</p>
          </div>
        </div>
        <button
          onClick={stopPreview}
          className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all"
        >
          Stop
        </button>
      </div>
    </>
  ) : null;

  return { playingTrackId, togglePreview, AudioPlayerOverlay, stopPreview };
}
