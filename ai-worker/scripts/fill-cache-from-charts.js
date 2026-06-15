import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.DATABASE_URL;
const API_BASE = 'https://api.deezer.com';

const pool = new pg.Pool({ connectionString: DB_URL, connectionTimeoutMillis: 10000 });

async function deezerFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  return res.json();
}

async function cacheTrack(t, source, genre) {
  if (!t.preview) return false;
  const id = `deezer:${t.id}`;
  const genres = JSON.stringify(genre ? [genre] : []);
  await pool.query(
    `INSERT INTO songs_cache (id, name, artist, album_image, preview_url, duration_ms, genre, genres, rank, source, chart_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       rank = EXCLUDED.rank,
       fetched_at = NOW()`,
    [id, t.title, t.artist?.name || 'Unknown', t.album?.cover_big || null,
     t.preview, (parseInt(t.duration, 10) || 30) * 1000,
     genre || null, genres, t.rank || 0, 'deezer', source]
  );
  return true;
}

// ── Deezer genre IDs for chart fetching ──
const CHART_GENRE_IDS = {
  PT_fado: 76,
  PT_tradicional_folklore_pimba: 76,
  PT_pop_tuga: 132,
  PT_pop_rock_tuga: 152,
  PT_hip_hop_tuga: 116,
  PT_classica_tuga: 98,
  PT_kizomba_palop: 168,
  PT_pop_urbano_nova_pop: 132,
  BR_samba_pagode: 76,
  BR_bossa_nova: 76,
  BR_funk_brasileiro: 76,
  BR_pop_rock_brasileiro: 152,
  BR_pop: 132,
  US_pop_us: 132,
  US_hip_hop_trap_us: 116,
  US_country_americana_us: 84,
  US_rock_alternative_us: 152,
  UK_pop_uk: 132,
  UK_uk_drill_grime: 116,
  UK_britpop_rock_uk: 152,
  UK_uk_garage_dnb: 113,
  FR_chanson_francaise: 52,
  FR_pop_francaise: 132,
  FR_rap_francais: 116,
  FR_french_touch_electro: 106,
  ES_flamenco: 76,
  ES_reggaeton_urbano: 116,
  ES_musica_regional_latina: 76,
  GL_reggae: 144,
  GL_kpop: 16,
  GL_edm_dance: 113,
  GL_afrobeats_african: 2,
  GL_metal: 464,
  GL_soundtracks: 173,
  GL_jazz_lounge: 129,
  GL_other: 132,
};

const CUSTOM_PLAYLISTS = {
  PT_classica_tuga: [8048810122, 12356713983, 14476568723, 15102890763],
  UK_uk_garage_dnb: [14596222441, 14268860961, 13809941261, 11374785584, 3274357942],
  BR_pop_rock_brasileiro: [9268293682, 11532710604, 11271619264],
  GL_metal: [1050179021, 8322139862, 7752014202],
  GL_soundtracks: [12729422541, 613860315, 1501014451],
  GL_jazz_lounge: [1311336155, 4040233102, 5898527324],
};

async function fetchGenreCharts() {
  console.log('\n=== Deezer Genre Charts ===');
  let total = 0;

  for (const [genre, deezerGenreId] of Object.entries(CHART_GENRE_IDS)) {
    try {
      const data = await deezerFetch(`/chart/${deezerGenreId}/tracks?limit=40`);
      if (!data?.data?.length) {
        console.log(`  ~ ${genre}: no tracks`);
        continue;
      }

      let added = 0;
      for (const t of data.data) {
        if (await cacheTrack(t, `chart_${genre}`, genre)) added++;
      }
      console.log(`  ✓ ${genre}: +${added} tracks (from Deezer chart ${deezerGenreId})`);
      total += added;
    } catch (err) {
      console.error(`  ✗ ${genre}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return total;
}

async function fetchCustomPlaylists() {
  console.log('\n=== Deezer Custom Playlists ===');
  let total = 0;

  for (const [genre, playlistIds] of Object.entries(CUSTOM_PLAYLISTS)) {
    for (const pid of playlistIds) {
      try {
        const data = await deezerFetch(`/playlist/${pid}/tracks?limit=50`);
        if (!data?.data?.length) continue;
        let added = 0;
        for (const t of data.data) {
          if (await cacheTrack(t, `playlist_${genre}`, genre)) added++;
        }
        console.log(`  ✓ ${genre} (playlist ${pid}): +${added} tracks`);
        total += added;
      } catch {
        console.log(`  ~ ${genre} (playlist ${pid}): skipped`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return total;
}

async function fetchGlobalChart() {
  console.log('\n=== Deezer Global Top 100 ===');
  let total = 0;
  try {
    const data = await deezerFetch('/chart/0/tracks?limit=100');
    if (data?.data) {
      for (const t of data.data) {
        if (await cacheTrack(t, 'global_top', null)) total++;
      }
    }
    console.log(`  ✓ Global Top 100: +${total} tracks`);
  } catch (err) {
    console.error(`  ✗ Global chart: ${err.message}`);
  }
  return total;
}

async function main() {
  const start = Date.now();
  console.log('╔══════════════════════════════════╗');
  console.log('║   Deezer Chart Cache Filler      ║');
  console.log('╚══════════════════════════════════╝');

  try {
    await pool.query('SELECT 1');
    console.log('[DB] Connected');
  } catch (err) {
    console.error(`[DB] ${err.message}`);
    process.exit(1);
  }

  const chartTotal = await fetchGenreCharts();
  const playlistTotal = await fetchCustomPlaylists();
  const globalTotal = await fetchGlobalChart();
  const combined = chartTotal + playlistTotal + globalTotal;

  const { rows: stats } = await pool.query('SELECT COUNT(*) as c FROM songs_cache');
  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(0)}s`);
  console.log(`Added: ${combined} tracks`);
  console.log(`Total songs_cache: ${stats[0].c}`);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
