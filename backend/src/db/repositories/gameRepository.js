import { query, get, all, run } from '../connection.js';

export async function insertRoundResult(userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect) {
  await run(
    `INSERT INTO round_answers (id, game_id, player_id, player_name, round_number, track_id, genre_id,
                                guess_time_ms, points_earned, found_artist, found_title, found_both)
     VALUES (gen_random_uuid()::text, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [gameId, userId, genre, trackId, guessTimeMs, pointsEarned, isCorrect ? 1 : 0, isCorrect ? 1 : 0, isCorrect ? 1 : 0]
  );
}

export async function createGame(id, code, genres, audioSource, rounds, roundTime) {
  await run(
    `INSERT INTO games (id, code, genres, audio_source, rounds, round_time, status)
     VALUES (?, ?, ?, ?, ?, ?, 'playing')`,
    [id, code, JSON.stringify(genres), audioSource, rounds, roundTime]
  );

  // Also insert into game_genres for proper FK
  if (genres && genres.length > 0) {
    const placeholders = genres.map(() => '(?, ?)').join(', ');
    const params = genres.flatMap(g => [id, g]);
    await run(
      `INSERT INTO game_genres (game_id, genre_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      params
    );
  }
}

export async function finishGame(gameId) {
  await run(
    `UPDATE games SET status = 'finished', finished_at = NOW() WHERE id = ?`,
    [gameId]
  );
}

export async function addGamePlayer(id, gameId, playerId, playerName, score, position) {
  await run(
    `INSERT INTO game_players (id, game_id, player_id, player_name, score, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, gameId, playerId, playerName, score, position]
  );
}

export async function addRoundResultV2(id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth) {
  await run(
    `INSERT INTO round_answers (id, game_id, player_id, player_name, round_number,
                                track_name, track_artist, genre_id,
                                guess, guess_time_ms, points_earned,
                                found_artist, found_title, found_both)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth]
  );
}

export async function getGameHistory(playerId, limit) {
  return all(
    `SELECT g.*, gp.score, gp.position
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.player_id = ?
        OR gp.player_name = (SELECT player_name FROM game_players WHERE player_id = ? LIMIT 1)
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [playerId, playerId, limit]
  );
}

export async function getRecentGames(limit) {
  return all(
    `SELECT g.*,
            (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
     FROM games g
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getGameDetails(gameId) {
  const game = await get(`SELECT * FROM games WHERE id = ?`, [gameId]);
  const players = await all(`SELECT * FROM game_players WHERE game_id = ?`, [gameId]);
  const rounds = await all(
    `SELECT * FROM round_answers WHERE game_id = ? ORDER BY round_number, created_at`,
    [gameId]
  );
  return { game, players, rounds };
}

export async function getPlayerStats(playerId) {
  const games = await get(
    `SELECT COUNT(DISTINCT gp.game_id) as games,
            COALESCE(SUM(gp.score), 0) as total_points,
            COALESCE(AVG(gp.score), 0) as avg_score
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE g.status = 'finished' AND gp.player_id = ?`,
    [playerId]
  );
  const best = await get(
    `SELECT MAX(gp.score) as best_score FROM game_players gp WHERE gp.player_id = ?`,
    [playerId]
  );
  const rounds = await get(
    `SELECT COUNT(*) as total_rounds,
            COALESCE(SUM(ra.points_earned), 0) as round_points,
            COALESCE(AVG(ra.guess_time_ms), 0) as avg_speed,
            COALESCE(SUM(CASE WHEN ra.found_both THEN 1 ELSE 0 END), 0) as perfects
     FROM round_answers ra
     WHERE ra.player_id = ?`,
    [playerId]
  );
  const bestGenre = await get(
    `SELECT ra.genre_id as genre
     FROM round_answers ra
     WHERE ra.player_id = ? AND (ra.found_artist OR ra.found_title)
     GROUP BY ra.genre_id
     ORDER BY COUNT(*) DESC LIMIT 1`,
    [playerId]
  );
  return { ...games, ...best, ...rounds, best_genre: bestGenre?.genre || null };
}

export async function getLeaderboardV2(limit) {
  return all(
    `SELECT
       MAX(gp.player_name) as username,
       gp.player_id as id,
       COUNT(DISTINCT gp.game_id) as games_played,
       COALESCE(SUM(gp.score), 0) as total_score,
       COALESCE(AVG(gp.score), 0) as avg_score,
       MAX(gp.score) as best_score,
       COALESCE(SUM(CASE WHEN gp.position = 1 THEN 1 ELSE 0 END), 0) as wins,
       u.avatar_url
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     LEFT JOIN users u ON u.id = gp.player_id
     WHERE g.status = 'finished'
     GROUP BY gp.player_id, u.avatar_url
     ORDER BY total_score DESC
     LIMIT ?`,
    [limit]
  );
}
