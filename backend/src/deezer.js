const API_BASE = 'https://api.deezer.com';

const GENRE_ID_MAP = {
  pop: 132,
  rock: 152,
  'hip-hop': 116,
  'r-n-b': 165,
  electronic: 106,
  jazz: 129,
  classical: 98,
  country: 84,
  metal: 464,
  indie: 85,
  soul: 169,
  blues: 153,
  reggae: 144,
  latin: 197,
  dance: 113,
  brazilian: 75,
};

const CUSTOM_GENRE_PLAYLISTS = {
  portugal: [13554294441, 1362519755],
};

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
      return GENRE_ID_MAP[name] ? name : g.name.toLowerCase().replace(/\s+/g, '-');
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

async function getCustomGenreTracks(genre, count) {
  const playlistIds = CUSTOM_GENRE_PLAYLISTS[genre];
  if (!playlistIds?.length) {
    console.log(`[Deezer] No custom source for "${genre}", skipping`);
    return [];
  }

  const tracks = [];
  const seen = new Set();

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
  const tracks = [];
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

  console.log(`[Deezer] Total ${tracks.length} tracks for "${genre}" (${tracks.filter(t => t.previewUrl).length} with preview)`);
  tracks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  return tracks.slice(0, count);
}

const GENRES = [
  'pop', 'rock', 'hip-hop', 'r-n-b', 'electronic', 'jazz', 'classical',
  'country', 'metal', 'indie', 'soul', 'blues', 'reggae', 'latin',
  'dance', 'brazilian', 'portugal',
];

const GENRE_LABELS = {
  'r-n-b': 'R&B',
  'hip-hop': 'Hip Hop',
  brazilian: 'Brazilian',
  portugal: 'Portugal',
};

function getGenreLabel(genre) {
  return GENRE_LABELS[genre] || genre.charAt(0).toUpperCase() + genre.slice(1);
}

export { getTracksByGenre, GENRES, getGenreLabel };