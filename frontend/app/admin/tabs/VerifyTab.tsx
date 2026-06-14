'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUnverifiedSongs,
  verifyCuratedSong,
  updateCuratedSongGenre,
  deleteCuratedSong,
  fetchGenres,
} from '@/lib/api';
import { useAdminAudio } from '../hooks/useAdminAudio';

const PAGE_SIZE = 50;

type UnverifiedSong = {
  id: string;
  name: string;
  artist: string;
  genre: string;
  played_count: number;
  verified: boolean;
  curated_at: string;
  has_preview: boolean;
  preview_url: string | null;
};

export function VerifyTab() {
  const [songs, setSongs] = useState<UnverifiedSong[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [allGenres, setAllGenres] = useState<{ id: string; label: string }[]>([]);
  const [updatingGenre, setUpdatingGenre] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { playingTrackId, togglePreview, AudioPlayerOverlay, stopPreview } = useAdminAudio();

  const load = useCallback(async (pg = 0, q = search) => {
    setLoading(true);
    setBulkSelected(new Set());
    try {
      const result = await getUnverifiedSongs({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE, search: q || undefined });
      setSongs(result.songs);
      setTotal(result.total);
    } catch {
      setSongs([]);
      setTotal(0);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load(0, search);
    fetchGenres().then(setAllGenres).catch(() => {});
  }, []);

  // Debounced search
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
      load(0, val);
    }, 400);
  };

  const handleVerify = async (song: UnverifiedSong) => {
    setVerifyingId(song.id);
    try {
      await verifyCuratedSong(song.id, true);
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(prev => Math.max(0, prev - 1));
      if (playingTrackId === song.id) stopPreview();
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async (song: UnverifiedSong) => {
    if (!confirm(`Remove "${song.name}" from the curated list?`)) return;
    setDeletingId(song.id);
    try {
      await deleteCuratedSong(song.id);
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(prev => Math.max(0, prev - 1));
      if (playingTrackId === song.id) stopPreview();
    } catch (err: any) {
      alert(err.message || 'Failed to delete song');
    } finally {
      setDeletingId(null);
    }
  };

  const handleChangeGenre = async (songId: string, newGenre: string) => {
    setUpdatingGenre(songId);
    try {
      await updateCuratedSongGenre(songId, newGenre);
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, genre: newGenre } : s));
    } finally {
      setUpdatingGenre(null);
    }
  };

  const handleBulkVerify = async () => {
    if (bulkSelected.size === 0) return;
    setBulkVerifying(true);
    const ids = Array.from(bulkSelected);
    try {
      await Promise.all(ids.map(id => verifyCuratedSong(id, true)));
      setSongs(prev => prev.filter(s => !bulkSelected.has(s.id)));
      setTotal(prev => Math.max(0, prev - ids.length));
      setBulkSelected(new Set());
    } finally {
      setBulkVerifying(false);
    }
  };

  const toggleSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (bulkSelected.size === songs.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(songs.map(s => s.id)));
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    load(newPage);
  };

  return (
    <div className="space-y-6">
      {AudioPlayerOverlay}

      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div
          className="rounded-2xl p-5 flex flex-col gap-1 border border-white/5"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)' }}
        >
          <span className="text-2xl font-black tabular-nums" style={{ color: '#f59e0b' }}>
            {loading ? '…' : total.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Awaiting Review</span>
        </div>
        <div
          className="rounded-2xl p-5 flex flex-col gap-1 border border-white/5"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)' }}
        >
          <span className="text-2xl font-black tabular-nums" style={{ color: '#10b981' }}>
            {bulkSelected.size}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Selected</span>
        </div>
        <div
          className="rounded-2xl p-5 flex flex-col gap-1 border border-white/5 col-span-2 sm:col-span-1"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)' }}
        >
          <span className="text-2xl font-black tabular-nums" style={{ color: '#8b5cf6' }}>
            {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Page</span>
        </div>
      </div>

      {/* Main panel */}
      <div className="bg-surface/20 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-lg space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4 border-b border-white/5">
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs">⚑</span>
              Unverified Songs
            </h3>
            <p className="text-[10px] text-foreground/40 mt-0.5">
              Review songs flagged in-game or newly imported. Listen, approve or remove.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-foreground/30 text-xs">🔍</span>
            <input
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search title or artist..."
              className="w-full pl-8 pr-3 py-2 bg-black/30 border border-white/5 rounded-xl text-foreground placeholder-foreground/30 focus:outline-none focus:border-[var(--primary)] transition-all text-xs"
            />
          </div>

          {/* Bulk actions */}
          {bulkSelected.size > 0 && (
            <button
              onClick={handleBulkVerify}
              disabled={bulkVerifying}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-xs font-bold disabled:opacity-50"
            >
              {bulkVerifying ? (
                <span className="inline-block w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : '✓'}
              Verify {bulkSelected.size} selected
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
            <p className="text-foreground/40 text-xs">Loading unverified songs...</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">✅</span>
            <p className="text-foreground/60 font-semibold text-sm">All clear!</p>
            <p className="text-foreground/30 text-xs">
              {search ? 'No songs matching your search.' : 'No unverified songs. Great curation!'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-xl">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10 text-foreground/40 border-b border-white/5">
                <tr>
                  <th className="py-3 px-3 text-center w-8">
                    <input
                      type="checkbox"
                      checked={bulkSelected.size === songs.length && songs.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-[var(--primary)] cursor-pointer w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3 px-3 w-10 text-center">▶</th>
                  <th className="py-3 px-3 text-left">Track</th>
                  <th className="py-3 px-3 text-left">Artist</th>
                  <th className="py-3 px-3 text-left w-44">Genre</th>
                  <th className="py-3 px-3 text-right w-14 hidden sm:table-cell">Plays</th>
                  <th className="py-3 px-3 text-center w-20">Added</th>
                  <th className="py-3 px-3 text-center w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr
                    key={song.id}
                    className={`border-b border-white/[0.03] transition-colors ${bulkSelected.has(song.id) ? 'bg-[var(--primary)]/5' : 'hover:bg-white/[0.015]'}`}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(song.id)}
                        onChange={() => toggleSelect(song.id)}
                        className="accent-[var(--primary)] cursor-pointer w-3.5 h-3.5"
                      />
                    </td>

                    {/* Audio preview */}
                    <td className="py-2.5 px-3 text-center">
                      {song.preview_url ? (
                        <button
                          onClick={() => togglePreview(song.id, song.preview_url!)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all text-xs ${
                            playingTrackId === song.id
                              ? 'bg-[var(--accent)] text-black shadow-md scale-105'
                              : 'bg-white/5 text-foreground/70 hover:bg-white/10 hover:text-foreground'
                          }`}
                          title={playingTrackId === song.id ? 'Pause' : 'Play'}
                        >
                          {playingTrackId === song.id ? '⏸' : '▶'}
                        </button>
                      ) : (
                        <span className="text-foreground/20 text-[10px]" title="No audio preview">✗</span>
                      )}
                    </td>

                    {/* Track name */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground/90 truncate max-w-[180px]">{song.name}</div>
                    </td>

                    {/* Artist */}
                    <td className="py-2.5 px-3 text-foreground/60 truncate max-w-[130px]">{song.artist}</td>

                    {/* Genre */}
                    <td className="py-2.5 px-3">
                      <select
                        value={song.genre}
                        onChange={e => handleChangeGenre(song.id, e.target.value)}
                        disabled={updatingGenre === song.id}
                        className="text-[10px] bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-foreground/80 focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 w-full max-w-[160px]"
                      >
                        {allGenres.map(g => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Plays */}
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground/50 hidden sm:table-cell font-mono">
                      {song.played_count}
                    </td>

                    {/* Added date */}
                    <td className="py-2.5 px-3 text-center text-foreground/30 text-[10px] whitespace-nowrap">
                      {new Date(song.curated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* Verify */}
                        <button
                          onClick={() => handleVerify(song)}
                          disabled={verifyingId === song.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/30 transition-all font-bold disabled:opacity-40"
                          title="Mark as Verified"
                        >
                          {verifyingId === song.id ? (
                            <span className="inline-block w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          ) : (
                            <span>✓</span>
                          )}
                          <span>Verify</span>
                        </button>

                        {/* Reject / Delete */}
                        <button
                          onClick={() => handleReject(song)}
                          disabled={deletingId === song.id}
                          className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center disabled:opacity-40"
                          title="Remove from Curation"
                        >
                          {deletingId === song.id ? (
                            <span className="inline-block w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : '🗑'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-foreground/30">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()} songs
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-foreground/50 hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-30 text-xs"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Smart page window
                let start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const pg = start + i;
                return (
                  <button
                    key={pg}
                    onClick={() => handlePageChange(pg)}
                    className={`w-7 h-7 rounded-lg border text-xs transition-all font-semibold ${
                      pg === page
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'bg-white/5 border-white/10 text-foreground/50 hover:text-foreground hover:bg-white/10'
                    }`}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-foreground/50 hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-30 text-xs"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
