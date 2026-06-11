const API_BASE = 'https://api.deezer.com';

const GENRE_ID_MAP = {
  pop: 132,
  electronic: 106,
  jazz: 129,
  classical: 98,
  metal: 464,
  soul: 169,
  blues: 153,
  reggae: 144,
  dance: 113,
  folk: 466,
  african: 2,
  arabic: 12,
  asian: 16,
  indian: 81,
  soundtrack: 173,
  children: 95,
  'r-n-b': 165,
  'chanson-francaise': 52,
  'country-americana': 84,
  'hip-hop-rap': 116,
  'rock-indie': 152,
};

const CUSTOM_GENRE_PLAYLISTS = {
  // Portuguese
  fado: [2734677584, 10613220962, 4782723304, 14974361323],
  tradicional_folklore_pimba: [
    1478605935, 6163368884, 14302375881, 15135817403, 4782723304,
    13980025901, 3835511186, 13493798923
  ],
  pop_tuga: [3562194622, 5898788844],
  pop_rock_tuga: [3562194622, 5898788844, 10642447282],
  hip_hop_tuga: [3481848302, 15066013003, 8211186722],
  classica_tuga: [8048810122, 12356713983, 14476568723, 15102890763],
  kizomba_palop: [4427293502, 1205831211, 3311387182, 1839099582],
  pop_urbano_nova_pop: [14341944421, 11555475044, 15060016783],
  // Brazilian
  samba_pagode: [5449764382, 5709940122, 12968855623, 3396745906],
  bossa_nova: [556502217, 12607436323, 11566444484, 15172273023],
  funk_brasileiro: [15204407463, 15355968343, 15126778163, 9743264302],
  // US
  pop_us: [1282483245],
  hip_hop_trap_us: [12547421383],
  country_americana_us: [11336583364, 14013464681, 9195238842, 7688601282],
  rock_alternative_us: [1318451857, 8074584322, 8716319082, 8929584182, 1402845615],
  // UK
  pop_uk: [14645078321, 15199165723, 8603778582, 7386651364],
  uk_drill_grime: [10361171462, 8322893622, 11336030544, 8672240222, 14701050621],
  britpop_rock_uk: [8715045762, 9066452562, 855150871],
  uk_garage_dnb: [14596222441, 14268860961, 13809941261, 11374785584, 3274357942],
  // French
  chanson_francaise: [700895155, 1884320402, 957995855, 1420459465],
  pop_francaise: [1235433511, 1021647001, 1067140111, 1280262301],
  french_touch_electro: [962293895, 13065304003, 7281037904, 9197791042, 6300460544, 7342240164],
  rap_francais: [6568026624, 8619246462, 15155137203, 1836636662],
  // Spanish
  flamenco: [777756285, 3582568026, 13941285401, 15148096583, 6177686164],
  reggaeton_urbano: [178699142, 3803398766, 1273315391, 11120289724, 925131455],
  musica_regional_latina: [9003957462, 10629918582, 10630090322, 10630096622, 10630104822],
  // Global
  kpop: [4096400722, 12244134951, 7482846624],
  reggae: [2448918882, 1295485847, 1503415633, 2042023484],
};

