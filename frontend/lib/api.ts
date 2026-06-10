'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface RoomSettings {
  rounds: number;
  roundTime: number;
  pauseTime: number;
  autoStart: boolean;
  audioSource: 'deezer';
}

export type GameState =
  | { state: 'waiting'; hostId: string | null; genres: string[]; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number }
  | { state: 'round_preparing'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; roundTime: number; previewUrl: string | null; skipVotes: number; skipVotesNeeded: number }
  | { state: 'playing'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; timeLeft: number; roundTime: number; trackId: string; skipVotes: number; skipVotesNeeded: number }
  | { state: 'round_result'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; roundResult: RoundResult; pauseTimeLeft: number; trackHistory: TrackEntry[] }
  | { state: 'game_over'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; rankings: Ranking[]; trackHistory: TrackEntry[] };

export interface Player { id: string; name: string; score: number; avatarUrl?: string | null; role?: string; foundArtist?: boolean; foundTitle?: boolean; foundBoth?: boolean }
export interface RoundResult { round: number; correctAnswer: string; artist: string; albumImage: string }
export interface Ranking { rank: number; name: string; score: number; xp: number; answers?: any[] }
export interface TrackEntry { round: number; name: string; artist: string; albumImage?: string | null; rank?: number; skipped?: boolean }

export async function fetchGenres(): Promise<{ id: string; label: string; group?: string }[]> {
  const res = await fetch(`${API_URL}/api/genres`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.genres;
}

export async function fetchGenreGroups(): Promise<{ genres: { id: string; label: string; group?: string }[]; groups: { id: string; genreIds: string[] }[] }> {
  const res = await fetch(`${API_URL}/api/genres`);
  const data = await res.json();
  if (Array.isArray(data)) {
    return { genres: data, groups: [] };
  }
  return data;
}

export async function createRoom(
  genres?: string[],
): Promise<{ code: string; playerId: string; settings: RoomSettings; genres: string[] }> {
  const token = getToken();
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ genres }),
  });
  if (!res.ok) {
    const data = await res.json();
      throw new Error(`Create room failed: ${data.error || res.status}`);
  }
  return res.json();
}

export async function joinRoom(code: string): Promise<{ code: string; playerId: string }> {
  const token = getToken();
  if (!token) throw new Error('Authentication required');
  const res = await fetch(`${API_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: code.toUpperCase() }),
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

export async function updateSettings(code: string, playerId: string, settings: Partial<RoomSettings> & { genres?: string[] }): Promise<RoomSettings> {
  const res = await fetch(`${API_URL}/api/game/${code}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, ...settings }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Update settings failed: ${data.error || res.status}`);
  }
  return res.json();
}

export async function checkRoom(code: string): Promise<{ code: string; state: string; playerCount: number }> {
  const res = await fetch(`${API_URL}/api/rooms/${code}`);
  if (!res.ok) throw new Error('Room not found');
  return res.json();
}

// Auth
export function getDiscordAuthUrl(redirect?: string) {
  const base = `${API_URL}/api/auth/discord`;
  if (redirect) {
    return `${base}?redirect=${encodeURIComponent(redirect)}`;
  }
  return base;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('blindtest_token');
}

export async function fetchWithAuth(url: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('blindtest_token');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  game_code: string;
  score: number;
  total_rounds: number;
  played_at: string;
}

export interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

export async function getMe(): Promise<User> {
  return fetchWithAuth(`${API_URL}/api/users/me`);
}

export async function getMyScores(): Promise<GameScore[]> {
  return fetchWithAuth(`${API_URL}/api/users/me/scores`);
}

export async function getUserProfile(id: string): Promise<User & { scores: GameScore[]; bestScore: number }> {
  const res = await fetch(`${API_URL}/api/users/${id}`);
  if (!res.ok) throw new Error('User not found');
  return res.json();
}

export async function getLeaderboard(): Promise<{ id: string; username: string; player_name: string; avatar_url: string; total_score: number; games_played: number; avg_score: number; best_score: number; wins: number }[]> {
  const res = await fetch(`${API_URL}/api/leaderboard`);
  return res.json();
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const res = await fetch(`${API_URL}/api/users/${userId}/stats`);
  if (!res.ok) throw new Error('Failed to fetch user stats');
  return res.json();
}

export async function getFriends(): Promise<{ friends: Friend[]; pending: Friend[] }> {
  return fetchWithAuth(`${API_URL}/api/friends`);
}

export async function sendFriendRequest(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/friends/request/${userId}`, { method: 'POST' });
}

