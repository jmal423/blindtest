'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getUnclassifiedTracks, updateAiGenre, deleteAiTrack, fetchGenres } from '@/lib/api';
import { useSettings } from '@/app/context/SettingsContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Track {
  id: string;
  name: string;
  artist: string;
  album_image: string | null;
  rank: number;
  ai_genre?: string;
  deezer_genres?: string[];
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

function SpeedTriage({ tracks, genres, groupedGenres, onDone, onBack }: {
  tracks: Track[];
  genres: { id: string; label: string; group?: string }[];
  groupedGenres: Record<string, typeof genres>;
  onDone: (stats: { saved: number; deleted: number; skipped: number }) => void;
  onBack: () => void;
}) {
  const { settings } = useSettings();
  const [index, setIndex] = useState(0);
  const [genre, setGenre] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ saved: 0, deleted: 0, skipped: 0 });
  const [gameTracks, setGameTracks] = useState(tracks);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [playing, setPlaying] = useState(false);
  const current = gameTracks[index];
  const total = gameTracks.length;
  const done = stats.saved + stats.deleted + stats.skipped;
  const remaining = total - done;
  const rate = elapsed > 0 ? (done / elapsed * 60).toFixed(1) : '0';
  const eta = parseFloat(rate) > 0 ? Math.round(remaining / parseFloat(rate)) : 0;

  // Suggest genre from Deezer tags
  const suggestedGenre = useMemo(() => {
    if (!current?.deezer_genres?.length) return '';
    const tag = current.deezer_genres[0].toLowerCase();
    const map: Record<string, string> = {
      pop: 'US_pop_us', rock: 'US_rock_alternative_us', dance: 'GL_edm_dance',
      'hip-hop': 'US_hip_hop_trap_us', rap: 'US_hip_hop_trap_us', rnb: 'US_pop_us',
      metal: 'GL_metal', jazz: 'GL_jazz_lounge', classical: 'GL_classical',
      reggae: 'GL_reggae', blues: 'GL_jazz_lounge', soul: 'US_pop_us',
      country: 'US_country_americana_us', folk: 'US_rock_alternative_us',
      electronic: 'GL_edm_dance', house: 'GL_edm_dance', techno: 'GL_edm_dance',
      latin: 'ES_reggaeton_urbano', reggaeton: 'ES_reggaeton_urbano',
      kpop: 'GL_kpop', afrobeat: 'GL_afrobeats_african', afrobeats: 'GL_afrobeats_african',
      children: 'GL_kids_family', kids: 'GL_kids_family', family: 'GL_kids_family',
      indian: 'GL_indian', bollywood: 'GL_indian', soundtrack: 'GL_soundtracks',
      chanson: 'FR_chanson_francaise', 'variété': 'FR_chanson_francaise',
      fado: 'PT_fado', samba: 'BR_samba_pagode', bossa: 'BR_bossa_nova',
      kizomba: 'PT_kizomba_palop', kuduro: 'PT_kizomba_palop',
    };
    for (const [key, val] of Object.entries(map)) {
      if (tag.includes(key)) return val;
    }
    return '';
  }, [current]);

  useEffect(() => { if (suggestedGenre && !genre) setGenre(suggestedGenre); }, [suggestedGenre]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  useEffect(() => {
    if (current && selectRef.current) selectRef.current.focus();
  }, [current]);

  const playAudio = useCallback(async (track: Track) => {
    if (audioRef.current) audioRef.current.pause();
    if (playing && audioRef.current?.dataset?.trackId === track.id) { setPlaying(false); return; }
    const url = `/api/proxy/audio/${track.id}`;
    const audio = new Audio(url);
    audio.volume = settings.masterVolume ?? 0.5;
    audio.dataset.trackId = track.id;
    audio.addEventListener('error', () => setPlaying(false));
    audio.addEventListener('ended', () => setPlaying(false));
    try { await audio.play(); audioRef.current = audio; setPlaying(true); }
    catch { setPlaying(false); }
  }, [settings.masterVolume, playing]);

  const handleSave = async () => {
    if (!genre || !current) return;
    setSaving(true);
    try {
      const res = await updateAiGenre(current.id, genre);
      if (res.ok) {
        setStats(p => ({ ...p, saved: p.saved + 1 }));
        setGenre('');
        if (index < gameTracks.length - 1) { setIndex(i => i + 1); }
        else { setGameTracks(prev => prev.filter((_, i) => i !== index)); }
      }
    } catch {}
    setSaving(false);
  };

  const handleSkip = () => {
    setStats(p => ({ ...p, skipped: p.skipped + 1 }));
    setGenre('');
    if (index < gameTracks.length - 1) setIndex(i => i + 1);
    else setGameTracks(prev => prev.filter((_, i) => i !== index));
  };

  const handleDelete = async () => {
    if (!current) return;
    try {
      await deleteAiTrack(current.id);
      setStats(p => ({ ...p, deleted: p.deleted + 1 }));
      setGenre('');
      if (index < gameTracks.length - 1) setIndex(i => i + 1);
      else setGameTracks(prev => prev.filter((_, i) => i !== index));
    } catch {}
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); playAudio(current); }
      if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDelete(); }
      if (e.key === 'Escape') { e.preventDefault(); handleSkip(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (gameTracks.length === 0) {
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(totalTime / 60);
    const s = totalTime % 60;
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold">Speed Triage Complete!</p>
        <div className="grid grid-cols-3 gap-6 mt-4 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: '#00b894' }}>{stats.saved}</p>
            <p className="text-xs text-foreground/40">Assigned</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground/60">{stats.skipped}</p>
            <p className="text-xs text-foreground/40">Skipped</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{stats.deleted}</p>
            <p className="text-xs text-foreground/40">Deleted</p>
          </div>
        </div>
        <p className="text-xs text-foreground/40 mt-2">{m}:{s.toString().padStart(2, '0')} total</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onBack} className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 transition-all">Back to Browse</button>
          <button onClick={() => { setIndex(0); setStats({ saved: 0, deleted: 0, skipped: 0 }); setGameTracks(tracks); setElapsed(0); }}
            className="px-4 py-2 text-sm rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
            Start Over
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col items-center py-6 max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="w-full mb-6">
        <div className="flex justify-between text-xs text-foreground/50 mb-1.5">
          <span>{done}/{total} done</span>
          <span>{rate}/min · ETA {Math.floor(eta / 60)}m{eta % 60}s</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {/* Track info */}
      <div className="w-full rounded-2xl p-6 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
        {current.album_image ? (
          <img src={current.album_image} alt="" className="w-32 h-32 rounded-2xl object-cover mx-auto shadow-lg mb-4" />
        ) : (
          <div className="w-32 h-32 rounded-2xl mx-auto mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }} />
        )}
        <h3 className="text-lg font-bold">{current.name}</h3>
        <p className="text-sm text-foreground/60 mb-4">{current.artist}</p>
        <p className="text-[10px] text-foreground/30 mb-2">#{current.rank?.toLocaleString() || '?'} on Deezer</p>

        {/* Deezer genre hints */}
        {current.deezer_genres?.length > 0 && (
          <div className="flex gap-1.5 justify-center flex-wrap mb-4">
            {current.deezer_genres.map(g => (
              <span key={g} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-foreground/50 border border-white/[0.02]">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Suggested genre badge */}
        {suggestedGenre && (
          <p className="text-[10px] mb-3">
            <span className="text-foreground/40">Suggested: </span>
            <span className="font-bold text-[var(--accent)]">{suggestedGenre}</span>
          </p>
        )}

        {/* Play button */}
        <button onClick={() => playAudio(current)}
          className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 transition-all"
          style={{ backgroundColor: playing ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--foreground) 8%, transparent)' }}>
          <span className="text-lg">{playing ? '⏹' : '▶️'}</span>
        </button>

        {/* Genre selector */}
        <select ref={selectRef} value={genre} onChange={e => setGenre(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--foreground) 15%, transparent)', color: 'var(--foreground)' }}>
          <option value="">— Select genre —</option>
          {Object.entries(groupedGenres).map(([groupKey, gs]) => (
            <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
              {gs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button onClick={handleSkip} className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-white/10 text-foreground/60 hover:text-foreground transition-all">
            Skip ⏭
          </button>
          <button onClick={handleSave} disabled={!genre || saving}
            className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all disabled:opacity-30"
            style={{ backgroundColor: 'color-mix(in srgb, #00b894 20%, transparent)', color: '#00b894', border: '1px solid color-mix(in srgb, #00b894 30%, transparent)' }}>
            {saving ? '...' : 'Save ✅'}
          </button>
          <button onClick={handleDelete} className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/30 transition-all">
            Delete 🗑
          </button>
        </div>

        <p className="text-[10px] text-foreground/30 mt-3">Space=Play · Enter=Save · Del=Delete · Esc=Skip</p>
      </div>
    </div>
  );
}

export default function TriagePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [genres, setGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'browse' | 'speed'>('browse');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [collapsedArtists, setCollapsedArtists] = useState<Set<string>>(new Set());
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, genreData] = await Promise.all([getUnclassifiedTracks(), fetchGenres()]);
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
    return Array.from(map.entries()).map(([artist, songs]) => ({ artist, songs })).sort((a, b) => b.songs.length - a.songs.length);
  }, [tracks]);

  const playPreview = (track: Track) => {
    if (audioRef.current) audioRef.current.pause();
    if (audioPlayingId === track.id) { setAudioPlayingId(null); return; }
    const url = `/api/proxy/audio/${track.id}`;
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.addEventListener('error', () => setAudioPlayingId(null));
    audio.addEventListener('ended', () => setAudioPlayingId(null));
    audio.play().then(() => { audioRef.current = audio; setAudioPlayingId(track.id); }).catch(() => setAudioPlayingId(null));
  };

  const handleSave = async (trackId: string) => {
    if (!selectedGenre) return;
    try {
      const res = await updateAiGenre(trackId, selectedGenre);
      if (res.ok) {
        setTracks(prev => prev.filter(t => t.id !== trackId));
        setEditingId(null);
        setSelectedGenre('');
        setSuccessMsg('Genre assigned!');
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch {}
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteAiTrack(deleteTarget.id); setTracks(prev => prev.filter(t => t.id !== deleteTarget.id)); } catch {}
    setDeleteTarget(null);
  };

  const handleSpeedDone = () => { loadData(); };

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

  if (mode === 'speed') {
    return (
      <SpeedTriage
        tracks={tracks}
        genres={genres}
        groupedGenres={groupedGenres}
        onDone={handleSpeedDone}
        onBack={() => {
          setMode('browse');
          loadData();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="px-4 py-2 rounded-lg text-xs font-bold text-center" style={{ backgroundColor: 'color-mix(in srgb, #00b894 15%, transparent)', color: '#00b894' }}>
          {successMsg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-foreground/50">
          {tracks.length} unclassified · {artistGroups.length} artists
        </p>
        <div className="flex gap-2">
          <button onClick={loadData} className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)', color: 'color-mix(in srgb, var(--foreground) 60%, transparent)' }}>
            Refresh
          </button>
          <button onClick={() => setMode('speed')}
            className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
            ⚡ Speed Triage
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {artistGroups.map(({ artist, songs }) => {
          const collapsed = collapsedArtists.has(artist);
          return (
            <div key={artist} className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
              <button onClick={() => setCollapsedArtists(prev => { const n = new Set(prev); n.has(artist) ? n.delete(artist) : n.add(artist); return n; })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.01] transition-all text-left">
                <span className={`text-xs text-foreground/30 transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
                <span className="font-bold text-sm text-foreground/90">{artist}</span>
                <span className="text-[10px] text-foreground/40 bg-white/5 px-2 py-0.5 rounded-full">{songs.length}</span>
              </button>

              {!collapsed && (
                <div className="divide-y" style={{ borderTop: '1px solid color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                  {songs.map(track => {
                    const isEditing = editingId === track.id;
                    return (
                      <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.01]">
                        <button onClick={() => playPreview(track)} disabled={!track.id?.startsWith('deezer:')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ backgroundColor: audioPlayingId === track.id ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                          {audioPlayingId === track.id ? '⏹' : '▶️'}
                        </button>

                        {track.album_image ? (
                          <img src={track.album_image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }} />
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{track.name}</p>
                        </div>

                        {/* Current genre badge */}
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border shrink-0"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                            color: 'var(--accent)',
                            borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                          }}>
                          UNCLASSIFIED
                        </span>

                        {/* Deezer tags */}
                        {track.deezer_genres?.length > 0 && !isEditing && (
                          <div className="hidden sm:flex gap-1 shrink-0">
                            {track.deezer_genres.slice(0, 2).map(g => (
                              <span key={g} className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-white/5 text-foreground/40 border border-white/[0.02]">{g}</span>
                            ))}
                          </div>
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)}
                              className="text-[10px] px-2 py-1.5 rounded-lg border outline-none max-w-[140px]"
                              style={{ backgroundColor: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)', color: 'var(--foreground)' }} autoFocus>
                              <option value="">Genre...</option>
                              {Object.entries(groupedGenres).map(([groupKey, gs]) => (
                                <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                                  {gs.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <button onClick={() => handleSave(track.id)} disabled={!selectedGenre}
                              className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-30"
                              style={{ backgroundColor: 'color-mix(in srgb, #00b894 20%, transparent)', color: '#00b894', border: '1px solid color-mix(in srgb, #00b894 30%, transparent)' }}>
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-1.5 py-1 text-xs text-foreground/40 hover:text-foreground transition-all cursor-pointer">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => { setEditingId(track.id); setSelectedGenre(''); }}
                              className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-foreground/40 hover:text-foreground"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}>
                              Assign
                            </button>
                            <button onClick={() => setDeleteTarget({ id: track.id, name: track.name })}
                              className="px-1.5 py-1 text-xs text-red-400/60 hover:text-red-400 transition-all cursor-pointer">🗑️</button>
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

      <ConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete}
        title="Delete Track" message={`Permanently remove "${deleteTarget?.name}" from the cache?`} confirmLabel="Delete Track" destructive />
    </div>
  );
}
