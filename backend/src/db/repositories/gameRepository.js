import { run, all, get } from '../connection.js';

export async function insertRoundResult(userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect) {
  await run(
    'INSERT INTO round_results (user_id, game_id, genre, track_id, guess_time_ms, points_earned, is_correct) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect]
  );
}

export async function createGame(gameId, code, genres, audioSource, rounds, roundTime) {
  await run(
    'INSERT INTO games (id, code, genres, audio_source, rounds, round_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [gameId, code, JSON.stringify(genres), audioSource, rounds, roundTime, 'playing']
  );
}

export async function finishGame(gameId) {
  await run(
    'UPDATE games SET status = ?, finished_at = NOW() WHERE id = ?',
    ['finished', gameId]
  );
}

export async function addGamePlayer(id, gameId, playerId, playerName, score, position) {
  await run(
    'INSERT INTO game_players (id, game_id, player_id, player_name, score, position) VALUES (?, ?, ?, ?, ?, ?)',
    [id, gameId, playerId, playerName, score, position]
  );
}

export async function addRoundResultV2(id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth) {
  await run(
    'INSERT INTO round_results_v2 (id, game_id, player_id, player_name, round, track_name, track_artist, genre, guess, guess_time_ms, points_earned, found_artist, found_title, found_both) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth]
  );
}

export async function getGameHistory(playerId, limit = 20) {
  return all(
    `SELECT g.id, g.code, g.genres, g.audio_source, g.rounds, g.round_time, g.status, g.created_at, g.finished_at,
            gp.score, gp.position
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.player_id = ? OR gp.player_name = (
       SELECT player_name FROM game_players WHERE player_id = ? LIMIT 1
     )
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [playerId, playerId, limit]
  );
}

export async function getRecentGames(limit = 20) {
  return all(
    `SELECT g.id, g.code, g.genres, g.audio_source, g.rounds, g.round_time, g.status, g.created_at, g.finished_at,
            (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
     FROM games g
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getGameDetails(gameId) {
  const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) return null;

  const players = await all('SELECT * FROM game_players WHERE game_id = ?', [gameId]);
  const rounds = await all('SELECT * FROM round_results_v2 WHERE game_id = ? ORDER BY round, created_at', [gameId]);

  return { ...game, players, rounds };
}
