'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoom } from '@/lib/api';

export default function JoinRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter a room code'); return; }

    setLoading(true);
    setError('');

    try {
      const { code: roomCode, playerId } = await joinRoom(code, name);
      localStorage.setItem(`blindtest_player_${roomCode}`, playerId);
      router.push(`/game/${roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-sm mx-auto w-full">
      <h2 className="text-2xl font-bold">Join a Room</h2>

      <div className="w-full space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-zinc-400 font-medium">Room Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD"
            maxLength={4}
            className="w-full px-4 py-3 bg-[var(--surface)] border border-white/10 rounded-xl text-white placeholder-zinc-500 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-[var(--primary)] transition-colors uppercase"
          />
        </div>

        <div className="space-y-2">
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
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>
    </div>
  );
}
