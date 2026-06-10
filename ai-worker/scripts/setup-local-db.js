import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest',
  max: 5,
});

const sql = `
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
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    genres JSONB DEFAULT '[]',
    chart_source TEXT,
    ai_genres JSONB DEFAULT '[]',
    ai_tags JSONB DEFAULT '[]',
    ai_audio_genres JSONB DEFAULT '[]',
    ai_confidence JSONB DEFAULT '{}',
    ai_processed_at TIMESTAMPTZ,
    ai_version TEXT,
    already_verified BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ
  );

  ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS already_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_local_ai_unprocessed ON songs_cache(ai_processed_at)
    WHERE ai_processed_at IS NULL AND ai_version IS DISTINCT FROM 'error';

  CREATE INDEX IF NOT EXISTS idx_local_synced ON songs_cache(synced_at)
    WHERE synced_at IS NULL OR synced_at < ai_processed_at;
`;

try {
  await pool.query(sql);
  console.log('[Setup] Local schema created successfully');
} catch (err) {
  console.error('[Setup] Failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
