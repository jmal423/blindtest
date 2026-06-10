import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
});

export async function fetchUnprocessedTracks(limit = config.batchSize) {
  const { rows } = await pool.query(`
    SELECT id, name, artist, album_image, genre, genres, chart_source, rank
    FROM songs_cache
    WHERE ai_processed_at IS NULL
       OR ai_version IS DISTINCT FROM $1
    ORDER BY rank DESC
    LIMIT $2
  `, [config.aiVersion, limit]);
  return rows;
}

export async function fetchUnprocessedCount() {
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM songs_cache
    WHERE ai_processed_at IS NULL
       OR ai_version IS DISTINCT FROM $1
  `, [config.aiVersion]);
  return parseInt(rows[0].count, 10);
}

export async function updateAiClassification(id, result) {
  await pool.query(`
    UPDATE songs_cache
    SET ai_genres = $1::jsonb,
        ai_tags = $2::jsonb,
        ai_confidence = $3::jsonb,
        ai_processed_at = NOW(),
        ai_version = $4
    WHERE id = $5
  `, [
    JSON.stringify(result.genres),
    JSON.stringify(result.tags),
    JSON.stringify(result.confidence),
    config.aiVersion,
    id,
  ]);
}

export async function updateAiAudioGenres(id, audioGenres) {
  await pool.query(`
    UPDATE songs_cache
    SET ai_audio_genres = $1::jsonb,
        ai_processed_at = NOW(),
        ai_version = $2
    WHERE id = $3
  `, [
    JSON.stringify(audioGenres),
    config.aiVersion,
    id,
  ]);
}

export async function markError(id, error) {
  await pool.query(`
    UPDATE songs_cache
    SET ai_processed_at = NOW(),
        ai_version = $1
    WHERE id = $2
  `, ['error:' + config.aiVersion, id]);
  console.error(`[AI] Marked error for ${id}: ${error}`);
}

export async function getAiStats() {
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
    SELECT jsonb_array_elements_text(ai_genres) AS genre,
           COUNT(*) as count
    FROM songs_cache
    WHERE ai_genres != '[]'::jsonb
    GROUP BY genre
    ORDER BY count DESC
  `);
  return rows;
}

export function closePool() {
  return pool.end();
}
