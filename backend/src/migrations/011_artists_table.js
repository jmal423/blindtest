export default {
  name: 'artists_table',
  up: `
    CREATE TABLE IF NOT EXISTS artists (
      id UUID PRIMARY KEY,
      deezer_id BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      picture_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_artists_deezer_id ON artists(deezer_id);
    CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);

    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id);
    ALTER TABLE curated_songs ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id);
  `,
};
