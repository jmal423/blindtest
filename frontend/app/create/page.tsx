'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket, getApiUrl } from '@/lib/socket';

interface Genre {
  id: string;
  label: string;
}

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${getApiUrl()}/api/genres`)
      .then(res => res.json())
      .then(setGenres)
      .catch(() => setError('Failed to load genres. Is the server running?'));
  }, []);

  const toggleGenre = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createRoom = useCallback(async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (selected.size === 0) { setError('Select at least one genre'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${getApiUrl()}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genres: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create room');
      }

      const { code } = await res.json();
      const socket = getSocket();
      socket.connect();

      await new Promise<void>(resolve => {
        if (socket.connected) {
          resolve();
        } else {
          socket.on('connect', () => resolve());
        }
      });

      socket.emit('join_room', { code, name: name.trim() });
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }, [name, selected, router]);

  return (
    <div className="flex-1 flex flex-col items-center p-8 gap-8 max-w-lg mx-auto w-full">
      <h2 className="text-2xl font-bold">Create a Room</h2>

      <div className="w-full space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Your Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          className="w-full px-4 py-3 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
      </div>

      <div className="w-full space-y-2">
        <label className="text-sm text-zinc-400 font-medium">
          Select Genres ({selected.size} selected)
        </label>
        <div className="flex flex-wrap gap-2">
          {genres.map(g => (
            <button
              key={g.id}
              onClick={() => toggleGenre(g.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selected.has(g.id)
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-zinc-300 hover:bg-[var(--surface-light)] border border-white/10'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <button
        onClick={createRoom}
        disabled={loading}
        className="w-full px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </div>
  );
}
