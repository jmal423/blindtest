'use client';

import { IS_MOCK, MOCK_TOKEN, MOCK_LEADERBOARD, MOCK_STATS } from './mock';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export { API_URL };

export interface RoomSettings {
  rounds: number;
  roundTime: number;
  pauseTime: number;
  autoStart: boolean;
  audioSource: 'deezer';
  gameMode: 'genre' | 'artist';
}

export type GameState =
  | { state: 'waiting'; hostId: string | null; genres: string[]; artists: string[]; settings: RoomSettings; players: Player[]; currentRound: number; totalRounds: number }
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

export async function findRoomByChannelId(channelId: string): Promise<{ code: string | null; state?: string; playerCount?: number }> {
  const token = getToken();
  if (!token) return { code: null };
  if (IS_MOCK) return { code: 'MOCK', state: 'waiting', playerCount: 3 };
  try {
    const res = await fetch(`${API_URL}/api/rooms/by-channel/${channelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { code: null };
    return res.json();
  } catch {
    return { code: null };
  }
}

export async function createRoom(
  genres?: string[],
  artists?: string[],
  gameMode?: 'genre' | 'artist',
  discordChannelId?: string
): Promise<{ code: string; playerId: string; settings: RoomSettings; genres: string[]; artists: string[] }> {
  const token = getToken();
  if (!token) throw new Error('Authentication required');
  if (IS_MOCK) return { code: 'MOCK', playerId: 'mock-player-1', settings: { rounds: 10, roundTime: 15, pauseTime: 5, autoStart: false, audioSource: 'deezer', gameMode: gameMode || 'genre' }, genres: genres || [], artists: artists || [] };
  const res = await fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ genres, artists, gameMode, discordChannelId }),
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
  if (IS_MOCK) return { code: code.toUpperCase(), playerId: 'mock-player-1' };
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

export async function updateSettings(code: string, playerId: string, settings: Partial<RoomSettings> & { genres?: string[]; artists?: string[] }): Promise<RoomSettings> {
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
  const stored = localStorage.getItem('blindtest_token');
  if (stored) return stored;
  if (IS_MOCK) return MOCK_TOKEN;
  return null;
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

export interface FriendPresence {
  status: 'lobby' | 'playing' | 'offline';
  roomCode: string | null;
}

export interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
  presence?: FriendPresence;
}

export async function getMe(): Promise<User> {
  if (IS_MOCK) return { id: 'mock-user-1', username: 'PlayerOne', avatar_url: null, role: 'user', created_at: '2025-01-01T00:00:00Z' };
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

export async function getLeaderboard(): Promise<{ id: string; username: string; player_name: string; avatar_url: string | null; total_score: number; games_played: number; avg_score: number; best_score: number; wins: number }[]> {
  if (IS_MOCK) return MOCK_LEADERBOARD;
  const res = await fetch(`${API_URL}/api/leaderboard`);
  return res.json();
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const res = await fetch(`${API_URL}/api/users/${userId}/stats`);
  if (!res.ok) throw new Error('Failed to fetch user stats');
  return res.json();
}

export async function getArtistGroups(): Promise<{ id: string; name: string; artists: string[] }[]> {
  const res = await fetch(`${API_URL}/api/artist-groups`);
  return res.json();
}

export async function getFriends(): Promise<{ friends: Friend[]; pending: Friend[] }> {
  return fetchWithAuth(`${API_URL}/api/friends`);
}

export async function searchUsers(q: string): Promise<{ id: string; username: string; avatar_url: string | null; status: 'accepted' | 'pending' | null; friendship_sender: string | null }[]> {
  return fetchWithAuth(`${API_URL}/api/users/search?q=${encodeURIComponent(q)}`);
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

export interface Invite {
  id: string;
  fromUser: string;
  fromUserId: string;
  toUserId: string;
  roomCode: string;
  expiresAt: number;
}

export async function sendInvite(code: string, friendId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/game/${code}/invite/${friendId}`, { method: 'POST' });
}

export async function getInvites(): Promise<Invite[]> {
  return fetchWithAuth(`${API_URL}/api/invites`);
}

export async function declineInvite(inviteId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/invites/${inviteId}`, { method: 'DELETE' });
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
  if (IS_MOCK) return MOCK_STATS;
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

export async function getAdminRooms(): Promise<{
  code: string;
  state: string;
  playerCount: number;
  players: { id: string; name: string; score: number; avatarUrl?: string | null; role?: string; userId?: string | null }[];
  genres: string[];
  currentRound: number;
  totalRounds: number;
  settings: any;
}[]> {
  return fetchWithAuth(`${API_URL}/api/admin/rooms`);
}

export async function adminStartRoom(code: string): Promise<{ ok: boolean; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/rooms/${code}/start`, { method: 'POST' });
}

