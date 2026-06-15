// Syncs played_count and found_count from actual game results into songs_cache.
// Run periodically after games: node scripts/sync-difficulty.js
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });

async function syncDifficulty() {
  console.log('[Difficulty] Syncing played/found counts from game results...');

  const { rows } = await pool.query(`
    SELECT track_name, track_artist,
           COUNT(*) as plays,
           SUM(CASE WHEN found_both THEN 1 ELSE 0 END) as found
    FROM round_results_v2
    GROUP BY track_name, track_artist
  `);

  console.log(`[Difficulty] ${rows.length} songs with game data`);

  let updated = 0;
  for (const row of rows) {
    const q = await pool.query(
      `UPDATE songs_cache
       SET played_count = $1, found_count = $2
       WHERE name = $3 AND artist ILIKE $4 AND (played_count IS NULL OR played_count < $1)`,
      [row.plays, row.found, row.track_name, `%${row.track_artist}%`]
    );
    if (q.rowCount > 0) updated++;
  }

  console.log(`[Difficulty] Updated ${updated} songs_cache rows`);

  // Auto-demote: mark songs with poor find rate as unverified in curated_songs
  const { rows: bad } = await pool.query(`
    SELECT cs.id, cs.name, cs.artist, sc.played_count, sc.found_count
    FROM curated_songs cs
    JOIN songs_cache sc ON sc.id = cs.id
    WHERE sc.played_count >= 5
      AND (COALESCE(sc.found_count, 0)::float / sc.played_count) < 0.1
      AND cs.verified = TRUE
  `);

  if (bad.length > 0) {
    console.log(`[Difficulty] Auto-demoting ${bad.length} songs (found rate < 10%)`);
    for (const b of bad) {
      await pool.query('UPDATE curated_songs SET verified = FALSE WHERE id = $1', [b.id]);
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
