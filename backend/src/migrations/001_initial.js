export default {
  name: '001_initial',
  up: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      game_code TEXT,
      score INTEGER,
      total_rounds INTEGER,
      played_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT,
      friend_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS round_results (
      id SERIAL PRIMARY KEY,
      user_id TEXT,
      game_id VARCHAR(50),
      genre VARCHAR(50),
      track_id VARCHAR(100),
      guess_time_ms INT,
      points_earned INT,
      is_correct BOOLEAN,
      played_at TIMESTAMP DEFAULT NOW()
    );
  `,

  sqlite: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE,
      username TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      game_code TEXT,
      score INTEGER,
      total_rounds INTEGER,
      played_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT,
      friend_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS round_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      game_id VARCHAR(50),
      genre VARCHAR(50),
      track_id VARCHAR(100),
      guess_time_ms INT,
      points_earned INT,
      is_correct INTEGER,
      played_at TEXT DEFAULT (datetime('now'))
    );
  `,
};
