import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';
const pool = new pg.Pool({ connectionString: DB_URL });

async function run() {
  try {
    const { rows } = await pool.query(`
      SELECT artist, name, genres, chart_source 
      FROM songs_cache 
      WHERE ai_genres @> '["GL_other"]'::jsonb
         OR ai_genres @> '["other"]'::jsonb
      ORDER BY artist ASC, name ASC
    `);

    if (rows.length === 0) {
      console.log('No tracks found in GL_other.');
      return;
    }

    console.log(`=== Found ${rows.length} tracks in GL_other ===\n`);
    for (const row of rows) {
      const rawGenres = Array.isArray(row.genres) ? row.genres.join(', ') : 'None';
      console.log(`Artist: ${row.artist}`);
      console.log(`Track:  ${row.name}`);
      console.log(`Raw:    [${rawGenres}]`);
      console.log(`Source: ${row.chart_source || 'Unknown'}`);
      console.log('--------------------------------------------------');
    }
  } catch (err) {
    console.error('Error fetching GL_other tracks:', err);
  } finally {
    await pool.end();
  }
}

run();
