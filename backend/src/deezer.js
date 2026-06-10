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
  fado: [2734677584, 10613220962, 4782723304, 14974361323],
  'popular-pimba': [1478605935, 6163368884, 14302375881, 15135817403, 4782723304],
  'traditional-folclore': [13980025901, 3835511186, 13493798923],
  'pop-rock-portugues': [3443535566, 3562194622, 5898788844, 10642447282],
  'hip-hop-tuga': [3481848302, 15066013003, 8211186722],
  'classica-portuguesa': [8048810122, 12356713983, 14476568723, 15102890763],
  'french-touch-electro': [962293895, 13065304003, 7281037904, 9197791042, 6300460544, 7342240164],
  'rap-francais': [6568026624, 8619246462, 15155137203, 1836636662],
  flamenco: [777756285, 3582568026, 13941285401, 15148096583, 6177686164],
  'reggaeton-urbano': [178699142, 3803398766, 1273315391, 11120289724, 925131455],
  'musica-regional-latina': [9003957462, 10629918582, 10630090322, 10630096622, 10630104822],
  'k-pop': [4096400722, 12244134951, 7482846624],
  'samba-pagode': [5449764382, 5709940122, 12968855623, 3396745906],
  'bossa-nova': [556502217, 12607436323, 11566444484, 15172273023],
  'funk-brasileiro': [15204407463, 15355968343, 15126778163, 9743264302],
  kizomba: [4427293502, 1205831211, 3311387182, 1839099582],
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

async function deezerFetch(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
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
  console.log(`[Deezer] Smart search for "${genre}"`);
  const tracks = [];
  const seen = new Set();

  const addTrack = (t) => {
    if (!t.preview || seen.has(t.id)) return;
    seen.add(t.id);
    tracks.push(t);
  };

  // Strategy 1: Playlist search — highest quality, curated content
  const playlistData = await deezerFetch(`/search/playlist?q=${encodeURIComponent(genre)}&limit=3`);
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
    const textTracks = await searchDeezerTracks(genre, genre, count * 2);
    for (const t of textTracks) addTrack(t);
  }

  // Strategy 3: Artist top tracks — good for region/style names
  if (tracks.length < count) {
    const artistData = await deezerFetch(`/search/artist?q=${encodeURIComponent(genre)}&limit=5`);
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
  // 1. Try to fetch from the local intelligent songs cache first
  try {
    const { getCachedTracksByGenre } = await import('./db.js');
    const cached = await getCachedTracksByGenre(genre, count * 2);
    
    if (cached && cached.length > 0) {
      console.log(`[DB] Fetched ${cached.length} candidate tracks from local intelligent cache for "${genre}"`);
      
      // Fetch fresh preview URLs from Deezer API in parallel for these tracks
      const tracksWithPreviews = [];
      const batchSize = 10;
      for (let i = 0; i < cached.length; i += batchSize) {
        const batch = cached.slice(i, i + batchSize);
        await Promise.all(batch.map(async (track) => {
          try {
            const rawId = track.id.replace('deezer:', '');
            const data = await deezerFetch(`/track/${rawId}`);
            if (data?.preview) {
              track.previewUrl = data.preview;
              tracksWithPreviews.push(track);
            }
          } catch (err) {
            console.error(`[Deezer] Failed to get fresh preview for track ${track.id}:`, err.message);
          }
        }));
        
        // Stop early if we have enough tracks with valid previews
        if (tracksWithPreviews.length >= count) {
          break;
        }
      }
      
      if (tracksWithPreviews.length >= count) {
        console.log(`[DB] Successfully resolved ${tracksWithPreviews.length} tracks with fresh previews from cache`);
        try {
          const { all } = await import('./db.js');
          const ids = tracksWithPreviews.map(t => t.id);
          if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            const playCounts = await all(
              `SELECT song_id, COUNT(*) as cnt FROM songs_played WHERE song_id IN (${placeholders}) GROUP BY song_id`,
              ids
            );
            const countMap = {};
            for (const row of playCounts) countMap[row.song_id] = row.cnt;
            tracksWithPreviews.forEach(t => t.playCount = countMap[t.id] || 0);
          }
        } catch (err) {
          console.error('[Deezer] Failed to query play counts:', err.message);
        }
        tracksWithPreviews.sort((a, b) => (a.playCount || 0) - (b.playCount || 0) || (b.rank || 0) - (a.rank || 0));
        return tracksWithPreviews.slice(0, count);
      }
    }
  } catch (err) {
    console.error('[DB] Failed to query local intelligent cache:', err.message);
  }

  console.log(`[Deezer] Cache miss or insufficient tracks for "${genre}". Falling back to Deezer API.`);

  let tracks = [];
  const seen = new Set();
  const genreId = GENRE_ID_MAP[genre];
  if (genreId == null) {
    return getCustomGenreTracks(genre, count);
  }

  const chartSource = CHART_SOURCES[genreId] || genre;

  function addTracks(data, label) {
    if (!data?.data) return 0;
    let added = 0;
    for (const t of data.data) {
      if (!t.preview || seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(mapTrack(t, chartSource));
      added++;
    }
    if (added > 0) console.log(`[Deezer] ${label} +${added} tracks for "${genre}"`);
    return added;
  }

  const chart = await deezerFetch(`/chart/${genreId}/tracks?limit=${count * 2}`);
  addTracks(chart, 'chart');

  if (tracks.length < count && genreId !== 0) {
    const editorial = await deezerFetch(`/editorial/0/playlists?genre_id=${genreId}&limit=5`);
    if (editorial?.data) {
      for (const pl of editorial.data) {
        if (tracks.length >= count) break;
        const plTracks = await deezerFetch(`/playlist/${pl.id}/tracks?limit=10`);
        addTracks(plTracks, `playlist "${pl.title}"`);
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
          track.genres = [genre];
        }
      } else {
        track.genres = [genre];
      }
    }));
  }

  if (!CUSTOM_GENRE_PLAYLISTS[genre]) {
    const before = tracks.length;
    tracks = tracks.filter(t => t.genres?.includes(genre) ?? true);
    if (tracks.length < before) console.log(`[Deezer] Filtered ${before - tracks.length} tracks from "${genre}" (genre isolation)`);
  }

  try {
    const { all } = await import('./db.js');
    const ids = tracks.map(t => t.id);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const playCounts = await all(
        `SELECT song_id, COUNT(*) as cnt FROM songs_played WHERE song_id IN (${placeholders}) GROUP BY song_id`,
        ids
      );
      const countMap = {};
      for (const row of playCounts) countMap[row.song_id] = row.cnt;
      tracks.forEach(t => t.playCount = countMap[t.id] || 0);
    }
  } catch (err) {
    console.error('[Deezer] Failed to query play counts:', err.message);
  }

  console.log(`[Deezer] Total ${tracks.length} tracks for "${genre}" (${tracks.filter(t => t.previewUrl).length} with preview)`);
  tracks.sort((a, b) => (a.playCount || 0) - (b.playCount || 0) || (b.rank || 0) - (a.rank || 0));
  return tracks.slice(0, count);
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
