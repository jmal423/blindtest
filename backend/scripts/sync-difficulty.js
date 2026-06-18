// Syncs played_count and found_count from game results into curation table.
// Run periodically: node scripts/sync-difficulty.js
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });

async function syncDifficulty() {
  console.log('[Difficulty] Syncing played/found counts from game results...');

  // Aggregate from round_answers (replaces old round_results_v2)
  const { rows } = await pool.query(`
    SELECT LOWER(ra.track_name) as name, LOWER(ra.track_artist) as artist,
           COUNT(*)::int as plays,
           SUM(CASE WHEN ra.found_both THEN 1 ELSE 0 END)::int as found
    FROM round_answers ra
    WHERE ra.track_name IS NOT NULL
    GROUP BY LOWER(ra.track_name), LOWER(ra.track_artist)
  `);

  console.log(`[Difficulty] ${rows.length} songs with game data`);

  // Update curation table with aggregated counts (match by track name + artist ILIKE)
  let updated = 0;
  for (const row of rows) {
    const q = await pool.query(`
      UPDATE curation cu
      SET played_count = GREATEST(cu.played_count, $1),
          found_count  = GREATEST(cu.found_count, $2)
      FROM tracks t
      WHERE t.id = cu.track_id
        AND LOWER(t.name) = $3
        AND LOWER(t.artist_name) ILIKE $4
    `, [row.plays, row.found, row.name, `%${row.artist}%`]);
    if (q.rowCount > 0) updated++;
  }

  console.log(`[Difficulty] Updated ${updated} curation rows`);

  // Auto-demote: mark songs with <10% find rate (5+ plays) as unverified
  const { rows: bad } = await pool.query(`
    SELECT cu.track_id, t.name, t.artist_name as artist,
           cu.played_count, cu.found_count
    FROM curation cu
    JOIN tracks t ON t.id = cu.track_id
    WHERE cu.played_count >= 5
      AND (COALESCE(cu.found_count, 0)::float / cu.played_count) < 0.1
      AND cu.verified = TRUE
  `);

  if (bad.length > 0) {
    console.log(`[Difficulty] Auto-demoting ${bad.length} songs (found rate < 10%)`);
    for (const b of bad) {
      await pool.query('UPDATE curation SET verified = FALSE WHERE track_id = $1', [b.track_id]);
      const rate = ((Number(b.found_count || 0) / Number(b.played_count)) * 100).toFixed(0);
      console.log(`  ✗ ${b.name} - ${b.artist} (${b.played_count} plays, ${rate}% found)`);
    }
  } else {
    console.log('[Difficulty] No songs to demote');
  }

  await pool.end();
}

syncDifficulty().catch(err => {
  console.error('[Difficulty] Fatal:', err.message);
  process.exit(1);
});
