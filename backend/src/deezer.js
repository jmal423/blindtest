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
  PT_fado: [2734677584, 10613220962, 4782723304, 14974361323],
  PT_tradicional_folklore_pimba: [
    1478605935, 6163368884, 14302375881, 15135817403, 4782723304,
    13980025901, 3835511186, 13493798923
  ],
  PT_pop_tuga: [3562194622, 5898788844],
  PT_pop_rock_tuga: [3562194622, 5898788844, 10642447282],
  PT_hip_hop_tuga: [3481848302, 15066013003, 8211186722],
  PT_classica_tuga: [8048810122, 12356713983, 14476568723, 15102890763],
  PT_kizomba_palop: [4427293502, 1205831211, 3311387182, 1839099582],
  PT_pop_urbano_nova_pop: [14341944421, 11555475044, 15060016783],
  // Brazilian
  BR_samba_pagode: [5449764382, 5709940122, 12968855623, 3396745906],
  BR_bossa_nova: [556502217, 12607436323, 11566444484, 15172273023],
  BR_funk_brasileiro: [15204407463, 15355968343, 15126778163, 9743264302],
  BR_pop: [3155776882, 11629851604, 12431698623],
  // US
  US_pop_us: [1282483245],
  US_hip_hop_trap_us: [12547421383],
  US_country_americana_us: [11336583364, 14013464681, 9195238842, 7688601282],
  US_rock_alternative_us: [1318451857, 8074584322, 8716319082, 8929584182, 1402845615],
  // UK
  UK_pop_uk: [14645078321, 15199165723, 8603778582, 7386651364],
  UK_uk_drill_grime: [10361171462, 8322893622, 11336030544, 8672240222, 14701050621],
  UK_britpop_rock_uk: [8715045762, 9066452562, 855150871],
  UK_uk_garage_dnb: [14596222441, 14268860961, 13809941261, 11374785584, 3274357942],
  // French
  FR_chanson_francaise: [700895155, 1884320402, 957995855, 1420459465],
  FR_pop_francaise: [1235433511, 1021647001, 1067140111, 1280262301],
  FR_french_touch_electro: [962293895, 13065304003, 7281037904, 9197791042, 6300460544, 7342240164],
  FR_rap_francais: [6568026624, 8619246462, 15155137203, 1836636662],
  // Spanish
  ES_flamenco: [777756285, 3582568026, 13941285401, 15148096583, 6177686164],
  ES_reggaeton_urbano: [178699142, 3803398766, 1273315391, 11120289724, 925131455],
  ES_musica_regional_latina: [9003957462, 10629918582, 10630090322, 10630096622, 10630104822],
  // Brazilian
  BR_pop_rock_brasileiro: [9268293682, 11532710604, 11271619264],
  // Global
  GL_kpop: [4096400722, 12244134951, 7482846624],
  GL_reggae: [2448918882, 1295485847, 1503415633, 2042023484],
  GL_edm_dance: [687945565, 12134756071, 1495242491],
  GL_afrobeats_african: [12673058961, 1257036831, 1440933255],
  GL_metal: [1050179021, 8322139862, 7752014202],
  GL_soundtracks: [12729422541, 613860315, 1501014451],
  GL_jazz_lounge: [1311336155, 4040233102, 5898527324],
  GL_classical: [1330286435, 1263898441, 9240620582, 15259069123],
  GL_kids_family: [985417985, 515009671, 15208117963, 12637666591],
  GL_indian: [1078410111, 14566124722, 9169400442, 12637675591],
};

