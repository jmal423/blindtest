import { get, all } from '../connection.js';

export async function getPlayerStats(playerId) {
  const [totals, best, rounds, genreRow] = await Promise.all([
    get('SELECT COUNT(DISTINCT gp.game_id) as games, COALESCE(SUM(gp.score), 0) as total_points, COALESCE(AVG(gp.score), 0) as avg_score FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE g.status = \'finished\' AND gp.player_id = ?', [playerId]),
    get('SELECT MAX(gp.score) as best_score FROM game_players gp WHERE gp.player_id = ?', [playerId]),
    get('SELECT COUNT(*) as total_rounds, COALESCE(SUM(rv.points_earned), 0) as round_points, COALESCE(AVG(rv.guess_time_ms), 0) as avg_speed, COALESCE(SUM(CASE WHEN rv.found_both THEN 1 ELSE 0 END), 0) as perfects FROM round_results_v2 rv WHERE rv.player_id = ?', [playerId]),
    get('SELECT rv.genre FROM round_results_v2 rv WHERE rv.player_id = ? AND (rv.found_artist OR rv.found_title) GROUP BY rv.genre ORDER BY COUNT(*) DESC LIMIT 1', [playerId]),
  ]);

  return {
    totalPoints: Number(totals?.total_points || 0),
    averageSpeedMs: rounds?.avg_speed ? Math.round(Number(rounds.avg_speed)) : null,
    bestGenre: genreRow?.genre || null,
    gamesPlayed: Number(totals?.games || 0),
    avgScore: Number(totals?.avg_score || 0),
    bestScore: Number(best?.best_score || 0),
    totalRounds: Number(rounds?.total_rounds || 0),
    roundPoints: Number(rounds?.round_points || 0),
    perfects: Number(rounds?.perfects || 0),
  };
}

export async function getLeaderboardV2(limit = 50) {
  return all(
    `SELECT MAX(gp.player_name) as username, gp.player_id as id,
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
