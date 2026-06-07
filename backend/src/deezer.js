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
  alternative: 85,
  soul: 169,
  funk: 169,
  blues: 153,
  reggae: 144,
  punk: 152,
  latin: 197,
  dance: 113,
  edm: 106,
  acoustic: 466,
  folk: 466,
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

function mapTrack(t, genre) {
  return {
    id: `deezer:${t.id}`,
    name: t.title,
    artist: t.artist?.name || 'Unknown',
    albumImage: t.album?.cover_big || null,
    previewUrl: t.preview,
    durationMs: (parseInt(t.duration, 10) || 30) * 1000,
    genre,
  };
}

async function getTracksByGenre(genre, count = 10) {
  const tracks = [];
  const seen = new Set();
  const genreId = GENRE_ID_MAP[genre];
  if (!genreId) {
    console.log(`[Deezer] No genre ID for "${genre}", skipping`);
    return [];
  }

  function addTracks(data, label) {
    if (!data?.data) return 0;
    let added = 0;
    for (const t of data.data) {
      if (!t.preview || seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(mapTrack(t, genre));
      added++;
    }
    if (added > 0) console.log(`[Deezer] ${label} +${added} tracks for "${genre}"`);
    return added;
  }

  const chart = await deezerFetch(`/chart/${genreId}/tracks?limit=${count * 2}`);
  addTracks(chart, 'chart');

  if (tracks.length < count) {
    const editorial = await deezerFetch(`/editorial/0/playlists?genre_id=${genreId}&limit=5`);
    if (editorial?.data) {
      for (const pl of editorial.data) {
        if (tracks.length >= count) break;
        const plTracks = await deezerFetch(`/playlist/${pl.id}/tracks?limit=10`);
        addTracks(plTracks, `playlist "${pl.title}"`);
      }
    }
  }

  console.log(`[Deezer] Total ${tracks.length} tracks for "${genre}" (${tracks.filter(t => t.previewUrl).length} with preview)`);
  return shuffle(tracks).slice(0, count);
}

export { getTracksByGenre };
