export default {
  name: '005_cleanup_ghost_users',
  up: `
    -- Reassign game_players rows that reference ghost users (no discord_id)
    -- to the matching Discord user (same username), then delete the ghosts.
    UPDATE game_players
    SET player_id = du.discord_id
    FROM (
      SELECT g.id AS ghost_id, d.id AS discord_id
      FROM users g
      JOIN users d ON LOWER(g.username) = LOWER(d.username) AND d.discord_id IS NOT NULL
      WHERE g.discord_id IS NULL
    ) AS du
    WHERE game_players.player_id = du.ghost_id;

    UPDATE round_results_v2
    SET player_id = du.discord_id
    FROM (
      SELECT g.id AS ghost_id, d.id AS discord_id
      FROM users g
      JOIN users d ON LOWER(g.username) = LOWER(d.username) AND d.discord_id IS NOT NULL
      WHERE g.discord_id IS NULL
    ) AS du
    WHERE round_results_v2.player_id = du.ghost_id;

    UPDATE round_results
    SET user_id = du.discord_id
    FROM (
      SELECT g.id AS ghost_id, d.id AS discord_id
      FROM users g
      JOIN users d ON LOWER(g.username) = LOWER(d.username) AND d.discord_id IS NOT NULL
      WHERE g.discord_id IS NULL
    ) AS du
    WHERE round_results.user_id = du.ghost_id;

    UPDATE game_scores
    SET user_id = du.discord_id
    FROM (
      SELECT g.id AS ghost_id, d.id AS discord_id
      FROM users g
      JOIN users d ON LOWER(g.username) = LOWER(d.username) AND d.discord_id IS NOT NULL
      WHERE g.discord_id IS NULL
    ) AS du
    WHERE game_scores.user_id = du.ghost_id;

    DELETE FROM users WHERE discord_id IS NULL
  `,
};