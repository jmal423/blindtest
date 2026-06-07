'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface RoomSettings {
  rounds: number;
  roundTime: number;
  pauseTime: number;
  autoStart: boolean;
  audioSource: 'spotify' | 'youtube' | 'both';
}

export type GameState =
  | { state: 'waiting'; hostId: string | null; genres: string[]; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number }
  | { state: 'round_preparing'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; roundTime: number; previewUrl: string | null; youtubeVideoId: string | null; audioOffset: number }
  | { state: 'playing'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; timeLeft: number; roundTime: number; youtubeVideoId: string | null; trackId: string }
  | { state: 'round_result'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; roundResult: RoundResult; pauseTimeLeft: number; trackHistory: TrackEntry[] }
  | { state: 'game_over'; hostId: string | null; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number; rankings: Ranking[]; trackHistory: TrackEntry[] };

export interface Player { id: string; name: string; score: number; avatarUrl?: string | null; role?: string; foundArtist?: boolean; foundTitle?: boolean; foundBoth?: boolean }
export interface RoundResult { round: number; correctAnswer: string; artist: string; albumImage: string }
export interface Ranking { rank: number; name: string; score: number; xp: number; answers?: any[] }
export interface TrackEntry { round: number; name: string; artist: string; albumImage?: string }

export async function fetchGenres(): Promise<{ id: string; label: string }[]> {
  const res = await fetch(`${API_URL}/api/genres`);
  return res.json();
}

export async function createRoom(
  playerName: string,
  genres?: string[],
  avatarUrl?: string | null,
  role?: string
): Promise<{ code: string; playerId: string; settings: RoomSettings; genres: string[] }> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ genres, playerName: playerName.trim(), avatarUrl, role }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Create room failed: ${data.error || res.status}`);
  }
  return res.json();
}

export async function joinRoom(code: string, playerName: string, avatarUrl?: string | null, role?: string): Promise<{ code: string; playerId: string }> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ code: code.toUpperCase(), playerName: playerName.trim(), avatarUrl, role }),
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

export async function searchYouTube(name: string, artist: string): Promise<{ videoId: string | null; name: string; artist: string }> {
  const res = await fetch(`${API_URL}/api/youtube/search?name=${encodeURIComponent(name)}&artist=${encodeURIComponent(artist)}`);
  if (!res.ok) throw new Error('YouTube search failed');
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

export async function getLeaderboard(): Promise<{ id: string; username: string; avatar_url: string; total_score: number; games_played: number }[]> {
  const res = await fetch(`${API_URL}/api/leaderboard`);
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

export async function guestLogin(name: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_URL}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Guest login failed');
  }
  return res.json();
}

export async function getAdminStats(): Promise<{ totalUsers: number; totalRounds: number }> {
  return fetchWithAuth(`${API_URL}/api/admin/stats`);
}

export async function testSpotify(): Promise<{ ok: boolean; status?: number; categories?: string[]; error?: string | null }> {
  return fetchWithAuth(`${API_URL}/api/admin/test/spotify`, { method: 'POST' });
}

export async function testGenre(genre: string): Promise<{ ok: boolean; count: number; tracks: { name: string; artist: string; previewUrl: boolean; genre: string }[]; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/test/genre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ genre }),
  });
}

export async function testYouTube(name: string, artist: string): Promise<{ ok: boolean; videoId: string | null; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/test/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, artist }),
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

export async function deleteUser(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
}
