export default {
  name: '003_games_and_rounds',

  up: `
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      genres TEXT,
      audio_source TEXT DEFAULT 'deezer',
      rounds INTEGER,
      round_time INTEGER,
      status TEXT DEFAULT 'playing',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      finished_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS game_players (
      id TEXT PRIMARY KEY,
      game_id TEXT REFERENCES games(id),
      player_id TEXT,
      player_name TEXT,
      score INTEGER DEFAULT 0,
      position INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS round_results_v2 (
      id TEXT PRIMARY KEY,
      game_id TEXT REFERENCES games(id),
      player_id TEXT,
      player_name TEXT,
      round INTEGER NOT NULL,
      track_name TEXT,
      track_artist TEXT,
      genre TEXT,
      guess TEXT,
      guess_time_ms INTEGER,
      points_earned INTEGER DEFAULT 0,
      found_artist BOOLEAN DEFAULT FALSE,
      found_title BOOLEAN DEFAULT FALSE,
      found_both BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_games_code ON games (code);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);
    CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players (game_id);
    CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players (player_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_v2_game_id ON round_results_v2 (game_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_v2_player_id ON round_results_v2 (player_id);
    CREATE INDEX IF NOT EXISTS idx_round_results_v2_created_at ON round_results_v2 (created_at DESC);
  `,
};