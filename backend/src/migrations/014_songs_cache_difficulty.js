export default {
  name: 'songs_cache_difficulty',
  up: `
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS found_count INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_songs_cache_difficulty ON songs_cache(played_count, found_count);
  `,
};
