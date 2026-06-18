import pg from 'pg';
import { classifyTrack } from './src/classifier-metadata.js';

const pool = new pg.Pool({ connectionString: 'postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest' });

const MIN_CONFIDENCE = 0.7;
const limit = parseInt(process.argv[2] || '100000', 10);

const { rows: songs } = await pool.query(`
  SELECT cu.track_id, t.name, t.artist_name, cu.genre_id as current_genre
  FROM curation cu
  JOIN tracks t ON t.id = cu.track_id
  ORDER BY cu.genre_id, t.artist_name
  LIMIT $1
`, [limit]);

console.log(`Checking ${songs.length} curated songs against AI model...\n`);

let updated = 0;
let skipped = 0;

for (const s of songs) {
  const track = { name: s.name, artist: s.artist_name, genres: [] };
  let result;
  try {
    result = await classifyTrack(track);
  } catch (err) {
    console.log(`  ERROR: "${s.name}" - ${err.message}`);
    skipped++;
    continue;
  }

  const aiGenre = result.genres?.[0] || '';
  const conf = result.confidenceScore || 0;

  if (aiGenre && aiGenre !== s.current_genre && conf >= MIN_CONFIDENCE) {
    await pool.query(
      `UPDATE curation SET genre_id = $1, verified = true, curated_by = 'ai-auto-fix' WHERE track_id = $2`,
      [aiGenre, s.track_id]
    );
    console.log(`  ✓ ${s.artist_name} - "${s.name}": ${s.current_genre} → ${aiGenre} (${(conf * 100).toFixed(0)}%)`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped + updated - updated} skipped`);
await pool.end();
