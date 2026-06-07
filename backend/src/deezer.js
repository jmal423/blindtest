const API_BASE = 'https://api.deezer.com';

const GENRE_ARTIST_IDS = {
  pop: [13, 182, 257, 4053],
  rock: [1, 359, 4292, 930],
  'hip-hop': [13, 183, 10296],
  'r-n-b': [246, 755, 4486],
  electronic: [27, 470, 10394],
  jazz: [135, 4, 1001],
  classical: [136, 615, 139],
  country: [33, 412, 4460],
  metal: [196, 388, 276],
  indie: [1006809, 3607, 4526],
  alternative: [3607, 1006809, 1250],
  soul: [246, 51, 832],
  funk: [26, 72, 793],
  blues: [45, 137, 367],
  reggae: [82, 130, 99],
  punk: [10, 16, 20],
  latin: [68, 28, 132],
  dance: [27, 1067, 470],
  edm: [27, 469, 10194],
  acoustic: [319, 4441, 771],
};

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

async function getTracksByGenre(genre, count = 10) {
  const artistIds = GENRE_ARTIST_IDS[genre] || [];
  const tracks = [];

  for (const artistId of artistIds) {
    if (tracks.length >= count) break;

    const data = await deezerFetch(`/artist/${artistId}/top?limit=${Math.min(count, 50)}`);
    if (!data?.data) continue;

    for (const t of data.data) {
      if (!t.preview) continue;
      tracks.push({
        id: `deezer:${t.id}`,
        name: t.title,
        artist: t.artist?.name || 'Unknown',
        albumImage: t.album?.cover_big || null,
        previewUrl: t.preview,
        durationMs: (t.duration || 30) * 1000,
        genre,
      });
    }
  }

  // Fallback: search by genre keyword if artist top tracks didn't yield enough
  if (tracks.length < 5) {
    const searchData = await deezerFetch(`/search?q=${encodeURIComponent(genre)}&limit=${Math.min(count * 2, 100)}`);
    if (searchData?.data) {
      for (const t of searchData.data) {
        if (!t.preview || tracks.find(tr => tr.id === `deezer:${t.id}`)) continue;
        tracks.push({
          id: `deezer:${t.id}`,
          name: t.title,
          artist: t.artist?.name || 'Unknown',
          albumImage: t.album?.cover_big || null,
          previewUrl: t.preview,
          durationMs: (t.duration || 30) * 1000,
          genre,
        });
      }
    }
  }

  console.log(`[Deezer] Fetched ${tracks.length} tracks for "${genre}"`);
  return tracks.slice(0, count);
}

export { getTracksByGenre };
