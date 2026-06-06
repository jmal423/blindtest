'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface RoomSettings {
  rounds: number;
  roundTime: number;
  pauseTime: number;
}

export type GameState =
  | { state: 'waiting'; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number }
  | { state: 'playing'; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; timeLeft: number; previewUrl: string; trackId: string }
  | { state: 'round_result'; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; roundResult: RoundResult }
  | { state: 'finished'; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; rankings: Ranking[] };

export interface Player { id: string; name: string; score: number }
export interface RoundResult { round: number; correctAnswer: string; artist: string; albumImage: string }
export interface Ranking { rank: number; name: string; score: number }

export async function fetchGenres(): Promise<{ id: string; label: string }[]> {
  const res = await fetch(`${API_URL}/api/genres`);
  return res.json();
}

export async function createRoom(
  genres: string[],
  playerName: string,
  settings?: Partial<RoomSettings>
): Promise<{ code: string; playerId: string; settings: RoomSettings }> {
  const res = await fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genres, playerName: playerName.trim(), ...settings }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to create room');
  }
  return res.json();
}

export async function joinRoom(code: string, playerName: string): Promise<{ code: string; playerId: string }> {
  const res = await fetch(`${API_URL}/api/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.toUpperCase(), playerName: playerName.trim() }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Room not found');
  }
  return res.json();
}

export async function startGame(code: string, playerId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/game/${code}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to start');
  }
}

export async function updateSettings(code: string, playerId: string, settings: Partial<RoomSettings>): Promise<RoomSettings> {
  const res = await fetch(`${API_URL}/api/game/${code}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, ...settings }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to update settings');
  }
  return res.json();
}

export async function submitAnswer(code: string, playerId: string, answer: string): Promise<{ correct: boolean; points: number; correctAnswer: string; artist: string }> {
  const res = await fetch(`${API_URL}/api/game/${code}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, answer }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to submit');
  }
  return res.json();
}

export async function fetchGameState(code: string): Promise<GameState> {
  const res = await fetch(`${API_URL}/api/game/${code}`);
  if (!res.ok) throw new Error('Room not found');
  return res.json();
}

export async function checkRoom(code: string): Promise<{ code: string; state: string; playerCount: number }> {
  const res = await fetch(`${API_URL}/api/rooms/${code}`);
  if (!res.ok) throw new Error('Room not found');
  return res.json();
}
