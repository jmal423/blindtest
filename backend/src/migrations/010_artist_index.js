export default {
  name: 'artist_index',
  up: `
    CREATE INDEX IF NOT EXISTS idx_curated_artist ON curated_songs (artist);
    CREATE INDEX IF NOT EXISTS idx_songs_cache_artist ON songs_cache (artist);
  `
};
