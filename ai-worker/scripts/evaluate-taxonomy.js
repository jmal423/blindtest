import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyTrack } from '../src/classifier-metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const LOCAL_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';
const pool = new pg.Pool({ connectionString: LOCAL_URL });

async function main() {
  console.log('Fetching representative tracks for evaluation...');

  // Diverse test set query
  const query = `
    (SELECT id, name, artist, genres, 'french' as category FROM songs_cache 
     WHERE artist ILIKE '%PLK%' OR artist ILIKE '%Jul%' OR artist ILIKE '%GIMS%' OR artist ILIKE '%Aya Nakamura%' OR artist ILIKE '%Ninho%' LIMIT 8)
    UNION ALL
    (SELECT id, name, artist, genres, 'portuguese/brazilian' as category FROM songs_cache 
     WHERE artist ILIKE '%Slow J%' OR artist ILIKE '%Ivandro%' OR artist ILIKE '%T-Rex%' OR artist ILIKE '%Quim Barreiros%' OR artist ILIKE '%Anitta%' OR artist ILIKE '%Livinho%' LIMIT 8)
    UNION ALL
    (SELECT id, name, artist, genres, 'spanish' as category FROM songs_cache 
     WHERE artist ILIKE '%Bad Bunny%' OR artist ILIKE '%Karol G%' OR artist ILIKE '%Rosalía%' OR artist ILIKE '%Feid%' OR artist ILIKE '%Don Omar%' OR artist ILIKE '%Shakira%' LIMIT 8)
    UNION ALL
    (SELECT id, name, artist, genres, 'us/uk' as category FROM songs_cache 
     WHERE artist ILIKE '%Taylor Swift%' OR artist ILIKE '%Eminem%' OR artist ILIKE '%Coldplay%' OR artist ILIKE '%Oasis%' OR artist ILIKE '%Michael Jackson%' OR artist ILIKE '%Linkin Park%' LIMIT 8)
    UNION ALL
    (SELECT id, name, artist, genres, 'other' as category FROM songs_cache 
     WHERE genres @> '["reggae"]'::jsonb OR genres @> '["soundtrack"]'::jsonb OR artist ILIKE '%BTS%' OR artist ILIKE '%BLACKPINK%' LIMIT 8)
  `;

  const { rows: tracks } = await pool.query(query);
  console.log(`Loaded ${tracks.length} tracks. Classifying with LLM...`);

  const results = [];
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    process.stdout.write(`Progress: ${i + 1}/${tracks.length}...\r`);
    
    try {
      const start = Date.now();
      const res = await classifyTrack(track);
      const latency = ((Date.now() - start) / 1000).toFixed(1);

      results.push({
        category: track.category,
        artist: track.artist,
        title: track.name,
        originalGenres: track.genres || [],
        predRegion: res.tags[0],
        predGenre: res.genres[0],
        latency: `${latency}s`
      });
    } catch (err) {
      results.push({
        category: track.category,
        artist: track.artist,
        title: track.name,
        originalGenres: track.genres || [],
        predRegion: 'ERROR',
        predGenre: err.message,
        latency: 'N/A'
      });
    }
  }

  console.log('\n\n### EVALUATION RESULTS ###\n');
  
  // Print Markdown Table
  console.log('| Category | Artist | Title | Original Genres | Predicted Region | Predicted Genre | Latency |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const orig = r.originalGenres.join(', ');
    console.log(`| ${r.category} | ${r.artist} | ${r.title} | [${orig}] | **${r.predRegion}** | **${r.predGenre}** | ${r.latency} |`);
  }

  await pool.end();
}

main();
