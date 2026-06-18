export default {
  name: '018_schema_restructure',
  up: `
    -- ============================================================
    -- BLINDTEST DATABASE RESTRUCTURE
    -- Migration 018: Normalize the schema, remove duplication
    -- ============================================================

    -- ============================================================
    -- PHASE 1: Create genre catalog (replaces hardcoded strings)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS genres (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    INSERT INTO genres (id, group_id, sort_order) VALUES
      ('PT_fado', 'portuguese', 1),
      ('PT_tradicional_folklore_pimba', 'portuguese', 2),
      ('PT_pop_tuga', 'portuguese', 3),
      ('PT_pop_rock_tuga', 'portuguese', 4),
      ('PT_hip_hop_tuga', 'portuguese', 5),
      ('PT_classica_tuga', 'portuguese', 6),
      ('PT_kizomba_palop', 'portuguese', 7),
      ('PT_pop_urbano_nova_pop', 'portuguese', 8),
      ('BR_samba_pagode', 'brazilian', 9),
      ('BR_bossa_nova', 'brazilian', 10),
      ('BR_funk_brasileiro', 'brazilian', 11),
      ('BR_pop_rock_brasileiro', 'brazilian', 12),
      ('BR_pop', 'brazilian', 13),
      ('US_pop_us', 'united_states', 14),
      ('US_hip_hop_trap_us', 'united_states', 15),
      ('US_country_americana_us', 'united_states', 16),
      ('US_rock_alternative_us', 'united_states', 17),
      ('UK_pop_uk', 'united_kingdom', 18),
      ('UK_uk_drill_grime', 'united_kingdom', 19),
      ('UK_britpop_rock_uk', 'united_kingdom', 20),
      ('UK_uk_garage_dnb', 'united_kingdom', 21),
      ('FR_chanson_francaise', 'french', 22),
      ('FR_pop_francaise', 'french', 23),
      ('FR_rap_francais', 'french', 24),
      ('FR_french_touch_electro', 'french', 25),
      ('ES_flamenco', 'spanish', 26),
      ('ES_reggaeton_urbano', 'spanish', 27),
      ('ES_musica_regional_latina', 'spanish', 28),
      ('GL_reggae', 'global_other', 29),
      ('GL_kpop', 'global_other', 30),
      ('GL_edm_dance', 'global_other', 31),
      ('GL_afrobeats_african', 'global_other', 32),
      ('GL_metal', 'global_other', 33),
      ('GL_soundtracks', 'global_other', 34),
      ('GL_jazz_lounge', 'global_other', 35),
      ('GL_classical', 'global_other', 36),
      ('GL_kids_family', 'global_other', 37),
      ('GL_indian', 'global_other', 38),
      ('GL_other', 'global_other', 39),
      ('UNCLASSIFIED', 'global_other', 40)
    ON CONFLICT (id) DO NOTHING;

    -- ============================================================
    -- PHASE 2: Create new normalized tables
    -- ============================================================

    -- 2a. tracks: pure Deezer metadata (no AI, no stats, no legacy)
    CREATE TABLE IF NOT EXISTS tracks (
      id            TEXT PRIMARY KEY,
      artist_id     UUID REFERENCES artists(id),
      name          TEXT NOT NULL,
      artist_name   TEXT NOT NULL,
      album_image   TEXT,
      preview_url   TEXT,
      duration_ms   INTEGER NOT NULL DEFAULT 0,
      rank          INTEGER NOT NULL DEFAULT 0,
      chart_source  TEXT,
      deezer_genres JSONB NOT NULL DEFAULT '[]',
      fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_name);
    CREATE INDEX IF NOT EXISTS idx_tracks_rank ON tracks(rank DESC);
    CREATE INDEX IF NOT EXISTS idx_tracks_chart ON tracks(chart_source);
    CREATE INDEX IF NOT EXISTS idx_tracks_deezer_genres ON tracks USING GIN (deezer_genres);
    CREATE INDEX IF NOT EXISTS idx_tracks_preview ON tracks(preview_url) WHERE preview_url IS NOT NULL;

    -- 2b. classifications: AI/manual genre assignments (was ai_genres/ai_confidence/ai_tags etc.)
    CREATE TABLE IF NOT EXISTS classifications (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id     TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      genre_id     TEXT NOT NULL REFERENCES genres(id),
      confidence   REAL NOT NULL DEFAULT 0,
      source       TEXT NOT NULL,
      tags         JSONB NOT NULL DEFAULT '[]',
      audio_genres JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_classifications_track ON classifications(track_id);
    CREATE INDEX IF NOT EXISTS idx_classifications_genre ON classifications(genre_id);
    CREATE INDEX IF NOT EXISTS idx_classifications_latest ON classifications(track_id, created_at DESC);

    -- 2c. curation: replaces curated_songs (no more column duplication)
    CREATE TABLE IF NOT EXISTS curation (
      track_id     TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
      genre_id     TEXT NOT NULL REFERENCES genres(id),
      verified     BOOLEAN NOT NULL DEFAULT FALSE,
      curated_by   TEXT,
      curated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      played_count INTEGER NOT NULL DEFAULT 0,
      found_count  INTEGER NOT NULL DEFAULT 0,
      last_played  TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_curation_genre ON curation(genre_id);
    CREATE INDEX IF NOT EXISTS idx_curation_verified ON curation(verified);
    CREATE INDEX IF NOT EXISTS idx_curation_played ON curation(played_count);

    -- 2d. game_genres: proper join table (was games.genres TEXT blob)
    CREATE TABLE IF NOT EXISTS game_genres (
      game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      genre_id TEXT NOT NULL REFERENCES genres(id),
      PRIMARY KEY (game_id, genre_id)
    );

    -- 2e. track_plays: renamed from songs_played
    CREATE TABLE IF NOT EXISTS track_plays (
      id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id  TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      game_id   TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      played_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_track_plays_track ON track_plays(track_id, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_track_plays_game ON track_plays(game_id);

    -- 2f. round_answers: replaces round_results_v2 (with proper FKs)
    -- player_id is TEXT without FK because it can be anonymous user strings
    -- track_id is nullable because old data doesn't have track FK
    CREATE TABLE IF NOT EXISTS round_answers (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id       TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id     TEXT NOT NULL,
      player_name   TEXT NOT NULL,
      round_number  INTEGER NOT NULL,
      track_id      TEXT REFERENCES tracks(id),
      track_name    TEXT,
      track_artist  TEXT,
      genre_id      TEXT REFERENCES genres(id),
      guess         TEXT,
      guess_time_ms INTEGER,
      points_earned INTEGER NOT NULL DEFAULT 0,
      found_artist  BOOLEAN NOT NULL DEFAULT FALSE,
      found_title   BOOLEAN NOT NULL DEFAULT FALSE,
      found_both    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_round_answers_game ON round_answers(game_id);
    CREATE INDEX IF NOT EXISTS idx_round_answers_player ON round_answers(player_id);
    CREATE INDEX IF NOT EXISTS idx_round_answers_track ON round_answers(track_id);

    -- 2g. song_flags: recreate with FK to tracks
    CREATE TABLE IF NOT EXISTS song_flags_new (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      player_id  TEXT NOT NULL,
      game_code  TEXT,
      reason     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_song_flags_new_track ON song_flags_new(track_id);

    -- ============================================================
    -- PHASE 3: Migrate existing data
    -- ============================================================

    -- 3a. tracks ← songs_cache (strip out AI/stats/legacy columns)
    INSERT INTO tracks (id, artist_id, name, artist_name, album_image, preview_url,
                        duration_ms, rank, chart_source, deezer_genres, fetched_at)
    SELECT id, artist_id, name, artist, album_image, preview_url,
           COALESCE(duration_ms, 0), COALESCE(rank, 0), chart_source,
           COALESCE(genres, '[]'::jsonb), COALESCE(fetched_at, now())
    FROM songs_cache
    ON CONFLICT (id) DO NOTHING;

    -- 3b. classifications ← songs_cache AI columns
    INSERT INTO classifications (track_id, genre_id, confidence, source, tags, audio_genres, created_at)
    SELECT
      id,
      COALESCE(ai_genres->>0, 'UNCLASSIFIED'),
      CASE
        WHEN ai_confidence IS NOT NULL AND ai_genres IS NOT NULL
          THEN COALESCE((ai_confidence->>COALESCE(ai_genres->>0, 'UNCLASSIFIED'))::real, 0)
        ELSE 0
      END,
      CASE
        WHEN ai_version IS NULL THEN 'legacy:unknown'
        WHEN ai_version LIKE 'error:%' THEN 'error:' || replace(ai_version, 'error:', '')
        WHEN ai_version LIKE 'manual%' THEN 'manual:admin'
        ELSE 'ai:' || ai_version
      END,
      COALESCE(ai_tags, '[]'::jsonb),
      COALESCE(ai_audio_genres, '[]'::jsonb),
      COALESCE(ai_processed_at, now())
    FROM songs_cache
    WHERE ai_processed_at IS NOT NULL
       OR ai_version IS NOT NULL;

    -- 3c. curation ← curated_songs (thin layer, no column copy)
    INSERT INTO curation (track_id, genre_id, verified, curated_by, curated_at,
                          played_count, found_count, last_played)
    SELECT
      cs.id, cs.genre, cs.verified,
      CASE WHEN cs.verified THEN 'auto-curate' ELSE 'admin:pending' END,
      COALESCE(cs.curated_at, now()),
      COALESCE(cs.played_count, 0),
      COALESCE(sc.found_count, 0),
      cs.last_played_at
    FROM curated_songs cs
    LEFT JOIN songs_cache sc ON sc.id = cs.id
    ON CONFLICT (track_id) DO NOTHING;

    -- 3d. track_plays ← songs_played
    INSERT INTO track_plays (id, track_id, game_id, played_at)
    SELECT
      gen_random_uuid(),
      sp.song_id,
      sp.game_id,
      COALESCE(sp.played_at, now())
    FROM songs_played sp
    ON CONFLICT (id) DO NOTHING;

    -- 3e. game_genres ← games.genres JSON string
    WITH parsed AS (
      SELECT id, jsonb_array_elements_text(genres::jsonb) AS genre_id
      FROM games
      WHERE genres IS NOT NULL AND genres != '' AND genres != '[]'
    )
    INSERT INTO game_genres (game_id, genre_id)
    SELECT id, genre_id FROM parsed
    ON CONFLICT DO NOTHING;

    -- 3f. round_answers ← round_results_v2
    -- Note: round_results_v2 stores track_name/track_artist as text, not track IDs
    -- We keep these as text references since we can't reliably map to tracks.id
    -- player_id stores the raw player identifier (may be UUID or temp string)
    INSERT INTO round_answers (game_id, player_id, player_name, round_number,
                               track_name, track_artist, genre_id,
                               guess, guess_time_ms, points_earned,
                               found_artist, found_title, found_both, created_at)
    SELECT
      rv.game_id,
      rv.player_id,
      rv.player_name,
      rv.round,
      rv.track_name,
      rv.track_artist,
      rv.genre,
      rv.guess,
      rv.guess_time_ms,
      rv.points_earned,
      rv.found_artist,
      rv.found_title,
      rv.found_both,
      COALESCE(rv.created_at, now())
    FROM round_results_v2 rv;

    -- 3g. song_flags ← old song_flags
    INSERT INTO song_flags_new (track_id, player_id, game_code, reason, created_at)
    SELECT song_id, player_id, room_code, reason, COALESCE(created_at, now())
    FROM song_flags;

    -- ============================================================
    -- PHASE 4: Drop old tables
    -- ============================================================

    DROP TABLE IF EXISTS ai_classification_queue CASCADE;
    DROP TABLE IF EXISTS friendships CASCADE;
    DROP TABLE IF EXISTS game_scores CASCADE;
    DROP TABLE IF EXISTS round_results CASCADE;
    DROP TABLE IF EXISTS round_results_v2 CASCADE;
    DROP TABLE IF EXISTS songs_played CASCADE;
    DROP TABLE IF EXISTS song_flags CASCADE;
    DROP TABLE IF EXISTS curated_songs CASCADE;
    DROP TABLE IF EXISTS songs_cache CASCADE;

    -- Rename song_flags_new to song_flags
    ALTER TABLE IF EXISTS song_flags_new RENAME TO song_flags;
    ALTER INDEX IF EXISTS idx_song_flags_new_track RENAME TO idx_song_flags_track;

    -- ============================================================
    -- PHASE 5: Views for backward compatibility
    -- ============================================================

    -- Latest classification per track
    CREATE OR REPLACE VIEW track_genres AS
    SELECT DISTINCT ON (t.id)
      t.id AS track_id,
      t.name,
      t.artist_name AS artist,
      t.artist_id,
      t.album_image,
      t.preview_url,
      t.duration_ms,
      t.rank,
      t.chart_source,
      c.genre_id AS genre,
      c.confidence,
      c.source AS classification_source,
      c.created_at AS classified_at
    FROM tracks t
    LEFT JOIN classifications c ON c.track_id = t.id
    ORDER BY t.id, c.created_at DESC;

    -- Tracks needing classification (no classification row yet)
    CREATE OR REPLACE VIEW unclassified_tracks AS
    SELECT t.*
    FROM tracks t
    LEFT JOIN classifications c ON c.track_id = t.id
    WHERE c.id IS NULL;

    -- Curated tracks with full metadata (replaces curated_songs queries)
    CREATE OR REPLACE VIEW curated_track_details AS
    SELECT
      t.id,
      t.name,
      t.artist_name AS artist,
      t.artist_id,
      t.album_image,
      t.preview_url,
      t.duration_ms,
      t.rank,
      t.chart_source,
      t.deezer_genres AS album_genres,
      cu.genre_id AS genre,
      cu.verified,
      cu.curated_by,
      cu.curated_at,
      cu.played_count,
      cu.found_count,
      cu.last_played
    FROM curation cu
    JOIN tracks t ON t.id = cu.track_id;
  `,
};
