export default {
  name: '007_ai_enrichment',
  up: `
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_genres JSONB DEFAULT '[]';
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_tags JSONB DEFAULT '[]';
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_audio_genres JSONB DEFAULT '[]';
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_confidence JSONB DEFAULT '{}';
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS ai_version TEXT;

    CREATE INDEX IF NOT EXISTS idx_songs_cache_ai_unprocessed ON songs_cache(ai_processed_at)
      WHERE ai_processed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_songs_cache_ai_genres ON songs_cache USING GIN (ai_genres);

    CREATE TABLE IF NOT EXISTS ai_classification_queue (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL REFERENCES songs_cache(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_classification_queue(status);
  `,
};
