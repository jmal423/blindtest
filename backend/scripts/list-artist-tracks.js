// Lists all artist-mode tracks in songs_cache.
// node scripts/list-artist-tracks.js [artist-name]
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });

async function main() {
  const filter = process.argv[2];
  let query;
  let params;

  if (filter) {
    query = `SELECT id, name, artist, rank FROM songs_cache WHERE chart_source = 'artist' AND artist ILIKE $1 ORDER BY artist, rank DESC`;
    params = [`%${filter}%`];
  } else {
    query = `SELECT artist, COUNT(*) as cnt FROM songs_cache WHERE chart_source = 'artist' GROUP BY artist ORDER BY artist`;
    params = [];
  }

  const { rows } = await pool.query(query, params);

  if (filter) {
    console.log(`Tracks matching "${filter}":`);
    for (const row of rows) console.log(`  ${row.name} — ${row.artist} (rank: ${row.rank || 'N/A'})`);
    console.log(`Total: ${rows.length}`);
  } else {
    console.log('Artist tracks in cache:');
    for (const row of rows) console.log(`  ${row.artist}: ${row.cnt} tracks`);
    console.log(`\nTotal artists: ${rows.length}`);
    console.log('Use: node scripts/list-artist-tracks.js "Artist Name" to see specific tracks');
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
