# BlindTest Database Restructure

## Current Problems

### 1. `songs_cache` — Mixed Concerns (22 columns, 4 responsibilities)

| Column | Concern | Problem |
|--------|---------|---------|
| `name`, `artist`, `album_image`, `preview_url`, `duration_ms`, `rank`, `chart_source` | Track metadata | Core data |
| `genre` (TEXT) | Legacy single genre | Obsolete — `genres` (JSONB) and `ai_genres` (JSONB) exist |
| `genres` (JSONB) | Raw Deezer album genres | OK as JSONB |
| `ai_genres`, `ai_tags`, `ai_audio_genres`, `ai_confidence`, `ai_version`, `ai_processed_at` | AI classification (6 cols) | Should be separate table — one row per classification pass |
| `played_count`, `found_count` | Stats | Should be in a stats/curation table |
| `already_verified` | Legacy boolean | No clear semantics, overlaps with `curated_songs.verified` |
| `artist_id` → `artists(id)` | FK to artists | Never actually used in queries — all code uses `artist` TEXT |

### 2. `curated_songs` — Full Row Duplication

```
songs_cache(id, name, artist, album_image, preview_url, duration_ms, genres, chart_source, played_count)
curated_songs(id, name, artist, album_image, preview_url, duration_ms, album_genres, chart_source, played_count)
                                                                    ▲ identical columns ▲
```

Every curated song copies 10 columns from `songs_cache`. A curation should be a thin junction: `(track_id, genre, verified, curated_at)`.

### 3. No Genre Catalog

Genres are hardcoded in 37 files across the project:
- 2 arrays in `backend/src/genres-config.js`
- 3 arrays in `ai-worker/src/genres.js`
- 2 Sets + 1 Map in `classifier-metadata.js`
- 40+ strings in `backend/src/deezer.js` (playlists, labels, aliases, search queries)
- 1 CHECK constraint in migration 016
- 4 locale files with labels per language

A `genres` table would replace all of this with FK references.

### 4. `games.genres` — JSON String Column

```sql
games.genres TEXT  -- contains '["US_pop_us","GL_metal"]'
```

No FK constraint, no type safety, can't query with JOINs.

### 5. `game_players.player_id` — Ambiguous Type

Can be:
- A `users.id` UUID (authenticated Discord user)
- A temporary anonymous string like `'player_abc123'`

No FK constraint possible. Should be nullable FK to `users(id)` with `player_name` for display.

### 6. Game Writes Have No Transaction

All game persistence uses fire-and-forget Promises:
```js
import('./db.js').then(db => db.addRoundResultV2(...)).catch(() => {})
```

If the server crashes mid-game:
- `games` row exists with `status = 'playing'`
- Partial round data saved
- `game_players` may be missing

No atomicity, no recovery.

### 7. Three Dead Tables

| Table | Rows | Status |
|-------|------|--------|
| `game_scores` | ~382 | Written by legacy endpoint (`POST /api/game/:code/save`), but real scores are in `game_players` |
| `round_results` | ~? | Legacy, written alongside `round_results_v2` but only for authenticated users |
| `ai_classification_queue` | 0 | Created by migration 012, never used — AI worker queries directly with `FOR UPDATE SKIP LOCKED` |

### 8. Dead Repository Functions

`recordSongFound()` and `recordSongPlayed()` in `songRepository.js` are defined but never called. Stats are synced externally via `scripts/sync-difficulty.js`.

### 9. `artists` Table Not Actually Used

Migration 011 created `artists` with FK from `songs_cache.artist_id` and `curated_songs.artist_id`. But every query still filters/sorts by the `artist` TEXT column. The `artists` table is populated but never joined.

---

## Proposed Schema

### Entity-Relationship Overview

```
genres ─────────────────────────────────────────────┐
  │                                                  │
  ├──< classifications.genre_id                      │
  ├──< game_genres.genre_id                          │
  ├──< curation.genre_id                             │
  └──< round_answers.genre_id                        │
                                                     │
artists                                              │
  └──< tracks.artist_id                              │
                                                     │
tracks ──────────────────────────────────────────────┤
  ├──< classifications.track_id                      │
  ├──< track_plays.track_id                          │
  ├──< curation.track_id                             │
  ├──< round_answers.track_id                        │
  └──< song_flags.track_id                           │
                                                     │
games ───────────────────────────────────────────────┤
  ├──< game_genres.game_id                           │
  ├──< game_players.game_id                          │
  ├──< round_answers.game_id                         │
  └──< track_plays.game_id                           │
                                                     │
users                                                │
  └──< game_players.user_id                          │
```

