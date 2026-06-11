import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const LOCAL_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';
const REMOTE_URL = 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';

const VALID_GENRES = new Set([
  "fado", "tradicional_folklore_pimba", "pop_tuga", "pop_rock_tuga", "hip_hop_tuga",
  "classica_tuga", "kizomba_palop", "pop_urbano_nova_pop", "pop_us", "hip_hop_trap_us",
  "country_americana_us", "rock_alternative_us", "pop_uk", "uk_drill_grime", "britpop_rock_uk",
  "uk_garage_dnb", "chanson_francaise", "pop_francaise", "rap_francais", "french_touch_electro",
  "flamenco", "reggaeton_urbano", "musica_regional_latina", "samba_pagode", "bossa_nova",
  "funk_brasileiro", "reggae", "kpop", "pop_rock_brasileiro", "edm_dance", "afrobeats_african",
  "metal", "soundtracks", "jazz_lounge", "other"
]);

const VALID_REGIONS = new Set([
  "portuguese", "brazilian", "united_states", "united_kingdom", "french", "spanish", "global_other"
]);

async function cleanDb(url, name) {
  console.log(`\n--- Cleaning DB: ${name} (${url.replace(/\/\/.*@/, '//***@')}) ---`);
  const pool = new pg.Pool({ connectionString: url });
  
  try {
    const { rows } = await pool.query(`
      SELECT id, artist, name, ai_genres, ai_tags, ai_confidence
      FROM songs_cache
      WHERE ai_processed_at IS NOT NULL
    `);

    console.log(`Found ${rows.length} processed tracks. Checking validity...`);
    let updatedCount = 0;

    for (const row of rows) {
      let changed = false;
      
      // Parse genres
      let genres = Array.isArray(row.ai_genres) ? row.ai_genres : [];
      const cleanedGenres = genres.map(g => {
        const val = (g || '').toLowerCase().trim();
        if (!VALID_GENRES.has(val)) {
          console.log(`Track "${row.artist} - ${row.name}" has invalid genre "${val}". Coercing to "other".`);
          changed = true;
          return 'other';
        }
        return val;
      });

      // Parse tags
      let tags = Array.isArray(row.ai_tags) ? row.ai_tags : [];
      const cleanedTags = tags.map(t => {
        const val = (t || '').toLowerCase().trim();
        if (!VALID_REGIONS.has(val)) {
          console.log(`Track "${row.artist} - ${row.name}" has invalid region tag "${val}". Coercing to "global_other".`);
          changed = true;
          return 'global_other';
        }
        return val;
      });

      if (changed) {
        // Adjust confidence dictionary keys if they contain invalid genres
        let confidence = row.ai_confidence || {};
        const cleanedConfidence = {};
        for (const [k, v] of Object.entries(confidence)) {
          const key = k.toLowerCase().trim();
          if (!VALID_GENRES.has(key)) {
            cleanedConfidence['other'] = (cleanedConfidence['other'] || 0) + v;
          } else {
            cleanedConfidence[key] = v;
          }
        }

        await pool.query(`
          UPDATE songs_cache
          SET ai_genres = $1::jsonb,
              ai_tags = $2::jsonb,
              ai_confidence = $3::jsonb
          WHERE id = $4
        `, [
          JSON.stringify(cleanedGenres),
          JSON.stringify(cleanedTags),
          JSON.stringify(cleanedConfidence),
          row.id
        ]);
        updatedCount++;
      }
    }

    console.log(`Completed cleaning of ${name}. Updated ${updatedCount} tracks.`);
  } catch (err) {
    console.error(`Error cleaning DB ${name}:`, err.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await cleanDb(LOCAL_URL, 'Local DB');
  
  // Try remote DB if tunnel is active
  try {
    await cleanDb(REMOTE_URL, 'Remote DB');
  } catch (e) {
    console.log('Skipping remote DB or got error: ', e.message);
  }
}

main();
