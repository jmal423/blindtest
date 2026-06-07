export default {
  name: '004_song_cache',
  up: `
    CREATE TABLE IF NOT EXISTS songs_cache (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      album_image TEXT,
      preview_url TEXT,
      duration_ms INTEGER DEFAULT 0,
      genre TEXT,
      rank INTEGER DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'deezer',
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS songs_played (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL REFERENCES songs_cache(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      played_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_songs_cache_genre ON songs_cache(genre);
    CREATE INDEX IF NOT EXISTS idx_songs_cache_source ON songs_cache(source);
    CREATE INDEX IF NOT EXISTS idx_songs_played_song ON songs_played(song_id, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_played_game ON songs_played(game_id);
  `,
};