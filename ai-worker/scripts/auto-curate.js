import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const REMOTE_URL = process.env.REMOTE_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';

// Command-line flag parsing
const args = process.argv.slice(2);
const useRemote = args.includes('--remote');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100000;

const DB_URL = useRemote ? REMOTE_URL : LOCAL_URL;
console.log(`==========================================`);
console.log(`      BlindTest AI Auto-Curation`);
console.log(`      Target Database: ${useRemote ? 'REMOTE (OptiPlex)' : 'LOCAL (PC)'}`);
console.log(`      Limit: ${limit} tracks`);
console.log(`==========================================`);

const pool = new pg.Pool({ connectionString: DB_URL, max: 2 });

async function autoCurate() {
  try {
    // 1. Fetch AI-processed candidates from songs_cache that do not exist in curated_songs
    const query = `
      SELECT sc.id, sc.name, sc.artist, sc.album_image, sc.preview_url, sc.duration_ms, 
             sc.genres, sc.chart_source, sc.ai_genres, sc.ai_confidence, sc.rank
      FROM songs_cache sc
      LEFT JOIN curated_songs cs ON cs.id = sc.id
      WHERE cs.id IS NULL
        AND sc.ai_processed_at IS NOT NULL
        AND sc.ai_version NOT LIKE 'error:%'
        AND sc.preview_url IS NOT NULL
        AND jsonb_array_length(sc.ai_genres) > 0
      ORDER BY sc.rank DESC, sc.fetched_at DESC
      LIMIT $1
    `;
    
    console.log(`[Auto-Curate] Finding candidate tracks in songs_cache...`);
    const { rows: candidates } = await pool.query(query, [limit]);
    
    if (candidates.length === 0) {
      console.log(`[Auto-Curate] No new candidate songs found to curate.`);
      return;
    }
    
    console.log(`[Auto-Curate] Found ${candidates.length} candidate songs. Starting import...`);
    
    let imported = 0;
    
    for (const s of candidates) {
      const aiGenres = s.ai_genres;
      const primaryGenre = Array.isArray(aiGenres) && aiGenres.length > 0 ? aiGenres[0] : 'other';

      // Read confidence from ai_confidence field
      let confidence = 0;
      if (s.ai_confidence && typeof s.ai_confidence === 'object') {
        const vals = Object.values(s.ai_confidence);
        confidence = vals.length > 0 ? Number(vals[0]) || 0 : 0;
      }

      // Threshold: >= 0.85 auto-verified, >= 0.5 unverified (admin review), < 0.5 skip
      const autoVerify = confidence >= 0.85;
      if (confidence < 0.5) {
        console.log(`  ~ Skipped: "${s.name}" by ${s.artist} [${primaryGenre}] (confidence ${(confidence * 100).toFixed(0)}%)`);
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO curated_songs (id, name, artist, album_image, preview_url, duration_ms, genre, album_genres, chart_source, verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.name,
            s.artist,
            s.album_image || null,
            s.preview_url,
            s.duration_ms || 0,
            primaryGenre,
            JSON.stringify(s.genres || []),
            s.chart_source || null,
            autoVerify // High confidence = verified, medium = needs review
          ]
        );
        
        const status = autoVerify ? '✅ auto-verified' : '⏳ needs review';
        console.log(`  ${status}: "${s.name}" by ${s.artist} [${primaryGenre}] (${(confidence * 100).toFixed(0)}%)`);
        imported++;
      } catch (err) {
        console.error(`  -> Failed to import "${s.name}" (${s.id}):`, err.message);
      }
    }
    
    console.log(`\n[Auto-Curate] Success! Imported ${imported} new songs to the curated playlist automatically verified.`);
  } catch (err) {
    console.error(`[Auto-Curate] Curation run failed:`, err.message);
  } finally {
    await pool.end();
  }
}

autoCurate();
