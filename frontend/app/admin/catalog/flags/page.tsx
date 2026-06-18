'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getFlaggedSongs, dismissSongFlags, deleteCuratedSong, updateAiGenre, fetchGenres } from '@/lib/api';
import GenreSelect from '../../components/GenreSelect';

export default function FlaggedSongsPage() {
  const [songs, setSongs] = useState<any[]>([]);
  const [genres, setGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reclassifyGenre, setReclassifyGenre] = useState<Record<string, string>>({});
  const [bulkGenre, setBulkGenre] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, genreData] = await Promise.all([getFlaggedSongs(100, 0), fetchGenres()]);
    if (res.ok) { setSongs(res.songs); setGenres(genreData || []); setError(null); }
    else { setError(res.error || 'Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const playPreview = (songId: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === songId) { setPlayingId(null); return; }
    const audio = new Audio(`/api/proxy/audio/${songId}`);
    audio.volume = 0.5;
    audio.addEventListener('ended', () => setPlayingId(null));
    audio.addEventListener('error', () => setPlayingId(null));
    audio.play().then(() => { audioRef.current = audio; setPlayingId(songId); }).catch(() => setPlayingId(null));
  };

  const handleDismiss = async (songId: string) => {
    const res = await dismissSongFlags(songId);
    if (res.ok) setSongs(prev => prev.filter(s => s.song_id !== songId));
  };

  const handleRemove = async (songId: string) => {
    await deleteCuratedSong(songId);
    await dismissSongFlags(songId);
    setSongs(prev => prev.filter(s => s.song_id !== songId));
  };

  const handleReclassify = async (songId: string) => {
    const genre = reclassifyGenre[songId];
    if (!genre) return;
    await updateAiGenre(songId, genre);
    await dismissSongFlags(songId);
    setSongs(prev => prev.filter(s => s.song_id !== songId));
  };

  const handleBulkDismiss = async () => {
    for (const id of selected) await dismissSongFlags(id);
    setSongs(prev => prev.filter(s => !selected.has(s.song_id)));
    setSelected(new Set());
  };

  const handleBulkReclassify = async () => {
    if (!bulkGenre) return;
    for (const id of selected) {
      await updateAiGenre(id, bulkGenre);
      await dismissSongFlags(id);
    }
    setSongs(prev => prev.filter(s => !selected.has(s.song_id)));
    setSelected(new Set());
    setBulkGenre('');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reported Songs</h1>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all">Refresh</button>
      </div>

      {error && (
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {selected.size > 0 && (
        <div className="p-4 rounded-xl flex items-center gap-3 flex-wrap" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button onClick={handleBulkDismiss} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/35 transition-all">Dismiss All</button>
          <GenreSelect value={bulkGenre} onChange={setBulkGenre} genres={genres} placeholder="Genre..." compact />
          <button onClick={handleBulkReclassify} disabled={!bulkGenre} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/35 transition-all disabled:opacity-30">Reclassify & Dismiss</button>
          <button onClick={() => setSelected(new Set())} className="text-[10px] text-foreground/40 hover:text-foreground ml-auto">Clear</button>
        </div>
      )}

      {loading ? (
        <p className="text-foreground/40 text-sm">Loading...</p>
      ) : songs.length === 0 ? (
        <div className="p-8 text-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <p className="text-lg mb-1">No reported songs</p>
          <p className="text-xs text-foreground/40">Players haven't flagged any songs recently</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="w-8 py-3 px-2">
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(songs.map(s => s.song_id)) : new Set())}
                    checked={selected.size === songs.length && songs.length > 0} className="accent-[var(--primary)] cursor-pointer" />
                </th>
                <th className="w-10 py-3 px-2 text-center font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">🎵</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Song</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Artist</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Genre</th>
                <th className="text-center py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Flags</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Reasons</th>
                <th className="text-right py-3 px-3 font-semibold text-foreground/40 text-[10px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((s: any) => (
                <tr key={s.song_id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                  <td className="py-3 px-2 text-center">
                    <input type="checkbox" checked={selected.has(s.song_id)} onChange={() => toggleSelect(s.song_id, setSelected)} className="accent-[var(--primary)] cursor-pointer" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button onClick={() => playPreview(s.song_id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-all"
                      style={{ backgroundColor: playingId === s.song_id ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                      {playingId === s.song_id ? '⏹' : '▶️'}
                    </button>
                  </td>
                  <td className="py-3 px-3 font-medium truncate max-w-[160px]">{s.name || '—'}</td>
                  <td className="py-3 px-3 text-foreground/60 truncate max-w-[130px]">{s.artist || '—'}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{
                      backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)'
                    }}>
                      {s.genre || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-bold tabular-nums ${s.flag_count >= 3 ? 'text-red-400' : 'text-foreground/60'}`}>{s.flag_count}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1 flex-wrap max-w-[160px]">
                      {s.reasons && Object.entries(s.reasons).map(([reason, count]: any) => (
                        <span key={reason} className="px-1.5 py-0.2 rounded bg-white/5 text-foreground/60 text-[9px] border border-white/[0.02]">{reason} ({count})</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col gap-1.5 items-end">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleDismiss(s.song_id)} className="text-[10px] px-2 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/35 transition-all">Dismiss</button>
                        <button onClick={() => handleRemove(s.song_id)} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/35 transition-all">Remove</button>
                      </div>
                      <div className="flex gap-1.5">
                        <GenreSelect value={reclassifyGenre[s.song_id] || ''} onChange={v => setReclassifyGenre(p => ({ ...p, [s.song_id]: v }))}
                          genres={genres} placeholder="Reclassify..." compact />
                        <button onClick={() => handleReclassify(s.song_id)} disabled={!reclassifyGenre[s.song_id]}
                          className="text-[9px] px-1.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/35 transition-all disabled:opacity-30">✓</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toggleSelect(id: string, setSelected: React.Dispatch<React.SetStateAction<Set<string>>>) {
  setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
}
