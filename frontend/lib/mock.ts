'use client';

export const IS_MOCK = typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_MOCK === 'true';

export const MOCK_TOKEN = 'mock_token_abc123';

export const MOCK_USER = {
  id: 'mock-user-1',
  username: 'PlayerOne',
  avatar_url: null,
  role: 'user',
  created_at: '2025-01-01T00:00:00Z',
};

export const MOCK_LEADERBOARD: { id: string; username: string; player_name: string; avatar_url: string | null; total_score: number; games_played: number; avg_score: number; best_score: number; wins: number }[] = [
  { id: 'lb-1', username: 'VinylQueen', player_name: 'VinylQueen', avatar_url: null, total_score: 28450, games_played: 142, avg_score: 200, best_score: 850, wins: 38 },
  { id: 'lb-2', username: 'BeatMaster', player_name: 'BeatMaster', avatar_url: null, total_score: 22100, games_played: 98, avg_score: 225, best_score: 920, wins: 27 },
  { id: 'lb-3', username: 'DiscoFever', player_name: 'DiscoFever', avatar_url: null, total_score: 19320, games_played: 115, avg_score: 168, best_score: 780, wins: 21 },
  { id: 'lb-4', username: 'JazzHands', player_name: 'JazzHands', avatar_url: null, total_score: 15780, games_played: 87, avg_score: 181, best_score: 810, wins: 16 },
  { id: 'lb-5', username: 'RockStar', player_name: 'RockStar', avatar_url: null, total_score: 12450, games_played: 63, avg_score: 197, best_score: 895, wins: 12 },
  { id: 'lb-6', username: 'BluesTraveler', player_name: 'BluesTraveler', avatar_url: null, total_score: 10120, games_played: 55, avg_score: 184, best_score: 760, wins: 9 },
  { id: 'lb-7', username: 'ElectroPop', player_name: 'ElectroPop', avatar_url: null, total_score: 8730, games_played: 48, avg_score: 181, best_score: 720, wins: 7 },
  { id: 'lb-8', username: 'HipHopFan', player_name: 'HipHopFan', avatar_url: null, total_score: 6540, games_played: 36, avg_score: 181, best_score: 690, wins: 5 },
];

export const MOCK_STATS = {
  totalPoints: 4730,
  averageSpeedMs: 4200,
  bestGenre: 'rock',
  gamesPlayed: 24,
  avgScore: 197,
  bestScore: 845,
  totalRounds: 192,
  roundPoints: 24,
  perfects: 8,
};
