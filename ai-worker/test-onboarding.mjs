import pg from 'pg';
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const r = await p.query("SELECT preview_url FROM songs_cache WHERE preview_url IS NOT NULL ORDER BY RANDOM() LIMIT 1");
console.log('Preview:', r.rows[0]?.preview_url?.slice(0, 60) || 'NONE');

const correct = await p.query("SELECT name, artist, preview_url FROM songs_cache WHERE preview_url IS NOT NULL AND artist IS NOT NULL ORDER BY RANDOM() LIMIT 1");
console.log('Quiz track:', correct.rows[0]?.name, '-', correct.rows[0]?.artist);

if (correct.rows[0]) {
  const wrong = await p.query("SELECT DISTINCT artist FROM songs_cache WHERE artist != $1 AND artist IS NOT NULL ORDER BY RANDOM() LIMIT 3", [correct.rows[0].artist]);
  console.log('Wrong artists:', wrong.rows.map(r => r.artist));
}

await p.end();
