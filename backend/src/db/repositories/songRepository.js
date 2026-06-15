import crypto from 'node:crypto';
import { all, run } from '../connection.js';

export async function ping() {
  const rows = await all('SELECT 1 AS ok');
  return rows.length > 0;
}

export async function getTableCounts() {
  const [row] = await all(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM game_scores) AS game_scores,
      (SELECT COUNT(*) FROM round_results) AS round_results,
      (SELECT COUNT(*) FROM friendships) AS friendships,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM game_players) AS game_players,
      (SELECT COUNT(*) FROM round_results_v2) AS round_results_v2
  `);
  return row;
}

export async function cacheSongs(tracks) {
  for (const t of tracks) {
    if (!t.id || !t.name || !t.artist) continue;
    const genres = Array.isArray(t.genres) && t.genres.length > 0
      ? JSON.stringify(t.genres)
      : JSON.stringify(t.genre ? [t.genre] : []);

    await run(
      `INSERT INTO songs_cache (id, name, artist, album_image, preview_url, duration_ms, genre, genres, rank, source, chart_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         artist = EXCLUDED.artist,
         album_image = COALESCE(EXCLUDED.album_image, songs_cache.album_image),
         preview_url = COALESCE(EXCLUDED.preview_url, songs_cache.preview_url),
         duration_ms = EXCLUDED.duration_ms,
         genres = EXCLUDED.genres,
         rank = EXCLUDED.rank,
         chart_source = EXCLUDED.chart_source,
         fetched_at = NOW()`,
      [t.id, t.name, t.artist, t.albumImage || null, t.previewUrl || null, t.durationMs || 0, t.genre || null, genres, t.rank || 0, 'deezer', t.chartSource || null]
    );
  }
}

export async function recordPlay(songId, gameId) {
  await run(
    'INSERT INTO songs_played (id, song_id, game_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING',
    [crypto.randomUUID(), songId, gameId]
  );
}

export async function recordSongFound(songId) {
  await run(
    `UPDATE songs_cache SET found_count = COALESCE(found_count, 0) + 1
     WHERE id = ?`,
    [songId]
  );
}

export async function recordSongPlayed(songId) {
  await run(
    `UPDATE songs_cache SET played_count = COALESCE(played_count, 0) + 1
     WHERE id = ?`,
    [songId]
  );
}

function mapCachedTrackRow(r) {
  return {
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.album_image,
    previewUrl: r.preview_url || null,
    durationMs: r.duration_ms,
    genre: r.genre,
    genres: typeof r.genres === 'string' ? JSON.parse(r.genres) : (r.genres || []),
    chartSource: r.chart_source || null,
    rank: r.rank,
  };
}

export async function getCachedTracksByGenre(genre, count) {
  const rows = await all(
    `SELECT sc.*,
        COALESCE(
          CASE
            WHEN sp.last_played IS NULL THEN 1.0
            WHEN sp.last_played > NOW() - INTERVAL '1 hour' THEN 0.05
            WHEN sp.last_played > NOW() - INTERVAL '1 day' THEN 0.2
            WHEN sp.last_played > NOW() - INTERVAL '7 days' THEN 0.5
            ELSE 0.85
          END, 1.0
        ) as recency_weight
     FROM songs_cache sc
     LEFT JOIN (
       SELECT song_id, MAX(played_at) as last_played
       FROM songs_played
       GROUP BY song_id
     ) sp ON sp.song_id = sc.id
     WHERE (sc.genres @> ?::jsonb OR sc.genre = ? OR sc.ai_genres @> ?::jsonb)
     ORDER BY (sc.rank + 1000) * COALESCE(
       CASE
         WHEN sp.last_played IS NULL THEN 1.0
         WHEN sp.last_played > NOW() - INTERVAL '1 hour' THEN 0.05
         WHEN sp.last_played > NOW() - INTERVAL '1 day' THEN 0.2
         WHEN sp.last_played > NOW() - INTERVAL '7 days' THEN 0.5
         ELSE 0.85
       END, 1.0
     ) * random() DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, JSON.stringify([genre]), count * 3]
  );
  return rows.map(mapCachedTrackRow);
}

export async function getSongsByArtist(artist, count) {
  const curatedRows = await all(
    `SELECT id, name, artist, album_image as "albumImage",
            preview_url as "previewUrl", duration_ms as "durationMs",
            genre, album_genres as "albumGenres", played_count
     FROM curated_songs
     WHERE artist ILIKE ? AND preview_url IS NOT NULL
     ORDER BY played_count ASC, RANDOM()
     LIMIT ?`,
    [`%${artist}%`, count]
  );

  const results = curatedRows.map(r => ({
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.albumImage,
    previewUrl: r.previewUrl,
    durationMs: r.durationMs,
    genre: r.genre || 'artist_mode',
    albumGenres: typeof r.albumGenres === 'string' ? JSON.parse(r.albumGenres) : (r.albumGenres || []),
    rawId: r.id.replace('deezer:', ''),
  }));

  if (results.length >= count) return results;

  const cacheRows = await all(
    `SELECT sc.id, sc.name, sc.artist, sc.album_image as "albumImage",
            sc.preview_url as "previewUrl", sc.duration_ms as "durationMs",
            sc.genre, sc.genres as "albumGenres"
     FROM songs_cache sc
     WHERE sc.artist ILIKE ? AND sc.preview_url IS NOT NULL
     ORDER BY RANDOM()
     LIMIT ?`,
    [`%${artist}%`, count]
  );

  const existingIds = new Set(results.map(r => r.id));
  for (const r of cacheRows) {
    if (!existingIds.has(r.id)) {
      results.push({
        id: r.id,
        name: r.name,
        artist: r.artist,
        albumImage: r.albumImage,
        previewUrl: r.previewUrl,
        durationMs: r.durationMs,
        genre: r.genre || 'artist_mode',
        albumGenres: typeof r.albumGenres === 'string' ? JSON.parse(r.albumGenres) : (r.albumGenres || []),
        rawId: r.id.replace('deezer:', ''),
      });
    }
    if (results.length >= count) break;
  }

  return results;
}

