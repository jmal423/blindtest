export default {
  name: '002_indexes',

  up: `
    CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
    CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON game_scores (user_id);
    CREATE INDEX IF NOT EXISTS idx_game_scores_played_at ON game_scores (played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_round_results_user_id ON round_results (user_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_game_id ON round_results (game_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_genre ON round_results (genre);
    CREATE INDEX IF NOT EXISTS idx_round_results_played_at ON round_results (played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships (status);
  `,

  sqlite: `
    CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
    CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON game_scores (user_id);
    CREATE INDEX IF NOT EXISTS idx_game_scores_played_at ON game_scores (played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_round_results_user_id ON round_results (user_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_game_id ON round_results (game_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_genre ON round_results (genre);
    CREATE INDEX IF NOT EXISTS idx_round_results_played_at ON round_results (played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships (status);
  `,
};
