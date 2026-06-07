'use client';

interface TrackEntry {
  round: number;
  name: string;
  artist: string;
  albumImage?: string | null;
  skipped?: boolean;
}

export default function TrackHistory({ tracks }: { tracks: TrackEntry[] }) {
  if (!tracks || tracks.length === 0) return null;

  return (
    <div className="fixed top-20 left-4 z-50 max-w-[220px] w-full max-h-[calc(100vh-120px)] bg-black/80 backdrop-blur rounded-xl border border-white/10 p-3 text-[10px] font-mono text-zinc-300 shadow-2xl overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-zinc-500 uppercase tracking-wider">History</span>
        <span className="text-zinc-600">{tracks.length} songs</span>
      </div>
      <div className="space-y-1.5">
        {[...tracks].reverse().map(t => (
          <div
            key={t.round}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${t.skipped ? 'opacity-50' : ''} ${
              t.round === tracks.length ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20' : 'bg-white/[0.03]'
            }`}
          >
            {t.skipped && <span className="text-zinc-500">⏭</span>}
            {t.albumImage && (
              <img src={t.albumImage} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-medium truncate leading-tight ${t.skipped ? 'line-through text-zinc-500' : ''}`}>{t.name}</p>
              <p className="text-[8px] text-zinc-500 truncate leading-tight">{t.artist}</p>
            </div>
            <span className="text-[9px] text-zinc-600 shrink-0">#{t.round}</span>
          </div>
        ))}
      </div>
    </div>
  );
}