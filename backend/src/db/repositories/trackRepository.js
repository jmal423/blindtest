import { query, get, all, run } from '../connection.js';

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    artist: r.artist_name || r.artist,
    artistName: r.artist_name,
    albumImage: r.album_image,
    previewUrl: r.preview_url,
    durationMs: r.duration_ms,
    rank: r.rank,
    chartSource: r.chart_source,
    deezerGenres: typeof r.deezer_genres === 'string' ? JSON.parse(r.deezer_genres) : (r.deezer_genres || []),
    rawId: r.raw_id || (r.id ? r.id.replace('deezer:', '') : null),
    genre: r.genre,
    aiGenre: r.ai_genre,
    aiConfidence: r.ai_confidence,
    verified: r.verified,
    curatedBy: r.curated_by,
    playedCount: r.played_count,
    foundCount: r.found_count,
    lastPlayed: r.last_played,
  };
}

function mapRows(rows) {
  return rows.map(mapRow);
}

export async function ping() {
  const row = await get('SELECT 1 AS ok');
  return row;
}

// ─── Track Cache ──────────────────────────────────────────────

export async function cacheSongs(tracks) {
  for (const t of tracks) {
    const genresJson = JSON.stringify(t.genres || []);
    await run(
      `INSERT INTO tracks (id, name, artist_name, album_image, preview_url, duration_ms, rank, chart_source, deezer_genres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         artist_name = EXCLUDED.artist_name,
         album_image = COALESCE(EXCLUDED.album_image, tracks.album_image),
         preview_url = COALESCE(EXCLUDED.preview_url, tracks.preview_url),
         duration_ms = EXCLUDED.duration_ms,
         rank = EXCLUDED.rank,
         chart_source = EXCLUDED.chart_source,
         deezer_genres = EXCLUDED.deezer_genres,
         fetched_at = NOW()`,
      [t.id, t.name, t.artist, t.albumImage, t.previewUrl, t.durationMs, t.rank || 0, t.chartSource || null, genresJson]
    );
  }
}

export async function cacheSongsFromDeezer(tracks) {
  for (const t of tracks) {
    const genresJson = JSON.stringify(t.genres || []);
    await run(
      `INSERT INTO tracks (id, name, artist_name, album_image, preview_url, duration_ms, rank, chart_source, deezer_genres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         artist_name = EXCLUDED.artist_name,
         album_image = COALESCE(EXCLUDED.album_image, tracks.album_image),
         preview_url = COALESCE(EXCLUDED.preview_url, tracks.preview_url),
         duration_ms = EXCLUDED.duration_ms,
         rank = EXCLUDED.rank,
         chart_source = EXCLUDED.chart_source,
         deezer_genres = EXCLUDED.deezer_genres,
         fetched_at = NOW()`,
      [t.id, t.name, t.artist, t.albumImage, t.previewUrl, t.durationMs, t.rank || 0, t.chartSource || null, genresJson]
    );
  }
}

// ─── Play History ─────────────────────────────────────────────

export async function recordPlay(songId, gameId) {
  await run(
     `INSERT INTO track_plays (id, track_id, game_id)
      VALUES (gen_random_uuid(), ?, ?)
      ON CONFLICT (id) DO NOTHING`,
    [songId, gameId]
  );
}

export async function recordSongFound(songId) {
  await run(
    `UPDATE curation SET found_count = COALESCE(found_count, 0) + 1 WHERE track_id = ?`,
    [songId]
  );
}

export async function recordSongPlayed(songId) {
  await run(
    `UPDATE curation SET played_count = COALESCE(played_count, 0) + 1, last_played = NOW() WHERE track_id = ?`,
    [songId]
  );
}

// ─── Track Queries ────────────────────────────────────────────