const SEARCH_QUERY_MAP = {
  fado: 'Fado',
  tradicional_folklore_pimba: 'Pimba Folclore Portugal',
  pop_tuga: 'Pop Português',
  pop_rock_tuga: 'Pop Rock Português',
  hip_hop_tuga: 'Hip Hop Tuga',
  classica_tuga: 'Música Clássica Portuguesa',
  kizomba_palop: 'Kizomba Kuduro',
  pop_urbano_nova_pop: 'Nova Pop Portuguesa Bárbara Bandeira Ivandro',
  samba_pagode: 'Samba Pagode',
  bossa_nova: 'Bossa Nova MPB',
  funk_brasileiro: 'Funk Brasileiro',
  pop_us: 'Pop US',
  hip_hop_trap_us: 'Hip Hop US Trap',
  country_americana_us: 'Country Americana',
  rock_alternative_us: 'Rock Alternative US',
  pop_uk: 'Pop UK Dua Lipa',
  uk_drill_grime: 'UK Drill Grime',
  britpop_rock_uk: 'Britpop UK Rock',
  uk_garage_dnb: 'UK Garage Drum and Bass',
  pop_francaise: 'Pop Française Louane Gims',
  french_touch_electro: 'French Touch Electro',
  rap_francais: 'Rap Français',
  flamenco: 'Flamenco',
  reggaeton_urbano: 'Reggaeton Urbano',
  musica_regional_latina: 'Música Regional Latina',
  reggae: 'Reggae',
  kpop: 'K-Pop',
  other: 'Pop',
};

const ALBUM_GENRE_ALIASES = {
  'chanson-française': 'chanson-francaise',
  'variété-française': 'chanson-francaise',
  'nouvelle-scène': 'chanson-francaise',
  'chanson-francaise': 'chanson-francaise',
  'variete-francaise': 'chanson-francaise',
  'nouvelle-scene': 'chanson-francaise',
  'musique-africaine': 'african',
  'musique-arabe': 'arabic',
  'musique-asiatique': 'asian',
  'musique-brésilienne': 'bossa-nova',
  'musique-bresilienne': 'bossa-nova',
  'musique-indienne': 'indian',
  latino: 'reggaeton-urbano',
  electro: 'french-touch-electro',
  classique: 'classical',
  'rap/hip-hop': 'hip-hop-rap',
  'soul-funk': 'soul',
  'films/jeux-vidéo': 'soundtrack',
  'films/jeux-video': 'soundtrack',
  'musiques-de-films': 'soundtrack',
  rnb: 'r-n-b',
  'r-b': 'r-n-b',
  'rap-français': 'rap-francais',
  'rap-francaise': 'rap-francais',
  'rap-francais': 'rap-francais',
  jeunesse: 'children',
};

const REGIONAL_GENRES = ['chanson-francaise', 'rap-francais', 'african', 'arabic', 'asian', 'indian'];

