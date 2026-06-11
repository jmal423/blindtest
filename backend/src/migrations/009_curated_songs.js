export default {
  name: 'curated_songs',
  up: `
    CREATE TABLE IF NOT EXISTS curated_songs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      album_image TEXT,
      preview_url TEXT,
      duration_ms INTEGER,
      genre TEXT NOT NULL,
      album_genres JSONB DEFAULT '[]'::jsonb,
      played_count INTEGER DEFAULT 0,
      verified BOOLEAN DEFAULT FALSE,
      chart_source TEXT,
      curated_at TIMESTAMP DEFAULT NOW(),
      last_played_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_curated_genre ON curated_songs(genre);
    CREATE INDEX IF NOT EXISTS idx_curated_verified ON curated_songs(verified);
    CREATE INDEX IF NOT EXISTS idx_curated_played ON curated_songs(played_count);
  `
};
