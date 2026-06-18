import pg from 'pg';

const pool = new pg.Pool({
  host: '192.168.1.49',
  port: 5432,
  user: 'jalfaiat',
  password: 'Eelflpbqjv2003!',
  database: 'blindtest',
});

try {
  // ---- 1. List all tables (orientation) ----
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('=== TABLES ===');
  tables.forEach(r => console.log(`  ${r.table_name}`));
  console.log();

  // ---- 2. Curated songs count with genre PT_kizomba_palop ----
  // Check both old and new schemas
  console.log('=== 1. COUNT of curated songs with genre PT_kizomba_palop ===');

  // Try curation table first (new schema)
  let result;
  try {
    result = await pool.query(`SELECT COUNT(*)::int AS cnt FROM curation WHERE genre_id = 'PT_kizomba_palop'`);
    console.log(`   curation table: ${result.rows[0].cnt} songs`);
  } catch { }

  try {
    result = await pool.query(`SELECT COUNT(*)::int AS cnt FROM curated_songs WHERE genre = 'PT_kizomba_palop'`);
    console.log(`   curated_songs table: ${result.rows[0].cnt} songs`);
  } catch { }

  // Also check via curated_track_details view
  try {
    result = await pool.query(`SELECT COUNT(*)::int AS cnt FROM curated_track_details WHERE genre = 'PT_kizomba_palop'`);
    console.log(`   curated_track_details view: ${result.rows[0].cnt} songs`);
  } catch { }

  console.log();

  // ---- 3. List all curated songs with genre PT_kizomba_palop ----
  console.log('=== 2. LIST of curated songs with genre PT_kizomba_palop ===');

  try {
    const { rows: songs } = await pool.query(`
      SELECT id, name, artist, verified, played_count
      FROM curated_track_details
      WHERE genre = 'PT_kizomba_palop'
      ORDER BY name
    `);
    console.log(`   Found ${songs.length} songs via curated_track_details:\n`);
    console.log(`   ${'NAME'.padEnd(40)} ${'ARTIST'.padEnd(25)} VERIFIED PLAYED`);
    console.log(`   ${''.padEnd(40, '-')} ${''.padEnd(25, '-')} -------- -----`);
    songs.forEach(s => {
      console.log(`   ${s.name.padEnd(40)} ${s.artist.padEnd(25)} ${String(s.verified).padEnd(8)} ${s.played_count}`);
    });
  } catch (e) {
    console.log(`   curated_track_details view not available: ${e.message}`);
    // Fallback to curated_songs
    try {
      const { rows: songs } = await pool.query(`
        SELECT id, name, artist, verified, played_count
        FROM curated_songs
        WHERE genre = 'PT_kizomba_palop'
        ORDER BY name
      `);
      console.log(`   Found ${songs.length} songs via curated_songs:\n`);
      songs.forEach(s => {
        console.log(`   ${s.name} | ${s.artist} | verified=${s.verified} | played=${s.played_count}`);
      });
    } catch { }
  }

  console.log();

  // ---- 4. Songs in tracks with deezer_genres containing kizomba-related tags ----
  console.log('=== 3. COUNT of tracks with deezer_genres containing kizomba-related tags ===');

  try {
    result = await pool.query(`
      SELECT COUNT(*)::int AS cnt FROM tracks
      WHERE deezer_genres::text ILIKE '%kizomba%'
         OR deezer_genres::text ILIKE '%kuduro%'
         OR deezer_genres::text ILIKE '%semba%'
    `);
    console.log(`   tracks with kizomba/kuduro/semba in deezer_genres: ${result.rows[0].cnt}`);

    // Show sample
    const { rows: samples } = await pool.query(`
      SELECT id, name, artist_name, deezer_genres
      FROM tracks
      WHERE deezer_genres::text ILIKE '%kizomba%'
         OR deezer_genres::text ILIKE '%kuduro%'
         OR deezer_genres::text ILIKE '%semba%'
      ORDER BY name
      LIMIT 15
    `);
    console.log(`\n   Sample tracks with kizomba deezer_genres:\n`);
    samples.forEach(s => {
      const genres = JSON.stringify(s.deezer_genres).slice(0, 80);
      console.log(`   ${s.name.padEnd(35)} ${s.artist_name.padEnd(25)} genres: ${genres}`);
    });
  } catch (e) {
    console.log(`   tracks table not available: ${e.message}`);
    try {
      result = await pool.query(`
        SELECT COUNT(*)::int AS cnt FROM songs_cache
        WHERE genres::text ILIKE '%kizomba%'
      `);
      console.log(`   songs_cache with kizomba in genres: ${result.rows[0].cnt}`);
    } catch { }
  }

  console.log();

  // ---- 5. Deezer playlist IDs for kizomba ----
  console.log('=== 4. DEEZER PLAYLIST IDs for kizomba from deezer.js ===');
  console.log(`
   From backend/src/deezer.js (line 38):
     PT_kizomba_palop playlist IDs: [4427293502, 1205831211, 3311387182, 1839099582]

   From backend/src/deezer.js (line 86):
     Search query: 'Kizomba Kuduro'

   From backend/src/deezer.js (line 474):
     Display name: 'Kizomba & PALOP'
  `);

  await pool.end();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
