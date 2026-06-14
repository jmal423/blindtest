/**
 * migrate-genre-prefixes.js
 *
 * One-shot migration: normalise all curated_songs genres to the AI taxonomy
 * (PT_*, US_*, UK_*, BR_*, FR_*, ES_*, GL_*).
 *
 * Songs whose genre cannot be mapped deterministically are marked unverified
 * and their genre is set to GL_other so they surface in the Verify tab.
 *
 * Usage:
 *   node ai-worker/scripts/migrate-genre-prefixes.js [--dry-run]
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const DB_URL = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const pool = new pg.Pool({ connectionString: DB_URL });

// Mapping: old genre string -> canonical AI taxonomy genre
const MIGRATION_MAP = {
  // Old unprefixed -> canonical
  fado:                       'PT_fado',
  tradicional_folklore_pimba: 'PT_tradicional_folklore_pimba',
  pop_tuga:                   'PT_pop_tuga',
  pop_rock_tuga:              'PT_pop_rock_tuga',
  hip_hop_tuga:               'PT_hip_hop_tuga',
  classica_tuga:              'PT_classica_tuga',
  kizomba_palop:              'PT_kizomba_palop',
  pop_urbano_nova_pop:        'PT_pop_urbano_nova_pop',

  samba_pagode:               'BR_samba_pagode',
  bossa_nova:                 'BR_bossa_nova',
  funk_brasileiro:            'BR_funk_brasileiro',
  pop_rock_brasileiro:        'BR_pop_rock_brasileiro',

  pop_us:                     'US_pop_us',
  hip_hop_trap_us:            'US_hip_hop_trap_us',
  country_americana_us:       'US_country_americana_us',
  rock_alternative_us:        'US_rock_alternative_us',

  pop_uk:                     'UK_pop_uk',
  uk_drill_grime:             'UK_uk_drill_grime',
  britpop_rock_uk:            'UK_britpop_rock_uk',
  uk_garage_dnb:              'UK_uk_garage_dnb',

  chanson_francaise:          'FR_chanson_francaise',
  pop_francaise:              'FR_pop_francaise',
  rap_francais:               'FR_rap_francais',
  french_touch_electro:       'FR_french_touch_electro',

  flamenco:                   'ES_flamenco',
  reggaeton_urbano:           'ES_reggaeton_urbano',
  musica_regional_latina:     'ES_musica_regional_latina',

  reggae:                     'GL_reggae',
  kpop:                       'GL_kpop',
  edm_dance:                  'GL_edm_dance',
  afrobeats_african:          'GL_afrobeats_african',
  metal:                      'GL_metal',
  soundtracks:                'GL_soundtracks',
  jazz_lounge:                'GL_jazz_lounge',
  other:                      'GL_other',
};

// Valid canonical genre set (AI taxonomy)
const VALID_GENRES = new Set([
  'PT_fado', 'PT_tradicional_folklore_pimba', 'PT_pop_tuga', 'PT_pop_rock_tuga',
  'PT_hip_hop_tuga', 'PT_classica_tuga', 'PT_kizomba_palop', 'PT_pop_urbano_nova_pop',
  'BR_samba_pagode', 'BR_bossa_nova', 'BR_funk_brasileiro', 'BR_pop_rock_brasileiro',
  'US_pop_us', 'US_hip_hop_trap_us', 'US_country_americana_us', 'US_rock_alternative_us',
  'UK_pop_uk', 'UK_uk_drill_grime', 'UK_britpop_rock_uk', 'UK_uk_garage_dnb',
  'FR_chanson_francaise', 'FR_pop_francaise', 'FR_rap_francais', 'FR_french_touch_electro',
  'ES_flamenco', 'ES_reggaeton_urbano', 'ES_musica_regional_latina',
  'GL_reggae', 'GL_kpop', 'GL_edm_dance', 'GL_afrobeats_african',
  'GL_metal', 'GL_soundtracks', 'GL_jazz_lounge', 'GL_other',
]);

async function run() {
  console.log(`\n🎵  Genre Migration Script${DRY_RUN ? ' (DRY RUN - no changes written)' : ''}`);
  console.log(`  DB: ${DB_URL}\n`);

  const { rows: all } = await pool.query(
    `SELECT id, genre FROM curated_songs ORDER BY genre`
  );

  console.log(`Found ${all.length} curated songs.\n`);

  const updates = [];
  const alreadyValid = [];
  const unknown = [];

  for (const song of all) {
    if (VALID_GENRES.has(song.genre)) {
      alreadyValid.push(song);
    } else if (MIGRATION_MAP[song.genre]) {
      updates.push({ id: song.id, old: song.genre, new: MIGRATION_MAP[song.genre] });
    } else {
      unknown.push(song);
    }
  }

  console.log(`  ✅ Already valid (no change needed): ${alreadyValid.length}`);
  console.log(`  🔄 Will be migrated:                 ${updates.length}`);
  console.log(`  ⚠️  Unknown / unmappable genres:      ${unknown.length}\n`);

  if (unknown.length > 0) {
    console.log('Unknown genres that will be set to GL_other + marked unverified:');
    const byGenre = {};
    for (const s of unknown) {
      byGenre[s.genre] = (byGenre[s.genre] || 0) + 1;
    }
    for (const [g, c] of Object.entries(byGenre)) {
      console.log(`  - "${g}": ${c} songs`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('DRY RUN: no changes committed. Re-run without --dry-run to apply.\n');
    await pool.end();
    return;
  }

  // Apply migrations in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let migrated = 0;
    // Process in batches
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      for (const u of batch) {
        await client.query(
          `UPDATE curated_songs SET genre = $1 WHERE id = $2`,
          [u.new, u.id]
        );
        migrated++;
      }
      process.stdout.write(`\r  Migrated ${migrated}/${updates.length}...`);
    }
    console.log(`\n  ✅ Migrated ${migrated} songs.`);

    // Mark unknown genre songs as unverified and set to GL_other
    if (unknown.length > 0) {
      const unknownIds = unknown.map(s => s.id);
      for (let i = 0; i < unknownIds.length; i += 100) {
        const batch = unknownIds.slice(i, i + 100);
        const placeholders = batch.map((_, j) => `$${j + 1}`).join(', ');
        await client.query(
          `UPDATE curated_songs SET genre = 'GL_other', verified = FALSE WHERE id IN (${placeholders})`,
          batch
        );
      }
      console.log(`  ⚠️  Marked ${unknown.length} songs as GL_other + unverified (awaiting manual review).`);
    }

    await client.query('COMMIT');
    console.log('\n✨ Migration complete!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration FAILED, rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
