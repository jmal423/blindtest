export default {
  name: '001_initial',
  up: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      game_code TEXT,
      score INTEGER,
      total_rounds INTEGER,
      played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT,
      friend_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS round_results (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      game_id TEXT,
      genre TEXT,
      track_id TEXT,
      guess_time_ms INTEGER,
      points_earned INTEGER,
      is_correct BOOLEAN,
      played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
};
