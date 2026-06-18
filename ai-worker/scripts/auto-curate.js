import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL;
const CONFIDENCE_MIN = 0.5;
const CONFIDENCE_AUTO_VERIFY = 0.85;

console.log(`==========================================`);
console.log(`   BlindTest Auto-Curation (new schema)`);
console.log(`   Target: ${DB_URL.replace(/:[^:@]+@/, ':****@')}`);
console.log(`==========================================`);

const pool = new pg.Pool({ connectionString: DB_URL, max: 2 });

async function autoCurate() {
  const client = await pool.connect();
  try {
    const { rows: candidates } = await client.query(`
      SELECT DISTINCT ON (c.track_id)
        c.track_id,
        c.genre_id,
        c.confidence,
        c.source
      FROM classifications c
      WHERE c.source NOT LIKE 'error:%'
        AND c.confidence >= $1
        AND NOT EXISTS (SELECT 1 FROM curation cu WHERE cu.track_id = c.track_id)
      ORDER BY c.track_id, c.created_at DESC
    `, [CONFIDENCE_MIN]);

    console.log(`Found ${candidates.length} candidate tracks for curation`);

    let curated = 0;
    for (const c of candidates) {
      const autoVerify = c.confidence >= CONFIDENCE_AUTO_VERIFY;
      try {
        await client.query(
          `INSERT INTO curation (track_id, genre_id, verified, curated_by, curated_at)
           VALUES ($1, $2, $3, 'auto-ai', NOW())
           ON CONFLICT (track_id) DO NOTHING`,
          [c.track_id, c.genre_id, autoVerify]
        );
        const status = autoVerify ? '✅ auto-verified' : '⏳ needs review';
        console.log(`  ${status}: ${c.track_id} [${c.genre_id}] (${(c.confidence * 100).toFixed(0)}%)`);
        curated++;
      } catch (err) {
        console.error(`  Failed: ${c.track_id}: ${err.message}`);
      }
    }
    console.log(`\nDone: ${curated} songs curated`);
  } catch (err) {
    console.error(`Error:`, err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

autoCurate();