export async function getDiscoveryCandidates(genre, limit = 20) {
  return all(
    `SELECT sc.id, sc.name, sc.artist, sc.preview_url, sc.duration_ms,
            sc.genre, sc.genres, sc.chart_source, sc.rank
     FROM songs_cache sc
     LEFT JOIN curated_songs cs ON cs.id = sc.id
     WHERE cs.id IS NULL
       AND (sc.genres @> ?::jsonb OR sc.genre = ? OR sc.ai_genres @> ?::jsonb)
       AND sc.preview_url IS NOT NULL
     ORDER BY sc.rank DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, JSON.stringify([genre]), limit]
  );
}

export async function getDiscoveryCandidatesAll(limit = 100) {
  return all(
    `SELECT sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank
     FROM songs_cache sc
     LEFT JOIN curated_songs cs ON cs.id = sc.id
     WHERE cs.id IS NULL AND sc.preview_url IS NOT NULL
     ORDER BY sc.rank DESC
     LIMIT ?`,
    [limit]
  );
}

export async function searchAiEnrichedTracks(pattern, limit) {
  return all(
    `SELECT id, name, artist, genre, preview_url, ai_genres, ai_tags, ai_confidence, ai_processed_at
     FROM songs_cache
     WHERE ai_processed_at IS NOT NULL
       AND ai_version NOT LIKE 'error:%'
       AND (
         EXISTS (SELECT 1 FROM jsonb_array_elements_text(ai_tags) tag WHERE tag ILIKE ?)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(ai_genres) g WHERE g ILIKE ?)
         OR name ILIKE ?
         OR artist ILIKE ?
       )
     ORDER BY ai_processed_at DESC
     LIMIT ?`,
    [pattern, pattern, pattern, pattern, limit]
  );
}

export async function getRecentAiEnrichedTracks(limit) {
  return all(
    `SELECT id, name, artist, genre, ai_genres, ai_tags, ai_processed_at
     FROM songs_cache
     WHERE ai_processed_at IS NOT NULL AND ai_version NOT LIKE 'error:%'
     ORDER BY ai_processed_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getUnclassifiedTracks() {
  return all(
    `SELECT id, name, artist, album_image, genre, ai_genres, ai_confidence, rank, preview_url
     FROM songs_cache
     WHERE ai_genres->>0 = 'UNCLASSIFIED'
     ORDER BY rank DESC NULLS LAST
     LIMIT 200`
  );
}

export async function updateSongGenre(id, genre) {
  await run(
    `UPDATE songs_cache
     SET ai_genres = jsonb_build_array(?::text),
         ai_confidence = jsonb_build_object(?::text, 0.95),
         ai_processed_at = NOW(),
         ai_version = 'manual-v1'
     WHERE id = ?`,
    [genre, genre, id]
  );
}

export async function getSongById(id) {
  const [row] = await all('SELECT * FROM songs_cache WHERE id = ?', [id]);
  return row || null;
}

export async function getSongCacheCounts() {
  const [row] = await all(`
    SELECT
      (SELECT COUNT(*) FROM songs_cache) AS total,
      (SELECT COUNT(DISTINCT genre) FROM songs_cache) AS genres,
      (SELECT COUNT(*) FROM songs_played) AS plays
  `);
  return row;
}

export async function getSongCacheByGenre() {
  return all(`
    SELECT genre, COUNT(*) as count, MAX(fetched_at) as last_fetched
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(
        NULLIF(ai_genres, '[]'::jsonb),
        NULLIF(genres, '[]'::jsonb)
      )) AS genre, fetched_at FROM songs_cache
      UNION ALL
      SELECT genre, fetched_at FROM songs_cache
      WHERE (ai_genres IS NULL OR ai_genres = '[]'::jsonb)
        AND (genres IS NULL OR genres = '[]'::jsonb)
        AND genre IS NOT NULL AND genre != ''
    ) sub
    GROUP BY genre
    ORDER BY count DESC
  `);
}

export async function getPlayedSongs(limit = 200) {
  return all(`
    SELECT sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank,
      COUNT(sp.id) as play_count, MAX(sp.played_at) as last_played
    FROM songs_played sp
    JOIN songs_cache sc ON sp.song_id = sc.id
    GROUP BY sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank
    ORDER BY play_count DESC, last_played DESC
    LIMIT ?
  `, [limit]);
}

export async function getAiEnrichmentStats() {
  const [row] = await all(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) as unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version LIKE 'error:%') as errors,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version NOT LIKE 'error:%') as processed,
      MAX(ai_processed_at) as last_processed
    FROM songs_cache
  `);
  return row;
}

export async function getAiGenreDistribution() {
  return all(`
    SELECT g.genre, COUNT(*) as count
    FROM songs_cache
    CROSS JOIN LATERAL jsonb_array_elements_text(ai_genres) AS g(genre)
    WHERE ai_genres != '[]'::jsonb
    GROUP BY g.genre
    ORDER BY count DESC
  `);
}

export async function getUnprocessedTracks(limit = 50) {
  return all(
    `SELECT id, name, artist, genre, genres, chart_source, rank
     FROM songs_cache
     WHERE ai_processed_at IS NULL
     ORDER BY rank DESC
     LIMIT ?`,
    [limit]
  );
}