const SEARCH_QUERY_MAP = {
  PT_fado: 'Fado',
  PT_tradicional_folklore_pimba: 'Pimba Folclore Portugal',
  PT_pop_tuga: 'Pop Português',
  PT_pop_rock_tuga: 'Pop Rock Português',
  PT_hip_hop_tuga: 'Hip Hop Tuga',
  PT_classica_tuga: 'Música Clássica Portuguesa',
  PT_kizomba_palop: 'Kizomba Kuduro',
  PT_pop_urbano_nova_pop: 'Nova Pop Portuguesa Bárbara Bandeira Ivandro',
  BR_samba_pagode: 'Samba Pagode',
  BR_bossa_nova: 'Bossa Nova MPB',
  BR_funk_brasileiro: 'Funk Brasileiro',
  BR_pop_rock_brasileiro: 'Rock Brasileiro',
  BR_pop: 'Pop Brasileiro Pop Nacional Luísa Sonza Jão',
  US_pop_us: 'Pop US',
  US_hip_hop_trap_us: 'Hip Hop US Trap',
  US_country_americana_us: 'Country Americana',
  US_rock_alternative_us: 'Rock Alternative US',
  UK_pop_uk: 'Pop UK Dua Lipa',
  UK_uk_drill_grime: 'UK Drill Grime',
  UK_britpop_rock_uk: 'Britpop UK Rock',
  UK_uk_garage_dnb: 'UK Garage Drum and Bass',
  FR_chanson_francaise: 'Chanson Française',
  FR_pop_francaise: 'Pop Française Louane Gims',
  FR_french_touch_electro: 'French Touch Electro',
  FR_rap_francais: 'Rap Français',
  ES_flamenco: 'Flamenco',
  ES_reggaeton_urbano: 'Reggaeton Urbano',
  ES_musica_regional_latina: 'Música Regional Latina',
  GL_reggae: 'Reggae',
  GL_kpop: 'K-Pop',
  GL_edm_dance: 'EDM Dance Hits',
  GL_afrobeats_african: 'Afrobeats',
  GL_metal: 'Metal Hard Rock',
  GL_soundtracks: 'Soundtrack Film Cinema Theme',
  GL_jazz_lounge: 'Jazz Lounge',
  GL_classical: 'Classical Orchestral',
  GL_kids_family: 'Kids Family Children',
  GL_indian: 'Indian Bollywood',
  GL_other: 'Pop',
};

const ALBUM_GENRE_ALIASES = {
  'chanson-française': 'FR_chanson_francaise',
  'variété-française': 'FR_chanson_francaise',
  'nouvelle-scène': 'FR_chanson_francaise',
  'chanson-francaise': 'FR_chanson_francaise',
  'variete-francaise': 'FR_chanson_francaise',
  'nouvelle-scene': 'FR_chanson_francaise',
  'musique-africaine': 'GL_afrobeats_african',
  'musique-arabe': 'GL_other',
  'musique-asiatique': 'GL_kpop',
  'musique-brésilienne': 'BR_bossa_nova',
  'musique-bresilienne': 'BR_bossa_nova',
  'musique-indienne': 'GL_indian',
  classique: 'GL_classical',
  jeunesse: 'GL_kids_family',
  enfants: 'GL_kids_family',
  latino: 'reggaeton-urbano',
  electro: 'french-touch-electro',

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

export async function getCustomGenreTracks(genre, count, difficulty = 5) {
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
  if (difficulty >= 7) {
    tracks.sort((a, b) => (a.rank || 0) - (b.rank || 0));
  } else {
    tracks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  }
  return tracks.slice(0, count);
}

async function getTracksByGenre(genre, count = 10, difficulty = 5) {
  // 1. Try curated songs first — verified, genre-tagged, played-count tracked
  try {
    const { getCuratedSongsByGenre, addCuratedSong } = await import('./db.js');
    const curated = await getCuratedSongsByGenre(genre, count * 3);

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
        if (valid.length >= count * 2) break;
      }

      if (valid.length >= Math.min(count, 5)) {
        console.log(`[Curated] ${valid.length} curated tracks with fresh previews for "${genre}"`);
        if (difficulty <= 3) {
          valid.sort((a, b) => (b.rank || 0) - (a.rank || 0));
        } else if (difficulty >= 7) {
          valid.sort((a, b) => (a.playedCount || 0) - (b.playedCount || 0));
        }
        return valid.slice(0, count);
      }
      console.log(`[Curated] Only ${valid.length} with fresh previews, need more`);
    }
  } catch (err) {
    console.error('[Curated] Failed to query curated songs:', err.message);
  }

  // 2. Not enough curated — fetch from playlists/charts and cache to songs_cache (not curated directly)
  console.log(`[Deezer] Fetching fresh tracks for "${genre}"`);
  const tracks = await getCustomGenreTracks(genre, count, difficulty);

  // Cache fetched tracks to songs_cache for future AI processing / curation
  // NOTE: We do NOT add to curated_songs here — that goes through the Curated tab's Discovery panel
  try {
    const { cacheSongs } = await import('./db.js');
    await cacheSongs(tracks).catch(err => console.error('[Cache] Failed to cache tracks:', err.message));
  } catch (err) {
    console.error('[Cache] Failed to cache fetched tracks:', err.message);
  }

  return tracks;
}

