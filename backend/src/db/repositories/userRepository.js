import { query, get, all, run } from '../connection.js';

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
