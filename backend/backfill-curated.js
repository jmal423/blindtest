import pg from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest' });

const API_BASE = 'https://api.deezer.com';

const CUSTOM_GENRE_PLAYLISTS = {
  fado: [2734677584, 10613220962, 4782723304, 14974361323],
  'pop-rock-portugues': [3443535566, 3562194622, 5898788844, 10642447282],
  'hip-hop-tuga': [3481848302, 15066013003, 8211186722],
  'classica-portuguesa': [8048810122, 12356713983, 14476568723, 15102890763],
  'french-touch-electro': [962293895, 13065304003, 7281037904, 9197791042, 6300460544, 7342240164],
  'rap-francais': [6568026624, 8619246462, 15155137203, 1836636662],
  flamenco: [777756285, 3582568026, 13941285401, 15148096583, 6177686164],
  'reggaeton-urbano': [178699142, 3803398766, 1273315391, 11120289724, 925131455],
  'musica-regional-latina': [9003957462, 10629918582, 10630090322, 10630096622, 10630104822],
  'samba-pagode': [5449764382, 5709940122, 12968855623, 3396745906],
  'bossa-nova': [556502217, 12607436323, 11566444484, 15172273023],
  'funk-brasileiro': [15204407463, 15355968343, 15126778163, 9743264302],
  kizomba: [4427293502, 1205831211, 3311387182, 1839099582],
};

// Map old genre IDs to the new taxonomy genre IDs
const GENRE_MAP = {
  fado: 'fado',
  'popular-pimba': 'tradicional_folklore_pimba',
  'traditional-folclore': 'tradicional_folklore_pimba',
  'pop-rock-portugues': 'pop_rock_tuga',
  'hip-hop-tuga': 'hip_hop_tuga',
  'classica-portuguesa': 'classica_tuga',
  kizomba: 'kizomba_palop',
  'chanson-francaise': 'chanson_francaise',
  'french-touch-electro': 'french_touch_electro',
  'rap-francais': 'rap_francais',
  flamenco: 'flamenco',
  'reggaeton-urbano': 'reggaeton_urbano',
  'musica-regional-latina': 'musica_regional_latina',
  'samba-pagode': 'samba_pagode',
  'bossa-nova': 'bossa_nova',
  'funk-brasileiro': 'funk_brasileiro',
};

async function deezerFetch(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlaylistTracks(playlistId, genre) {
  const data = await deezerFetch(`/playlist/${playlistId}/tracks?limit=50`);
  if (!data?.data) return [];
  const tracks = [];
  for (const t of data.data) {
    if (!t.preview) continue;
    tracks.push({
      id: `deezer:${t.id}`,
      name: t.title,
      artist: t.artist?.name || 'Unknown',
      albumImage: t.album?.cover_big || null,
      previewUrl: t.preview,
      durationMs: (parseInt(t.duration, 10) || 30) * 1000,
      genre,
    });
  }
  return tracks;
}

async function main() {
  console.log('=== Backfill Curated Songs ===\n');

  // Phase 1: Fetch from curated playlists
  console.log('Phase 1: Fetching from curated playlists...');
  let totalFromPlaylists = 0;
  for (const [oldGenre, playlistIds] of Object.entries(CUSTOM_GENRE_PLAYLISTS)) {
    const newGenre = GENRE_MAP[oldGenre] || oldGenre;
    console.log(`  ${oldGenre} → ${newGenre} (${playlistIds.length} playlists)`);
    for (const plId of playlistIds) {
      const tracks = await fetchPlaylistTracks(plId, newGenre);
      for (const t of tracks) {
        await pool.query(
          `INSERT INTO curated_songs (id, name, artist, album_image, preview_url, duration_ms, genre, verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, t.name, t.artist, t.albumImage, t.previewUrl, t.durationMs, t.genre]
        );
        totalFromPlaylists++;
      }
      console.log(`    Playlist ${plId}: +${tracks.length} tracks (${totalFromPlaylists} total)`);
    }
  }
  console.log(`  Total from playlists: ${totalFromPlaylists}\n`);

  // Phase 2: Backfill from old songs_cache (discovery)
  console.log('Phase 2: Backfilling from songs_cache...');
  const { rows: cachedSongs } = await pool.query(`
    SELECT sc.id, sc.name, sc.artist, sc.preview_url, sc.duration_ms,
           sc.genre, sc.genres, sc.chart_source, sc.ai_genres
    FROM songs_cache sc
    LEFT JOIN curated_songs cs ON cs.id = sc.id
    WHERE cs.id IS NULL AND sc.preview_url IS NOT NULL
    ORDER BY sc.rank DESC
  `);
  console.log(`  ${cachedSongs.length} uncached songs found`);

  let backfilled = 0;
  for (const song of cachedSongs) {
    // Use AI genre if available, else fallback to first genre, else chart_source
    let genre = 'other';
    if (song.ai_genres && song.ai_genres.length > 0 && song.ai_genres[0] !== 'other') {
      genre = song.ai_genres[0];
    } else if (song.genres && song.genres.length > 0 && song.genres[0] !== 'other') {
      genre = GENRE_MAP[song.genres[0]] || song.genres[0];
    } else if (song.genre && song.genre !== 'other') {
      genre = GENRE_MAP[song.genre] || song.genre;
    } else if (song.chart_source) {
      genre = GENRE_MAP[song.chart_source] || song.chart_source;
    }

    // Map to taxonomy if possible
    genre = GENRE_MAP[genre] || genre;

    await pool.query(
      `INSERT INTO curated_songs (id, name, artist, album_image, preview_url, duration_ms, genre, chart_source, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
       ON CONFLICT (id) DO NOTHING`,
      [song.id, song.name, song.artist, null, song.preview_url, song.duration_ms, genre, song.chart_source]
    );
    backfilled++;
    if (backfilled % 100 === 0) console.log(`    ${backfilled}/${cachedSongs.length} backfilled`);
  }
  console.log(`  Backfilled: ${backfilled}\n`);

  // Summary
  const { rows: stats } = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
           COUNT(DISTINCT genre) AS genres,
           COALESCE(SUM(played_count), 0) AS total_plays
    FROM curated_songs
  `);
  console.log('=== Summary ===');
  console.log(`  Total curated songs: ${stats[0].total}`);
  console.log(`  Verified: ${stats[0].verified}`);
  console.log(`  Genres: ${stats[0].genres}`);
  console.log(`  Total plays: ${stats[0].total_plays}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
