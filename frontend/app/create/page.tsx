'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/api';

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }

    setLoading(true);
    setError('');

    try {
      const { code, playerId } = await createRoom(name);
      localStorage.setItem(`blindtest_player_${code}`, playerId);
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-sm mx-auto w-full">
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </div>
  );
}