async function getTracksByArtist(artistName, count = 10, difficulty = 5) {
  console.log(`[Deezer] Fetching tracks for artist "${artistName}"`);
  const tracks = [];
  const seen = new Set();
  const lowerArtist = artistName.toLowerCase();

  const addTrack = (t, rawTrack) => {
    if (!t.previewUrl || seen.has(t.id)) return;
    // Only include tracks where the primary artist matches (skip features/collabs)
    if (!rawTrack?.artist?.name?.toLowerCase().includes(lowerArtist)) return;
    seen.add(t.id);
    tracks.push(t);
  };

  try {
    // 1. Search for the artist
    const artistData = await deezerFetch(`/search/artist?q=${encodeURIComponent(artistName)}&limit=1`);
    if (artistData?.data?.length > 0) {
      const artistId = artistData.data[0].id;
      // 2. Get top tracks (Deezer returns these sorted by popularity)
      const topTracks = await deezerFetch(`/artist/${artistId}/top?limit=${count * 3}`);
      if (topTracks?.data) {
        for (const t of topTracks.data) {
          if (tracks.length >= count) break;
          addTrack(mapTrack(t, 'artist'), t);
        }
      }
    }

    // 3. Fallback: Search tracks by artist name if not enough top tracks
    if (tracks.length < count) {
      const searchData = await deezerFetch(`/search/track?q=artist:"${encodeURIComponent(artistName)}"&limit=${count * 3}`);
      if (searchData?.data) {
        for (const t of searchData.data) {
          if (tracks.length >= count) break;
          if (t.artist?.name?.toLowerCase().includes(lowerArtist)) {
            addTrack(mapTrack(t, 'artist'), t);
          }
        }
      }
    }

    const batchSize = 5;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      await Promise.all(batch.map(async (track) => {
        if (track.albumId) {
          try {
            track.genres = await fetchAlbumGenres(track.albumId);
          } catch {
            track.genres = ['pop'];
          }
        } else {
          track.genres = ['pop'];
        }
      }));
    }

  } catch (err) {
    console.error(`[Deezer] Failed to fetch tracks for artist "${artistName}":`, err.message);
  }

  if (difficulty >= 7) {
    tracks.sort((a, b) => (a.rank || 0) - (b.rank || 0));
  } else {
    tracks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  }
  return tracks.slice(0, count);
}

import { GENRES, GENRE_GROUPS } from './genres-config.js';

function getGenreLabel(genre) {
  const labels = {
    // Portuguese
    PT_fado: 'Fado',
    PT_tradicional_folklore_pimba: 'Popular & Pimba / Folclore',
    PT_pop_tuga: 'Pop Português',
    PT_pop_rock_tuga: 'Pop-Rock Português',
    PT_hip_hop_tuga: 'Hip Hop Tuga',
    PT_classica_tuga: 'Clássica Portuguesa',
    PT_kizomba_palop: 'Kizomba & PALOP',
    PT_pop_urbano_nova_pop: 'Nova Pop / Pop Urbano',
    // US
    US_pop_us: 'Pop US',
    US_hip_hop_trap_us: 'Hip Hop & Trap US',
    US_country_americana_us: 'Country & Americana',
    US_rock_alternative_us: 'Rock & Alternative US',
    // UK
    UK_pop_uk: 'Pop UK',
    UK_uk_drill_grime: 'UK Drill & Grime',
    UK_britpop_rock_uk: 'Britpop & Rock UK',
    UK_uk_garage_dnb: 'UK Garage & DnB',
    // French
    FR_chanson_francaise: 'Chanson Française',
    FR_pop_francaise: 'Pop Française',
    FR_rap_francais: 'Rap Français',
    FR_french_touch_electro: 'French Touch & Electro',
    // Spanish
    ES_flamenco: 'Flamenco',
    ES_reggaeton_urbano: 'Reggaeton & Urbano',
    ES_musica_regional_latina: 'Música Regional Latina',
    // Brazilian
    BR_samba_pagode: 'Samba & Pagode',
    BR_bossa_nova: 'Bossa Nova / MPB',
    BR_funk_brasileiro: 'Funk Brasileiro',
    BR_pop_rock_brasileiro: 'Rock & Pop-Rock Brasileiro',
    BR_pop: 'Pop Brasileiro',
    // Global
    GL_reggae: 'Reggae',
    GL_kpop: 'K-Pop',
    GL_edm_dance: 'EDM & Dance',
    GL_afrobeats_african: 'Afrobeats & African',
    GL_metal: 'Metal & Hard Rock',
    GL_soundtracks: 'Soundtracks & Cinema',
    GL_jazz_lounge: 'Jazz & Lounge',
    GL_classical: 'Classical & Orchestra',
    GL_kids_family: 'Kids & Family',
    GL_indian: 'Indian / Bollywood',
    GL_other: 'Outros',
  };
  return labels[genre] || genre.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export { getTracksByGenre, getTracksByArtist, GENRES, getGenreLabel, GENRE_GROUPS };