export async function adminKickPlayer(code: string, playerId: string): Promise<{ ok: boolean }> {
  return fetchWithAuth(`${API_URL}/api/admin/rooms/${code}/kick/${playerId}`, { method: 'POST' });
}

export async function adminDestroyRoom(code: string): Promise<{ ok: boolean }> {
  return fetchWithAuth(`${API_URL}/api/admin/rooms/${code}`, { method: 'DELETE' });
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

export async function getDbStatus(): Promise<{ ok: boolean; isPostgres: boolean; hasData: boolean; tables: { users: number; tracks: number; classifications: number; curation: number; track_plays: number; genres: number }; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/db-status`);
}

export async function deleteUser(userId: string): Promise<void> {
  await fetchWithAuth(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
}

export async function getSongCache(): Promise<{ total: number; plays: number; genres: { genre: string; count: number; last_fetched: string }[]; played: { id: string; name: string; artist_name: string; deezer_genres: string[]; chart_source: string | null; rank: number; play_count: number; last_played: string }[] }> {
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
  unprocessedTracks: { id: string; name: string; artist: string; genres: string[]; chart_source: string; rank: number }[];
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/stats`);
}

export async function searchAiTracks(q: string, limit = 20): Promise<{
  ok: boolean;
  tracks: { id: string; name: string; artist: string; ai_genre: string; ai_tags: string[]; ai_confidence: number; ai_processed_at: string }[];
  error?: string;
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export async function getAiRecent(limit = 50): Promise<{
  ok: boolean;
  tracks: { id: string; name: string; artist: string; ai_genre: string; ai_tags: string[]; ai_processed_at: string }[];
  error?: string;
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/recent?limit=${limit}`);
}

export async function getUnclassifiedTracks(): Promise<{
  ok: boolean;
  tracks: { id: string; name: string; artist: string; album_image: string | null; ai_genre: string; rank: number; preview_url: string | null }[];
  error?: string;
}> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/unclassified`);
}

export async function updateAiGenre(id: string, genre: string): Promise<{ ok: boolean; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/update-genre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, genre }),
  });
}

export async function deleteAiTrack(id: string): Promise<{ ok: boolean; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/ai/track/${id}`, {
    method: 'DELETE',
  });
}

export async function getCuratedStats(): Promise<{
  total: number; verified: number; unverified: number; total_plays: number; genres: number;
  byGenre: { genre: string; total: number; verified: number; total_plays: number }[];
}> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/stats`);
}

export async function getCuratedByGenre(genre: string): Promise<{
  id: string; name: string; artist: string; genre: string; playedCount: number;
  verified: boolean; curatedAt: string; lastPlayed: string | null; previewUrl: string | null;
}[]> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/by-genre?genre=${encodeURIComponent(genre)}`);
}

export async function getUnverifiedSongs(params: {
  limit?: number; offset?: number; search?: string;
}): Promise<{
  songs: {
    id: string; name: string; artist: string; genre: string; playedCount: number;
    verified: boolean; curatedAt: string; previewUrl: string | null;
  }[];
  total: number;
}> {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  if (params.search) q.set('search', params.search);
  return fetchWithAuth(`${API_URL}/api/admin/curated/unverified?${q.toString()}`);
}



export async function getCuratedDiscovery(genre?: string): Promise<{
  id: string; name: string; artist_name: string; ai_genre: string; deezer_genres: string[]; chart_source: string; rank: number;
}[]> {
  const params = genre ? `?genre=${encodeURIComponent(genre)}` : '';
  return fetchWithAuth(`${API_URL}/api/admin/curated/discovery${params}`);
}

export async function importToCurated(songIds: string[], genre?: string): Promise<{ ok: boolean; imported: number; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songIds, genre }),
  });
}

export async function verifyCuratedSong(songId: string, verified: boolean): Promise<{ ok: boolean }> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId, verified }),
  });
}

export async function updateCuratedSongGenre(songId: string, genre: string): Promise<{ ok: boolean }> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/update-genre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId, genre }),
  });
}

export async function deleteCuratedSong(songId: string): Promise<{ ok: boolean }> {
  return fetchWithAuth(`${API_URL}/api/admin/curated/${songId}`, { method: 'DELETE' });
}

export async function getTrackPreviewUrl(trackId: string): Promise<{ ok: boolean; previewUrl?: string; error?: string }> {
  return fetchWithAuth(`${API_URL}/api/admin/tracks/${encodeURIComponent(trackId)}/preview`);
}

