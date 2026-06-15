'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getUnclassifiedTracks, updateAiGenre, deleteAiTrack, fetchGenres } from '@/lib/api';
import { useSettings } from '@/app/context/SettingsContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Track {
  id: string;
  name: string;
  artist: string;
  album_image: string | null;
  rank: number;
}

const GROUP_LABELS: Record<string, string> = {
  portuguese: '🇵🇹 Português',
  brazilian: '🇧🇷 Brasileiro',
  united_states: '🇺🇸 United States',
  united_kingdom: '🇬🇧 United Kingdom',
  french: '🇫🇷 Français',
  spanish: '🇪🇸 Español',
  global_other: '🌍 Mundo & Outros',
};

export default function TriagePage() {
  const { settings } = useSettings();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [genres, setGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [collapsedArtists, setCollapsedArtists] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, genreData] = await Promise.all([
        getUnclassifiedTracks(),
        fetchGenres(),
      ]);
      setTracks(data.tracks || []);
      setGenres(genreData || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const groupedGenres = useMemo(() => {
    const groups: Record<string, typeof genres> = {};
    for (const g of genres) {
      if (g.id === 'UNCLASSIFIED') continue;
      const key = g.group || 'global_other';
      (groups[key] ??= []).push(g);
    }
    return groups;
  }, [genres]);

  const artistGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const a = t.artist || 'Unknown';
      if (!map.has(a)) map.set(a, []);
      map.get(a)!.push(t);
    }
    return Array.from(map.entries())
      .map(([artist, songs]) => ({ artist, songs }))
      .sort((a, b) => b.songs.length - a.songs.length);
  }, [tracks]);

  const playPreview = (track: Track) => {
    if (!track.id) return;
    if (audioRef.current) audioRef.current.pause();
    if (audioPlayingId === track.id) { setAudioPlayingId(null); return; }
    const url = `/api/proxy/audio/${track.id}`;
    const audio = new Audio(url);
    audio.volume = settings.masterVolume ?? 0.5;
    audio.addEventListener('error', () => { setAudioPlayingId(null); });
    audio.addEventListener('ended', () => setAudioPlayingId(null));
    audio.play().then(() => { audioRef.current = audio; setAudioPlayingId(track.id); })
      .catch(() => setAudioPlayingId(null));
  };

  const handleSave = async (trackId: string) => {
    if (!selectedGenre) return;
    setSavingId(trackId);
    try {
      await updateAiGenre(trackId, selectedGenre);
      setTracks(prev => prev.filter(t => t.id !== trackId));
      setEditingId(null);
      setSelectedGenre('');
    } catch {}
    setSavingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAiTrack(deleteTarget.id);
      setTracks(prev => prev.filter(t => t.id !== deleteTarget.id));
    } catch {}
    setDeleteTarget(null);
  };

  const toggleArtist = (artist: string) => {
    setCollapsedArtists(prev => {
      const next = new Set(prev);
      next.has(artist) ? next.delete(artist) : next.add(artist);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
        <p className="text-foreground/40 text-xs">Loading triage queue...</p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <span className="text-4xl">✅</span>
        <p className="text-lg font-semibold text-foreground/80">All caught up!</p>
        <p className="text-sm text-foreground/40">No unclassified tracks pending review.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-foreground/50">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} · {artistGroups.length} artist{artistGroups.length !== 1 ? 's' : ''}
        </p>
        <button onClick={loadData} className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)', color: 'color-mix(in srgb, var(--foreground) 60%, transparent)' }}>
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {artistGroups.map(({ artist, songs }) => {
          const collapsed = collapsedArtists.has(artist);
          return (
            <div key={artist} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
              {/* Artist header */}
              <button
                onClick={() => toggleArtist(artist)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer"
              >
                <span className={`text-xs text-foreground/30 transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
                <span className="font-bold text-sm text-foreground/90">{artist}</span>
                <span className="text-[10px] text-foreground/40 bg-white/5 px-2 py-0.5 rounded-full">{songs.length}</span>
              </button>

              {/* Track rows */}
              {!collapsed && (
                <div className="divide-y" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                  {songs.map(track => {
                    const isEditing = editingId === track.id;
                    return (
                      <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.01]">
                        {/* Play */}
                        <button
                          onClick={() => playPreview(track)}
                          disabled={!track.id?.startsWith('deezer:')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ backgroundColor: audioPlayingId === track.id ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
                        >
                          {audioPlayingId === track.id ? '⏹' : '▶️'}
                        </button>

                        {/* Album art */}
                        {track.album_image ? (
                          <img src={track.album_image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }} />
                        )}

                        {/* Track name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{track.name}</p>
                        </div>

                        {/* UNCLASSIFIED pill */}
                        {!isEditing && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider text-foreground/20 border shrink-0" style={{ borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)' }}>
                            UNCLASSIFIED
                          </span>
                        )}

                        {/* Assign / Save */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={selectedGenre}
                              onChange={e => setSelectedGenre(e.target.value)}
                              className="text-[10px] px-2 py-1.5 rounded-lg border outline-none max-w-[140px]"
                              style={{ backgroundColor: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)', color: 'var(--foreground)' }}
                              autoFocus
                            >
                              <option value="">Genre...</option>
                              {Object.entries(groupedGenres).map(([groupKey, gs]) => (
                                <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                                  {gs.map(g => (
                                    <option key={g.id} value={g.id}>{g.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSave(track.id)}
                              disabled={!selectedGenre || savingId === track.id}
                              className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ backgroundColor: 'color-mix(in srgb, #00b894 20%, transparent)', color: '#00b894', border: '1px solid color-mix(in srgb, #00b894 30%, transparent)' }}
                            >
                              {savingId === track.id ? '...' : 'Save'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-1.5 py-1 text-xs text-foreground/40 hover:text-foreground transition-all cursor-pointer">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { setEditingId(track.id); setSelectedGenre(''); }}
                              className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-foreground/40 hover:text-foreground"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: track.id, name: track.name })}
                              className="px-1.5 py-1 text-xs text-red-400/60 hover:text-red-400 transition-all cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Track"
        message={`Permanently remove "${deleteTarget?.name}" from the cache?`}
        confirmLabel="Delete Track"
        destructive
      />
    </>
  );
}
