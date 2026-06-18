import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
});

export async function fetchUnprocessedTracks(limit = config.batchSize) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT t.id, t.name, t.artist_name as artist, t.deezer_genres as genres,
             t.chart_source as "chartSource", t.rank
      FROM tracks t
      WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
      ORDER BY t.rank DESC
      LIMIT $1
    `, [limit]);
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchUnprocessedCount() {
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM tracks t
    WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
  `);
  return parseInt(rows[0].count, 10);
}

export async function updateAiClassification(id, result) {
  const genreId = result.genres && result.genres.length > 0 ? result.genres[0] : 'UNCLASSIFIED';
  const confidence = result.confidence && result.confidence[genreId] ? result.confidence[genreId] : 0;
  await pool.query(`
    INSERT INTO classifications (track_id, genre_id, confidence, source, tags, audio_genres, created_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
  `, [
    id,
    genreId,
    confidence,
    'ai:' + config.aiVersion,
    JSON.stringify(result.tags || []),
    JSON.stringify(result.audio_genres || []),
  ]);
}

export async function updateAiAudioGenres(id, audioGenres) {
  // Update the latest classification's audio_genres
  await pool.query(`
    UPDATE classifications
    SET audio_genres = $1::jsonb
    WHERE id = (
      SELECT id FROM classifications
      WHERE track_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    )
  `, [
    JSON.stringify(audioGenres),
    id,
  ]);
}

export async function markError(id, error) {
  await pool.query(`
    INSERT INTO classifications (track_id, genre_id, confidence, source, created_at)
    VALUES ($1, 'UNCLASSIFIED', 0, $2, NOW())
  `, [id, 'error:' + config.aiVersion]);
  console.error(`[AI] Marked error for ${id}: ${error}`);
}

export async function getAiStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM tracks) as total,
      (SELECT COUNT(*) FROM tracks t WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)) as unprocessed,
      (SELECT COUNT(*) FROM classifications WHERE source LIKE 'error:%') as errors,
      (SELECT COUNT(*) FROM classifications WHERE source NOT LIKE 'error:%') as processed,
      (SELECT MAX(created_at) FROM classifications) as last_processed
  `);
  return rows[0];
}

export async function getAiGenreDistribution() {
  const { rows } = await pool.query(`
    SELECT c.genre_id AS genre, COUNT(*) as count
    FROM classifications c
    GROUP BY c.genre_id
    ORDER BY count DESC
  `);
  return rows;
}

export function closePool() {
  return pool.end();
}