export async function getCachedTracksByGenre(genre, count) {
  const multiplier = 3;
  const rows = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            COALESCE(c.genre_id, cu.genre_id) as genre,
            c.genre_id as ai_genre,
            c.confidence as ai_confidence,
            cu.verified, cu.played_count, cu.found_count,
            COALESCE(
              CASE WHEN tp.last_played IS NULL THEN 1.0
                   WHEN tp.last_played > NOW() - INTERVAL '1 hour' THEN 0.05
                   WHEN tp.last_played > NOW() - INTERVAL '24 hours' THEN 0.1
                   WHEN tp.last_played > NOW() - INTERVAL '7 days' THEN 0.2
                   WHEN tp.last_played > NOW() - INTERVAL '30 days' THEN 0.5
              ELSE 1.0 END, 1.0
            ) as recency_weight
     FROM tracks t
     LEFT JOIN LATERAL (
       SELECT genre_id, confidence FROM classifications
       WHERE track_id = t.id ORDER BY created_at DESC LIMIT 1
     ) c ON TRUE
     LEFT JOIN LATERAL (
       SELECT MAX(played_at) as last_played FROM track_plays WHERE track_id = t.id
     ) tp ON TRUE
     LEFT JOIN curation cu ON cu.track_id = t.id
     WHERE (t.deezer_genres @> ?::jsonb OR c.genre_id = ? OR cu.genre_id = ?)
       AND t.preview_url IS NOT NULL
     ORDER BY (t.rank + 1000) * recency_weight * RANDOM() DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, genre, count * multiplier]
  );
  return mapRows(rows).slice(0, count);
}

export async function getSongsByArtist(artist, count) {
  // First try curated + verified
  const curated = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            cu.genre_id as genre, cu.verified, cu.played_count
     FROM tracks t
     JOIN curation cu ON cu.track_id = t.id
     WHERE t.artist_name ILIKE ? AND cu.verified = TRUE AND t.preview_url IS NOT NULL
      ORDER BY RANDOM()
     LIMIT ?`,
    [`%${artist}%`, count]
  );

  const curatedMapped = mapRows(curated);
  if (curatedMapped.length >= count) return curatedMapped.slice(0, count);

  // Fallback to all tracks
  const fallback = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            c.genre_id as genre
     FROM tracks t
     LEFT JOIN LATERAL (
       SELECT genre_id FROM classifications WHERE track_id = t.id ORDER BY created_at DESC LIMIT 1
     ) c ON TRUE
     WHERE t.artist_name ILIKE ? AND t.preview_url IS NOT NULL
     ORDER BY RANDOM()
     LIMIT ?`,
    [`%${artist}%`, count]
  );

  // Merge, deduplicate by id
  const fallbackMapped = mapRows(fallback);
  const seen = new Set(curatedMapped.map(s => s.id));
  return [...curatedMapped, ...fallbackMapped.filter(s => !seen.has(s.id))].slice(0, count);
}

// ─── Discovery (Admin) ────────────────────────────────────────

export async function getDiscoveryCandidates(genre, limit) {
  return all(
    `SELECT t.*, c.genre_id as ai_genre, c.confidence, c.source as ai_version
     FROM tracks t
     LEFT JOIN LATERAL (
       SELECT genre_id, confidence, source FROM classifications WHERE track_id = t.id ORDER BY created_at DESC LIMIT 1
     ) c ON TRUE
     LEFT JOIN curation cu ON cu.track_id = t.id
     WHERE cu.track_id IS NULL
       AND (t.deezer_genres @> ?::jsonb OR c.genre_id = ?)
       AND t.preview_url IS NOT NULL
     ORDER BY t.rank DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, limit]
  );
}

export async function getDiscoveryCandidatesAll(limit) {
  return all(
    `SELECT t.*, c.genre_id as ai_genre, c.confidence, c.source as ai_version
     FROM tracks t
     LEFT JOIN LATERAL (
       SELECT genre_id, confidence, source FROM classifications WHERE track_id = t.id ORDER BY created_at DESC LIMIT 1
     ) c ON TRUE
     LEFT JOIN curation cu ON cu.track_id = t.id
     WHERE cu.track_id IS NULL AND t.preview_url IS NOT NULL
     ORDER BY t.rank DESC
     LIMIT ?`,
    [limit]
  );
}

export async function searchAiEnrichedTracks(pattern, limit) {
  const like = `%${pattern}%`;
  return all(
    `SELECT DISTINCT t.id, t.name, t.artist_name as artist, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            c.genre_id as ai_genre, c.tags as ai_tags, c.confidence as ai_confidence,
            c.source as ai_version, c.created_at as ai_processed_at
     FROM tracks t
     JOIN classifications c ON c.track_id = t.id
     WHERE (EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.tags) tag WHERE tag ILIKE ?)
        OR c.genre_id ILIKE ?
        OR t.name ILIKE ?
        OR t.artist_name ILIKE ?)
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [like, like, like, like, limit]
  );
}

