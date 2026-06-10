import pg from 'pg';

const url = 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const pool = new pg.Pool({ connectionString: url });

try {
  // Query 1: Find songs containing "lo" or "malo" or "mama"
  const { rows: songs } = await pool.query(`
    SELECT id, name, artist, genre, genres, ai_genres
    FROM songs_cache
    WHERE name ILIKE '%lo %' OR name ILIKE '%mama%' OR artist ILIKE '%lo %' OR artist ILIKE '%mama%'
    LIMIT 50
  `);
  console.log('Tracks matching "lo " or "mama":');
  console.table(songs);

} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
