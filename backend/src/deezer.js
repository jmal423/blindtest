const API_BASE = 'https://api.deezer.com';

const GENRE_ARTIST_IDS = {
  pop: [13, 182, 257, 4053, 123, 754, 412],
  rock: [1, 359, 4292, 930, 34, 688, 112],
  'hip-hop': [13, 183, 10296, 522, 154, 637],
  'r-n-b': [246, 755, 4486, 28, 51, 832],
  electronic: [27, 470, 10394, 1067, 469, 10194],
  jazz: [135, 4, 1001, 228, 65, 82],
  classical: [136, 615, 139, 104, 113],
  country: [33, 412, 4460, 48, 117],
  metal: [196, 388, 276, 5, 90, 186],
  indie: [1006809, 3607, 4526, 1250, 479, 179],
  alternative: [3607, 1006809, 1250, 688, 34],
  soul: [246, 51, 832, 8, 70, 149],
  funk: [26, 72, 793, 21, 146],
  blues: [45, 137, 367, 115, 42],
  reggae: [82, 130, 99, 200, 118],
  punk: [10, 16, 20, 45, 89],
  latin: [68, 28, 132, 133, 194],
  dance: [27, 1067, 470, 302, 158],
  edm: [27, 469, 10194, 1067, 470],
  acoustic: [319, 4441, 771, 96, 52],
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

  // Strategy 1: keyword search (most diverse)
  const searchData = await deezerFetch(`/search?q=${encodeURIComponent(genre)}&limit=${Math.min(count * 4, 100)}`);
  if (searchData?.data) {
    for (const t of searchData.data) {
      if (!t.preview || seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(mapTrack(t, genre));
    }
    console.log(`[Deezer] Search gave ${tracks.length} tracks for "${genre}"`);
  }

  // Strategy 2: top tracks from genre artists (supplement)
  const artistIds = shuffle(GENRE_ARTIST_IDS[genre] || []);
  for (const artistId of artistIds) {
    if (tracks.length >= count) break;
    const data = await deezerFetch(`/artist/${artistId}/top?limit=10`);
    if (!data?.data) continue;
    for (const t of data.data) {
      if (!t.preview || seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(mapTrack(t, genre));
    }
  }

  console.log(`[Deezer] Total ${tracks.length} tracks for "${genre}" (${tracks.filter(t => t.previewUrl).length} with preview)`);
  return tracks.slice(0, count);
}

export { getTracksByGenre };
