const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let accessToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET not configured');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    let message;
    try {
      const json = JSON.parse(body);
      message = json.error_description || json.error || body;
    } catch {
      message = body;
    }
    throw new Error(`Spotify auth failed (${res.status}): ${message}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 120000;
  return accessToken;
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = await getToken();

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
      const delay = Math.min(retryAfter * 1000 * Math.pow(2, attempt), 30000);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    if (res.status === 401) {
      accessToken = null;
      if (attempt < retries) continue;
    }

    if (!res.ok) {
      const body = await res.text();
      let message;
      try {
        const json = JSON.parse(body);
        message = json.error?.message || json.error || body;
      } catch {
        message = body;
      }
      throw new Error(`Spotify API error (${res.status}): ${message}`);
    }

    return res.json();
  }

  throw new Error('Spotify API: max retries exceeded');
}

const GENRES = [
  'pop', 'rock', 'hip-hop', 'r-n-b', 'electronic', 'jazz', 'classical',
  'country', 'metal', 'indie', 'alternative', 'soul', 'funk', 'blues',
  'reggae', 'punk', 'latin', 'dance', 'edm', 'acoustic',
];

const GENRE_LABELS = {
  'r-n-b': 'R&B',
  'hip-hop': 'Hip Hop',
};

function getGenreLabel(genre) {
  return GENRE_LABELS[genre] || genre.charAt(0).toUpperCase() + genre.slice(1);
}

async function getTracksByGenre(genre, count = 10) {
  const tracks = [];
  const maxPerPage = 10;
  const maxResults = 100;
  const market = 'US';

  for (let offset = 0; offset < maxResults; offset += maxPerPage) {
    const q = encodeURIComponent(`genre:"${genre}"`);
    const url = `${API_BASE}/search?q=${q}&type=track&limit=${maxPerPage}&offset=${offset}&market=${market}`;

    const data = await fetchWithRetry(url);
    const items = data?.tracks?.items || [];

    for (const item of items) {
      tracks.push({
        id: item.id,
        name: item.name,
        artist: item.artists?.[0]?.name || 'Unknown',
        albumImage: item.album?.images?.[0]?.url || null,
        genre,
      });
    }

    if (tracks.length >= count) break;
    if (items.length < maxPerPage) break;
  }

  if (tracks.length === 0) {
    throw new Error(`No tracks found for genre: ${genre}`);
  }

  return shuffle(tracks).slice(0, count);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { getTracksByGenre, GENRES, getGenreLabel };
