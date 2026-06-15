// Cleans up misattributed artist tracks from songs_cache.
// Run after changing artist mode: node scripts/clean-artist-cache.js
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });

const GROUPS = [
  ["Booba","Ninho","PNL","Damso","Orelsan","Jul","Gims","Nekfeu"],
  ["Lady Gaga","Rihanna","Beyoncé","Ariana Grande","Katy Perry","Dua Lipa","Taylor Swift"],
  ["Bárbara Bandeira","Ivandro","Nininho Vaz Maia","Plutónio","Wet Bed Gang","Slow J","Piruka"],
  ["Anitta","Ludmilla","Pedro Sampaio","Menos é Mais","Luísa Sonza","Kevin o Chris"],
  ["Queen","The Beatles","AC/DC","Nirvana","Red Hot Chili Peppers","Linkin Park","Coldplay"],
  ["Bad Bunny","J Balvin","Daddy Yankee","Maluma","Ozuna","Karol G"]
];

async function main() {
  const allArtists = GROUPS.flat();
  const lowerArtists = allArtists.map(a => a.toLowerCase());

  const { rows } = await pool.query("SELECT id, name, artist FROM songs_cache WHERE chart_source = 'artist'");
  let removed = 0;
  for (const row of rows) {
    const lower = row.artist.toLowerCase();
    const matches = lowerArtists.some(a => lower.includes(a) || a.includes(lower));
    if (!matches) {
      console.log(`  REMOVE: ${row.name} - ${row.artist}`);
      await pool.query('DELETE FROM songs_cache WHERE id = $1', [row.id]);
      removed++;
    }
  }
  console.log(`Removed ${removed} misattributed tracks`);

  const { rows: remaining } = await pool.query(
    "SELECT artist, COUNT(*) as cnt FROM songs_cache WHERE chart_source = 'artist' GROUP BY artist ORDER BY artist"
  );
  console.log('\nRemaining artist tracks:');
  for (const row of remaining) console.log(`  ${row.artist}: ${row.cnt}`);
  console.log(`Total: ${remaining.reduce((a, r) => a + Number(r.cnt), 0)} tracks`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