export async function getRecentAiEnrichedTracks(limit) {
  return all(
    `SELECT t.id, t.name, t.artist_name as artist, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            c.genre_id as ai_genre, c.confidence as ai_confidence,
            c.tags as ai_tags,
            c.source as ai_version, c.created_at as ai_processed_at
     FROM tracks t
     JOIN classifications c ON c.track_id = t.id
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getUnclassifiedTracks() {
  return all(
    `SELECT t.id, t.name, t.artist_name as artist, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            'UNCLASSIFIED' as ai_genre
     FROM tracks t
     WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
        OR EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id AND c.genre_id = 'UNCLASSIFIED' ORDER BY c.created_at DESC LIMIT 1)
     ORDER BY t.rank DESC NULLS LAST`
  );
}

export async function updateSongGenre(id, genre) {
  await run(
    `INSERT INTO classifications (track_id, genre_id, confidence, source, created_at)
     VALUES (?, ?, 0.95, 'manual:admin', NOW())
     ON CONFLICT DO NOTHING`,
    [id, genre]
  );
}

export async function getSongById(id) {
  return get(
    `SELECT t.*, c.genre_id as ai_genre, c.confidence as ai_confidence,
            c.source as ai_version, c.created_at as ai_processed_at,
            cu.verified, cu.curated_by, cu.played_count, cu.found_count
     FROM tracks t
     LEFT JOIN LATERAL (
       SELECT genre_id, confidence, source, created_at FROM classifications WHERE track_id = t.id ORDER BY created_at DESC LIMIT 1
     ) c ON TRUE
     LEFT JOIN curation cu ON cu.track_id = t.id
     WHERE t.id = ?`,
    [id]
  );
}

export async function getSongCacheCounts() {
  return get(
    `SELECT
       (SELECT COUNT(*) FROM tracks) AS total,
       (SELECT COUNT(DISTINCT genre_id) FROM classifications) AS genres,
       (SELECT COUNT(*) FROM track_plays) AS plays`
  );
}

export async function getSongCacheByGenre() {
  return all(
    `SELECT c.genre_id as genre, COUNT(*) as count, MAX(c.created_at) as last_fetched
     FROM classifications c
     GROUP BY c.genre_id
     ORDER BY count DESC`
  );
}

export async function getPlayedSongs(limit) {
  return all(
    `SELECT t.*, COUNT(tp.id) as play_count, MAX(tp.played_at) as last_played
     FROM track_plays tp
     JOIN tracks t ON tp.track_id = t.id
     GROUP BY t.id
     ORDER BY play_count DESC, last_played DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getAiEnrichmentStats() {
  return get(
    `SELECT
       (SELECT COUNT(*) FROM tracks) as total,
       (SELECT COUNT(*) FROM tracks t WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)) as unprocessed,
       (SELECT COUNT(*) FROM classifications WHERE source LIKE 'error:%') as errors,
       (SELECT COUNT(*) FROM classifications WHERE source NOT LIKE 'error:%') as processed,
       (SELECT MAX(created_at) FROM classifications) as last_processed`
  );
}

export async function getAiGenreDistribution() {
  return all(
    `SELECT c.genre_id as genre, COUNT(*) as count
     FROM classifications c
     GROUP BY c.genre_id
     ORDER BY count DESC`
  );
}

export async function getUnprocessedTracks(limit) {
  return all(
    `SELECT t.id, t.name, t.artist_name as artist, t.deezer_genres as genres, t.chart_source, t.rank
     FROM tracks t
     WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
     ORDER BY t.rank DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getTableCounts() {
  return get(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM game_players) AS game_players,
      (SELECT COUNT(*) FROM tracks) AS tracks,
      (SELECT COUNT(*) FROM classifications) AS classifications,
      (SELECT COUNT(*) FROM curation) AS curation,
      (SELECT COUNT(*) FROM track_plays) AS track_plays,
      (SELECT COUNT(*) FROM round_answers) AS round_answers,
      (SELECT COUNT(*) FROM song_flags) AS song_flags,
      (SELECT COUNT(*) FROM game_genres) AS game_genres,
      (SELECT COUNT(*) FROM genres) AS genres
  `);
}

// ─── Backward compatibility aliases ───────────────────────────

export const cacheTrack = cacheSongs;
export const getTrackById = getSongById;
