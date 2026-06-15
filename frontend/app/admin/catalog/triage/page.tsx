'use client';

import { useState, useEffect, useRef } from 'react';
import { getUnclassifiedTracks, updateAiGenre, deleteAiTrack, fetchGenres } from '@/lib/api';
import { getProxiedUrl } from '@/lib/proxy';
import { DataTable } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Track {
  id: string;
  name: string;
  artist: string;
  album_image: string | null;
  preview_url: string | null;
  rank: number;
}

export default function TriagePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [genres, setGenres] = useState<{ id: string; label: string; group?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
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

  useEffect(() => {
    loadData();
  }, []);

  const playPreview = (track: Track) => {
    const url = getProxiedUrl(track.preview_url);
    if (!url) return;
    if (audioRef.current) audioRef.current.pause();
    if (audioPlayingId === track.id) { setAudioPlayingId(null); return; }
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.addEventListener('ended', () => setAudioPlayingId(null));
    audioRef.current = audio;
    setAudioPlayingId(track.id);
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
    setSavingId(deleteTarget.id);
    try {
      await deleteAiTrack(deleteTarget.id);
      setTracks(prev => prev.filter(t => t.id !== deleteTarget.id));
    } catch {}
    setSavingId(null);
    setDeleteTarget(null);
  };

  const labelMap = Object.fromEntries(genres.map(g => [g.id, g.label]));

  const columns = [
    {
      key: 'play',
      label: '',
      sortable: false,
      render: (track: Track) => (
        <button
          onClick={() => playPreview(track)}
          disabled={!track.preview_url}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ backgroundColor: audioPlayingId === track.id ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
        >
          {audioPlayingId === track.id ? '⏹' : '▶️'}
        </button>
      ),
    },
    {
      key: 'name',
      label: 'Track',
      render: (track: Track) => (
        <div className="flex items-center gap-2.5">
          {track.album_image ? (
            <img src={track.album_image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }} />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate max-w-[200px]">{track.name}</p>
            <p className="text-[11px] text-foreground/50 truncate max-w-[200px]">{track.artist}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'genre',
      label: 'Current',
      render: () => (
        <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-foreground/30 border" style={{ borderColor: 'color-mix(in srgb, var(--foreground) 10%, transparent)' }}>
          UNCLASSIFIED
        </span>
      ),
    },
    {
      key: 'assign',
      label: 'Assign Genre',
      sortable: false,
      render: (track: Track) => {
        const isEditing = editingId === track.id;
        return isEditing ? (
          <div className="flex items-center gap-1.5">
            <select
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border outline-none max-w-[150px]"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)', color: 'var(--foreground)' }}
              autoFocus
            >
              <option value="">Genre...</option>
              {genres.filter(g => g.id !== 'UNCLASSIFIED').map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
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
            <button onClick={() => setEditingId(null)} className="px-1.5 py-1.5 text-xs text-foreground/40 hover:text-foreground transition-all cursor-pointer">✕</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingId(track.id); setSelectedGenre(''); }}
            className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-foreground/40 hover:text-foreground"
            style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)' }}
          >
            Assign
          </button>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (track: Track) => (
        <div className="flex justify-end">
          <button
            onClick={() => setDeleteTarget({ id: track.id, name: track.name })}
            className="px-2 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-all cursor-pointer"
            title="Delete track"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-foreground/50">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} pending classification
        </p>
        <button onClick={loadData} className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer" style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)', color: 'color-mix(in srgb, var(--foreground) 60%, transparent)' }}>
          Refresh
        </button>
      </div>

      <DataTable
        columns={columns}
        data={tracks}
        keyField="id"
        searchable
        searchPlaceholder="Search by song name or artist..."
        pageSize={50}
        loading={loading}
        emptyMessage="All caught up! No unclassified tracks pending review."
      />

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