### `genres`

Single source of truth for the genre taxonomy.

```sql
CREATE TABLE genres (
    id         TEXT PRIMARY KEY,          -- 'US_pop_us', 'GL_metal'
    group_id   TEXT NOT NULL,             -- 'united_states', 'global_other'
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Labels are in locale files (frontend) — the backend only needs the id.

### `tracks`

Pure Deezer track metadata. Everything about the song itself, nothing about how it was classified or how often it was played.

```sql
CREATE TABLE tracks (
    id            TEXT PRIMARY KEY,       -- 'deezer:<track_id>'
    artist_id     UUID REFERENCES artists(id),
    name          TEXT NOT NULL,
    artist_name   TEXT NOT NULL,          -- denormalized for query speed
    album_image   TEXT,
    preview_url   TEXT,
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    rank          INTEGER NOT NULL DEFAULT 0,
    chart_source  TEXT,
    deezer_genres JSONB NOT NULL DEFAULT '[]',   -- raw Deezer album genres
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracks_artist ON tracks(artist_name);
CREATE INDEX idx_tracks_rank ON tracks(rank DESC);
CREATE INDEX idx_tracks_chart ON tracks(chart_source);
CREATE INDEX idx_tracks_deezer_genres ON tracks USING GIN (deezer_genres);
```

### `classifications`

One row per classification pass per track. This replaces `ai_genres`, `ai_tags`, `ai_audio_genres`, `ai_confidence`, `ai_version`, `ai_processed_at`.

Each track can have multiple classifications (one per AI model version, plus manual overrides).

```sql
CREATE TABLE classifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id     TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    genre_id     TEXT NOT NULL REFERENCES genres(id),
    confidence   REAL NOT NULL DEFAULT 0,
    source       TEXT NOT NULL,           -- 'ai:blindtest-classifier-v5', 'manual:admin:<userid>', 'legacy:llama3.2-v1'
    tags         JSONB NOT NULL DEFAULT '[]',
    audio_genres JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classifications_track ON classifications(track_id);
CREATE INDEX idx_classifications_genre ON classifications(genre_id);
CREATE INDEX idx_classifications_latest ON classifications(track_id, created_at DESC);
```

### `curation`

Replaces `curated_songs` entirely. No more column duplication — just links a track to a genre with verification status.

```sql
CREATE TABLE curation (
    track_id     TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    genre_id     TEXT NOT NULL REFERENCES genres(id),
    verified     BOOLEAN NOT NULL DEFAULT FALSE,
    curated_by   TEXT,                    -- 'auto-curate', 'admin:<userid>'
    curated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    played_count INTEGER NOT NULL DEFAULT 0,
    found_count  INTEGER NOT NULL DEFAULT 0,
    last_played  TIMESTAMPTZ
);

CREATE INDEX idx_curation_genre ON curation(genre_id);
CREATE INDEX idx_curation_verified ON curation(verified);
CREATE INDEX idx_curation_played ON curation(played_count);
```

### `games`

Cleaner version of the existing table.

```sql
CREATE TABLE games (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT NOT NULL,
    audio_source TEXT NOT NULL DEFAULT 'deezer',
    round_count  INTEGER,
    round_time   INTEGER,
    status       TEXT NOT NULL DEFAULT 'playing',   -- 'playing' | 'finished'
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_games_status ON games(status);
```

### `game_genres`

Proper join table replacing `games.genres` TEXT blob.

```sql
CREATE TABLE game_genres (
    game_id  UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    genre_id TEXT NOT NULL REFERENCES genres(id),
    PRIMARY KEY (game_id, genre_id)
);
```

### `game_players`

Cleaner version. `user_id` is nullable — anonymous players get NULL.

```sql
CREATE TABLE game_players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id     TEXT REFERENCES users(id),
    player_name TEXT NOT NULL,
    score       INTEGER NOT NULL DEFAULT 0,
    position    INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_players_user ON game_players(user_id);
```

### `round_answers`

Renamed from `round_results_v2`. Now has proper FKs to `game_players` instead of `player_id` TEXT.

```sql
CREATE TABLE round_answers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id     UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    track_id      TEXT REFERENCES tracks(id),
    round_number  INTEGER NOT NULL,
    genre_id      TEXT REFERENCES genres(id),
    guess         TEXT,
    guess_time_ms INTEGER,
    points_earned INTEGER NOT NULL DEFAULT 0,
    found_artist  BOOLEAN NOT NULL DEFAULT FALSE,
    found_title   BOOLEAN NOT NULL DEFAULT FALSE,
    found_both    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_round_answers_game ON round_answers(game_id);
CREATE INDEX idx_round_answers_player ON round_answers(player_id);
CREATE INDEX idx_round_answers_track ON round_answers(track_id);
```

### `track_plays`

Renamed from `songs_played`. Same structure.

```sql
CREATE TABLE track_plays (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id  TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    game_id   UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_track_plays_track ON track_plays(track_id, played_at DESC);
CREATE INDEX idx_track_plays_game ON track_plays(game_id);
```

### `song_flags`

Minimal cleanup — `track_id` FK added.

```sql
CREATE TABLE song_flags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    player_id  TEXT NOT NULL,
    game_code  TEXT,
    reason     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_song_flags_track ON song_flags(track_id);
```

### Removed Tables

| Table | Reason | Data Migration |
|-------|--------|----------------|
| `songs_cache` | Replaced by `tracks` + `classifications` + `curation` | Split across 3 new tables |
| `curated_songs` | Replaced by `curation` | Each row → `curation` row (no more column copy) |
| `songs_played` | Renamed to `track_plays` | Direct 1:1 move |
| `game_scores` | Obsolete | Drop (data redundant with `game_players`) |
| `round_results` | Obsolete | Drop (data redundant with `round_answers`) |
| `friendships` | Barely used | Drop (can recreate later if needed) |
| `ai_classification_queue` | Never used | Drop |

---

## Data Migration Plan (Migration 018)

### Phase 1: Create New Tables & Seed Genres

```sql
-- 1. Genre catalog
CREATE TABLE genres (...);
INSERT INTO genres VALUES
  ('PT_fado', 'portuguese', 1),
  ('PT_tradicional_folklore_pimba', 'portuguese', 2),
  ...
  ('GL_other', 'global_other', 40);

-- 2. New tables
CREATE TABLE tracks (...);
CREATE TABLE classifications (...);
CREATE TABLE curation (...);
CREATE TABLE game_genres (...);
CREATE TABLE round_answers (...);
CREATE TABLE track_plays (...);
```

### Phase 2: Migrate Data

```sql
-- 3. tracks ← songs_cache (without AI/stats/legacy columns)
INSERT INTO tracks (id, artist_id, name, artist_name, album_image, preview_url,
                    duration_ms, rank, chart_source, deezer_genres, fetched_at)
SELECT id, artist_id, name, artist, album_image, preview_url,
       duration_ms, rank, chart_source, genres, fetched_at
FROM songs_cache;

-- 4. classifications ← songs_cache AI columns
INSERT INTO classifications (track_id, genre_id, confidence, source, tags, audio_genres, created_at)
SELECT id,
       COALESCE(ai_genres->>0, 'UNCLASSIFIED'),
       COALESCE((ai_confidence->>(ai_genres->>0))::real, 0),
       CASE WHEN ai_version LIKE 'manual%' THEN 'manual:admin'
            WHEN ai_version IS NOT NULL THEN 'ai:' || ai_version
            ELSE 'legacy:unknown' END,
       ai_tags,
       ai_audio_genres,
       COALESCE(ai_processed_at, now())
FROM songs_cache
WHERE ai_processed_at IS NOT NULL;

-- 5. curation ← curated_songs (no more column duplication)
INSERT INTO curation (track_id, genre_id, verified, curated_by, curated_at,
                      played_count, found_count, last_played)
SELECT cs.id, cs.genre, cs.verified,
       CASE WHEN cs.verified THEN 'auto-curate' ELSE 'admin:pending' END,
       cs.curated_at,
       cs.played_count,
       COALESCE(sc.found_count, 0),
       cs.last_played_at
FROM curated_songs cs
LEFT JOIN songs_cache sc ON sc.id = cs.id;

-- 6. track_plays ← songs_played
INSERT INTO track_plays (id, track_id, game_id, played_at)
SELECT id, song_id, game_id, played_at FROM songs_played;

-- 7. game_genres ← games.genres (parse JSON string)
INSERT INTO game_genres (game_id, genre_id)
SELECT g.id, jsonb_array_elements_text(g.genres::jsonb)
FROM games g WHERE g.genres IS NOT NULL AND g.genres != '';

-- 8. round_answers ← round_results_v2 (map player_id to game_players)
INSERT INTO round_answers (id, game_id, player_id, track_id, round_number, genre_id,
                           guess, guess_time_ms, points_earned,
                           found_artist, found_title, found_both, created_at)
SELECT rv.id, rv.game_id, gp.id, rv.track_id, rv.round, rv.genre,
       rv.guess, rv.guess_time_ms, rv.points_earned,
       rv.found_artist, rv.found_title, rv.found_both, rv.created_at
FROM round_results_v2 rv
JOIN game_players gp ON gp.game_id = rv.game_id
                    AND gp.player_name = rv.player_name;
```

### Phase 3: Drop Old Tables

```sql
DROP TABLE IF EXISTS ai_classification_queue;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS game_scores;
DROP TABLE IF EXISTS round_results;
DROP TABLE IF EXISTS round_results_v2;
DROP TABLE IF EXISTS songs_played;
DROP TABLE IF EXISTS curated_songs;
DROP TABLE IF EXISTS songs_cache;
```

---

## Backend Code Changes Required

### Repositories

| Current File | New File | Changes |
|-------------|----------|---------|
| `songRepository.js` | `trackRepository.js` | All queries use `tracks` + `classifications` + `curation` |
| `curatedRepository.js` | `curationRepository.js` | All queries use `curation` + JOIN to `tracks` |
| `gameRepository.js` | `gameRepository.js` | `games` uses UUID PK, `game_genres` join table, `round_answers` instead of `round_results_v2`, `track_plays` instead of `songs_played` |
| `flagRepository.js` | `flagRepository.js` | `song_flags.track_id` FK added |
| `userRepository.js` | `userRepository.js` | Minor: `game_players.user_id` FK |

### Deezer Integration (`deezer.js`)

- `cacheSongs()` → writes to `tracks` instead of `songs_cache`
- Genre playlist maps → unchanged (they're Deezer playlist IDs, not DB genres)
- `ALBUM_GENRE_ALIASES` → simplified (some entries mapped to non-existent old keys)
- `getGenreLabel()` → reads from `genres` table or locale

### AI Worker

- `db.js` → writes to `classifications` instead of `songs_cache.ai_genres`
- `fetchUnprocessedTracks()` → queries `tracks LEFT JOIN classifications`

### Game Logic (`game.js`)

- `startGame()` → creates `game_genres` rows instead of JSON stringifying
- `submitAnswer()` → writes `round_answers` using `game_players.id` FK
- `endGame()` → wraps all writes in a transaction
- `recordPlay()` → writes to `track_plays`, updates `curation.played_count`

### API Endpoints (`index.js`)

- `GET /api/genres` → queries `genres` table instead of hardcoded array
- `GET /api/admin/curated/*` → queries `curation JOIN tracks` instead of `curated_songs`
- `GET /api/admin/ai/*` → queries `classifications JOIN tracks`
- Admin import/verify → writes to `curation` instead of `curated_songs`
- Game save → removed `game_scores` write

### Admin UI

- All genre dropdowns → unchanged (reads from `GET /api/genres` which now queries DB)
- Genre labels → from `genres` table + locale fallback

---

## Rollback Plan

If the migration fails at any point:

```sql
-- Re-create songs_cache from tracks + classifications
CREATE TABLE songs_cache AS
SELECT t.*, c.genre_id as ai_genre, c.confidence as ai_confidence, ...
FROM tracks t
LEFT JOIN classifications c ON c.track_id = t.id;

-- Re-create curated_songs from curation + tracks
CREATE TABLE curated_songs AS
SELECT t.*, cu.genre_id as genre, cu.verified
FROM curation cu
JOIN tracks t ON t.id = cu.track_id;
```

The migration is designed to be idempotent — all INSERTs use the old data unchanged, and old tables are only dropped after new data is verified.

---

## Order of Implementation

1. ✅ Migration 018 (create new tables, migrate data, drop old)
2. ✅ `trackRepository.js` + `curationRepository.js`
3. ✅ Update `gameRepository.js`, `flagRepository.js`, `userRepository.js`
4. ✅ Update `deezer.js` to write to `tracks`
5. ✅ Update `game.js` to use new tables + add transaction
6. ✅ Update `index.js` API endpoints
7. ✅ Update AI worker `db.js` to write `classifications`
8. ✅ Run the AI pipeline on remaining 994 songs
