import crypto from 'node:crypto';
import { pool, rawPool, run, all, get } from '../connection.js';

export async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows.length > 0;
}

export async function getTableCounts() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM game_scores) AS game_scores,
      (SELECT COUNT(*) FROM round_results) AS round_results,
      (SELECT COUNT(*) FROM friendships) AS friendships,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM game_players) AS game_players,
      (SELECT COUNT(*) FROM round_results_v2) AS round_results_v2
  `);
  return rows[0];
}

export async function cacheSongs(tracks) {
  const targetPool = pool;
  for (const t of tracks) {
    if (!t.id || !t.name || !t.artist) continue;
    const genres = Array.isArray(t.genres) && t.genres.length > 0
      ? JSON.stringify(t.genres)
      : JSON.stringify(t.genre ? [t.genre] : []);
    
    await targetPool.query(
      `INSERT INTO songs_cache (id, name, artist, album_image, preview_url, duration_ms, genre, genres, rank, source, chart_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         artist = EXCLUDED.artist,
         album_image = EXCLUDED.album_image,
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
  return rows.map(r => ({
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
  }));
}

export async function getSongCacheCounts() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM songs_cache) AS total,
      (SELECT COUNT(DISTINCT genre) FROM songs_cache) AS genres,
      (SELECT COUNT(*) FROM songs_played) AS plays
  `);
  return rows[0];
}

export async function getSongCacheByGenre() {
  const { rows } = await pool.query(`
    SELECT genre, COUNT(*) as count, MAX(fetched_at) as last_fetched
    FROM (
      SELECT jsonb_array_elements_text(genres) AS genre, fetched_at FROM songs_cache
      WHERE genres != '[]'::jsonb
      UNION ALL
      SELECT genre, fetched_at FROM songs_cache WHERE genre IS NOT NULL AND genres = '[]'::jsonb AND genre != ''
    ) sub
    GROUP BY genre
    ORDER BY count DESC
  `);
  return rows;
}

export async function getPlayedSongs(limit = 200) {
  const { rows } = await pool.query(`
    SELECT sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank,
      COUNT(sp.id) as play_count, MAX(sp.played_at) as last_played
    FROM songs_played sp
    JOIN songs_cache sc ON sp.song_id = sc.id
    GROUP BY sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank
    ORDER BY play_count DESC, last_played DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

export async function getAiEnrichmentStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) as unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version LIKE 'error:%') as errors,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version NOT LIKE 'error:%') as processed,
      MAX(ai_processed_at) as last_processed
    FROM songs_cache
  `);
  return rows[0];
}

export async function getAiGenreDistribution() {
  const { rows } = await pool.query(`
    SELECT g.genre, COUNT(*) as count
    FROM songs_cache
    CROSS JOIN LATERAL jsonb_array_elements_text(ai_genres) AS g(genre)
    WHERE ai_genres != '[]'::jsonb
    GROUP BY g.genre
    ORDER BY count DESC
  `);
  return rows;
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
