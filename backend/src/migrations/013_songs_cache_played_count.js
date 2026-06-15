export default {
  name: 'songs_cache_played_count',
  up: `
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS played_count INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_songs_cache_played ON songs_cache(played_count);
  `,
};
