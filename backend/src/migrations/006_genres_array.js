export default {
  name: '006_genres_array',
  up: `
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS genres JSONB DEFAULT '[]';
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS chart_source TEXT;

    UPDATE songs_cache SET genres = COALESCE(
      json_build_array(genre)::jsonb,
      '[]'::jsonb
    ) WHERE genres = '[]'::jsonb AND genre IS NOT NULL AND genre != '';

    DROP INDEX IF EXISTS idx_songs_cache_genre;

    CREATE INDEX IF NOT EXISTS idx_songs_cache_genres ON songs_cache USING GIN (genres);
    CREATE INDEX IF NOT EXISTS idx_songs_cache_chart_source ON songs_cache(chart_source);
  `,
};