export async function acceptFriendRequest(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/friends/accept/${userId}`, { method: 'POST' });
}

export async function removeFriend(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/friends/${userId}`, { method: 'DELETE' });
}

export interface UserStats {
  totalPoints: number;
  averageSpeedMs: number | null;
  bestGenre: string | null;
  gamesPlayed: number;
  avgScore: number;
  bestScore: number;
  totalRounds: number;
  roundPoints: number;
  perfects: number;
}

export async function getMyStats(): Promise<UserStats> {
  return fetchWithAuth(`${API_URL}/api/users/me/stats`);
}

export async function saveGameScore(code: string, playerId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/game/${code}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
}

export async function getAdminStats(): Promise<{ totalUsers: number; totalRounds: number; totalGames: number; activeRooms: number }> {
  return fetchWithAuth(`${API_URL}/api/admin/stats`);
}

export async function getAdminRooms(): Promise<{ code: string; state: string; players: number; genres: string[]; currentRound: number; totalRounds: number; settings: any }[]> {
  return fetchWithAuth(`${API_URL}/api/admin/rooms`);
}

export async function testGenre(genre: string, count: number = 5): Promise<{ ok: boolean; count: number; tracks: { name: string; artist: string; previewUrl: boolean; genre: string }[]; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/test/genre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genre, count }),
  });
}

export async function wipeUserScores(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/admin/users/${userId}/scores`, { method: 'DELETE' });
}

export async function getAdminUsers(): Promise<User[]> {
  return fetchWithAuth(`${API_URL}/api/admin/users`);
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

export async function testDeezer(): Promise<{ label: string; status: number | string; ok: boolean; ms: number; error?: string }[]> {
  return fetchWithAuth(`${API_URL}/api/admin/test/deezer`, { method: 'POST' });
}

export async function testDeezerGenre(genre: string, count: number = 10): Promise<{ ok: boolean; count: number; previewCount: number; latencyMs: number; tracks: { name: string; artist: string; previewUrl: boolean; durationMs: number; id: string; rank: number }[]; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/test/deezer/genre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genre, count }),
  });
}

export async function getDbStatus(): Promise<{ ok: boolean; isPostgres: boolean; hasData: boolean; tables: { users: number; game_scores: number; round_results: number }; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/db-status`);
}

export async function deleteUser(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
}

export async function getSongCache(): Promise<{ total: number; genreCount: number; plays: number; genres: { genre: string; count: number; last_fetched: string }[]; played: { id: string; name: string; artist: string; genre: string; genres: string[]; chartSource: string | null; rank: number; play_count: number; last_played: string }[] }> {
  return fetchWithAuth(`${API_URL}/api/admin/song-cache`);
}

export async function getAiStats(): Promise<{
  ok: boolean;
  total: number;
  unprocessed: number;
  errors: number;
  processed: number;
  last_processed: string | null;
  distribution: { genre: string; count: number }[];
  unprocessedTracks: { id: string; name: string; artist: string; genre: string; genres: string[]; chart_source: string; rank: number }[];
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/stats`);
}

export async function searchAiTracks(q: string, limit = 20): Promise<{
  ok: boolean;
  tracks: { id: string; name: string; artist: string; genre: string; ai_genres: string[]; ai_tags: string[]; ai_confidence: Record<string, number>; ai_processed_at: string }[];
  error?: string;
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}