const CHART_SOURCES = {
  0: 'top-100',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let lastDeezerCall = 0;
const DEEZER_MIN_INTERVAL = 100; // ms between calls

async function deezerFetch(endpoint, retries = 2) {
  const url = `${API_BASE}${endpoint}`;
  
  // Throttle: ensure minimum interval between calls
  const now = Date.now();
  const wait = DEEZER_MIN_INTERVAL - (now - lastDeezerCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastDeezerCall = Date.now();
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      
      // Rate limited — wait and retry
      if (res.status === 429 || (res.status >= 400 && res.status < 500 && attempt < retries)) {
        const backoff = (attempt + 1) * 1000;
        console.warn(`[Deezer] Rate limited (${res.status}), retrying in ${backoff}ms... (${endpoint})`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) {
        const backoff = (attempt + 1) * 500;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return null;
    }
  }
  return null;
}

const albumGenreCache = new Map();

async function fetchAlbumGenres(albumId) {
  if (!albumId) return [];
  if (albumGenreCache.has(albumId)) return albumGenreCache.get(albumId);

  const data = await deezerFetch(`/album/${albumId}`);
  let genres = [];
  if (data?.genres?.data) {
    genres = data.genres.data.map(g => {
      const name = g.name.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
      return GENRE_ID_MAP[name] ? name : (ALBUM_GENRE_ALIASES[name] || name);
    });
  }
  albumGenreCache.set(albumId, genres);
  return genres;
}

function mapTrack(t, chartSource) {
  return {
    id: `deezer:${t.id}`,
    name: t.title,
    artist: t.artist?.name || 'Unknown',
    albumImage: t.album?.cover_big || null,
    albumId: t.album?.id || null,
    previewUrl: t.preview,
    durationMs: (parseInt(t.duration, 10) || 30) * 1000,
    rank: t.rank || 0,
    genres: [],
    chartSource: chartSource || null,
  };
}

async function searchDeezerTracks(queryStr, genre, count) {
  const data = await deezerFetch(`/search?q=${encodeURIComponent(queryStr)}&limit=${count * 2}`);
  if (!data?.data) return [];
  const tracks = [];
  const seen = new Set();
  for (const t of data.data) {
    if (!t.preview || seen.has(t.id)) continue;
    seen.add(t.id);
    tracks.push(mapTrack(t, genre));
  }
  return tracks;
}

async function smartCustomSearch(genre, count) {
  const searchQuery = SEARCH_QUERY_MAP[genre] || genre;
  console.log(`[Deezer] Smart search for "${genre}" using query "${searchQuery}"`);
  const tracks = [];
  const seen = new Set();

  const addTrack = (t) => {
    if (!t.preview || seen.has(t.id)) return;
    seen.add(t.id);
    tracks.push(t);
  };

  // Strategy 1: Playlist search — highest quality, curated content
  const playlistData = await deezerFetch(`/search/playlist?q=${encodeURIComponent(searchQuery)}&limit=3`);
  if (playlistData?.data) {
    for (const pl of playlistData.data) {
      if (tracks.length >= count) break;
      const plTracks = await deezerFetch(`/playlist/${pl.id}/tracks?limit=20`);
      if (!plTracks?.data) continue;
      for (const t of plTracks.data) addTrack(mapTrack(t, genre));
    }
  }

  // Strategy 2: Text search — broad coverage
  if (tracks.length < count) {
    const textTracks = await searchDeezerTracks(searchQuery, genre, count * 2);
    for (const t of textTracks) addTrack(t);
  }

  // Strategy 3: Artist top tracks — good for region/style names
  if (tracks.length < count) {
    const artistData = await deezerFetch(`/search/artist?q=${encodeURIComponent(searchQuery)}&limit=5`);
    if (artistData?.data) {
      for (const artist of artistData.data) {
        if (tracks.length >= count) break;
        const top = await deezerFetch(`/artist/${artist.id}/top?limit=10`);
        if (!top?.data) continue;
        for (const t of top.data) addTrack(mapTrack(t, genre));
      }
    }
  }

  return tracks.slice(0, count);
}

async function getCustomGenreTracks(genre, count) {
  const playlistIds = CUSTOM_GENRE_PLAYLISTS[genre];
  let tracks = [];
  const seen = new Set();

  if (playlistIds?.length) {
    for (const playlistId of playlistIds) {
      if (tracks.length >= count) break;
      const data = await deezerFetch(`/playlist/${playlistId}/tracks?limit=${count * 2}`);
      if (!data?.data) continue;
      let added = 0;
      for (const t of data.data) {
        if (!t.preview || seen.has(t.id)) continue;
        seen.add(t.id);
        tracks.push(mapTrack(t, genre));
        added++;
      }
      if (added > 0) console.log(`[Deezer] Playlist ${playlistId} +${added} tracks for "${genre}"`);
    }
  } else {
    tracks = await smartCustomSearch(genre, count);
  }

  const batchSize = 5;
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    await Promise.all(batch.map(async (track) => {
      if (track.albumId) {
        try {
          track.genres = await fetchAlbumGenres(track.albumId);
        } catch {
          track.genres = [genre];
        }
      } else {
        track.genres = [genre];
      }
    }));
  }

  console.log(`[Deezer] Total ${tracks.length} tracks for "${genre}" (${tracks.filter(t => t.previewUrl).length} with preview)`);
  tracks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  return tracks.slice(0, count);
}

async function getTracksByGenre(genre, count = 10) {
  // 1. Try curated songs first — verified, genre-tagged, played-count tracked
  try {
    const { getCuratedSongsByGenre, addCuratedSong } = await import('./db.js');
    const curated = await getCuratedSongsByGenre(genre, count * 2);

    if (curated && curated.length > 0) {
      console.log(`[Curated] Found ${curated.length} curated tracks for "${genre}", refreshing previews`);

      // Batch-refresh preview URLs (Deezer previews expire ~30min)
      const valid = [];
      const BATCH = 10;
      for (let i = 0; i < curated.length; i += BATCH) {
        const batch = curated.slice(i, i + BATCH);
        await Promise.all(batch.map(async (track) => {
          try {
            const data = await deezerFetch(`/track/${track.rawId}`);
            if (data?.preview) {
              track.previewUrl = data.preview;
              valid.push(track);
            }
          } catch { /* skip */ }
        }));
        if (valid.length >= count) break;
      }

      if (valid.length >= Math.min(count, 5)) {
        console.log(`[Curated] ${valid.length} curated tracks with fresh previews for "${genre}"`);
        valid.sort((a, b) => (a.playedCount || 0) - (b.playedCount || 0));
        return valid.slice(0, count);
      }
      console.log(`[Curated] Only ${valid.length} with fresh previews, need more`);
    }
  } catch (err) {
    console.error('[Curated] Failed to query curated songs:', err.message);
  }

  // 2. Not enough curated — fetch from playlists/charts and add to curated
  console.log(`[Deezer] Fetching fresh tracks for "${genre}"`);
  const tracks = await getCustomGenreTracks(genre, count);

  // Add fetched tracks to curated table for future use
  try {
    const { addCuratedSong } = await import('./db.js');
    for (const t of tracks) {
      await addCuratedSong({
        id: t.id,
        name: t.name,
        artist: t.artist,
        albumImage: t.albumImage,
        previewUrl: t.previewUrl,
        durationMs: t.durationMs,
        genre,
        albumGenres: t.genres || [],
        chartSource: t.chartSource || genre,
        verified: false,
      });
    }
  } catch (err) {
    console.error('[Curated] Failed to cache fetched tracks:', err.message);
  }

  return tracks;
}

import { GENRES, GENRE_GROUPS } from './genres-config.js';

function getGenreLabel(genre) {
  const labels = {
    // Portuguese
    fado: 'Fado',
    tradicional_folklore_pimba: 'Popular & Pimba / Folclore',
    pop_tuga: 'Pop Português',
    pop_rock_tuga: 'Pop-Rock Português',
    hip_hop_tuga: 'Hip Hop Tuga',
    classica_tuga: 'Clássica Portuguesa',
    kizomba_palop: 'Kizomba & PALOP',
    pop_urbano_nova_pop: 'Nova Pop / Pop Urbano',
    // US
    pop_us: 'Pop US',
    hip_hop_trap_us: 'Hip Hop & Trap US',
    country_americana_us: 'Country & Americana',
    rock_alternative_us: 'Rock & Alternative US',
    // UK
    pop_uk: 'Pop UK',
    uk_drill_grime: 'UK Drill & Grime',
    britpop_rock_uk: 'Britpop & Rock UK',
    uk_garage_dnb: 'UK Garage & DnB',
    // French
    chanson_francaise: 'Chanson Française',
    pop_francaise: 'Pop Française',
    rap_francais: 'Rap Français',
    french_touch_electro: 'French Touch & Electro',
    // Spanish
    flamenco: 'Flamenco',
    reggaeton_urbano: 'Reggaeton & Urbano',
    musica_regional_latina: 'Música Regional Latina',
    // Brazilian
    samba_pagode: 'Samba & Pagode',
    bossa_nova: 'Bossa Nova / MPB',
    funk_brasileiro: 'Funk Brasileiro',
    reggae: 'Reggae',
    kpop: 'K-Pop',
    // Fallback
    other: 'Outros',
  };
  return labels[genre] || genre.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export { getTracksByGenre, GENRES, getGenreLabel, GENRE_GROUPS };
