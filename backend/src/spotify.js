const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let cachedToken = null;
let tokenExpiration = 0;

async function getValidToken() {
  if (cachedToken && Date.now() < tokenExpiration) {
    return cachedToken;
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
  cachedToken = data.access_token;
  tokenExpiration = Date.now() + (data.expires_in * 1000) - 60000;
  return cachedToken;
}

async function spotifyFetch(endpoint, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = await getValidToken();
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'Blindtest/1.0',
      },
      redirect: 'follow',
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (res.status === 401) {
      cachedToken = null;
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
      throw new Error(`Spotify API error (${res.status}) [${url}]: ${message}`);
    }

    return res.json();
  }

  throw new Error('Spotify API: max retries exceeded');
}

async function getPlaylistTracks(playlistId, market = 'FR') {
  let allItems = [];
  let url = `playlists/${playlistId}/items?market=${market}&limit=50`;

  while (url) {
    const data = await spotifyFetch(url);
    const items = data?.items || [];

    for (const item of items) {
      if (!item.track) continue;
      allItems.push({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists?.[0]?.name || 'Unknown',
        albumImage: item.track.album?.images?.[0]?.url || null,
        previewUrl: item.track.preview_url || null,
        genre: 'playlist',
      });
    }

    url = null;
    if (data?.next && data?.next.startsWith('https')) {
      const offset = data.next.match(/offset=(\d+)/)?.[1];
      if (offset) {
        url = `playlists/${playlistId}/items?market=${market}&limit=50&offset=${offset}`;
      }
    }
  }

  console.log(`[Spotify Playlist] Fetched ${allItems.length} tracks from playlist ${playlistId}. First track previewUrl:`, allItems[0]?.previewUrl);

  return allItems;
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
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)');
  }

  const tracks = [];

  // Test basic API connectivity first
  try {
    const testData = await spotifyFetch(`${API_BASE}/browse/categories?limit=5`);
    console.log(`[Spotify] API test OK — got ${testData?.categories?.items?.length || 0} categories`);
  } catch (err) {
    console.error(`[Spotify] API connectivity test FAILED:`, err.message);
  }

  // Strategy 1: search by genre tag with market=FR
  if (tracks.length === 0) {
    try {
      const q = encodeURIComponent(`genre:"${genre}"`);
      const url = `${API_BASE}/search?q=${q}&type=track&limit=20&market=FR`;
      console.log(`[Spotify] Search URL:`, url);
      const data = await spotifyFetch(url);
      for (const item of (data?.tracks?.items || [])) {
        const t = item.track ? item.track : item;
        tracks.push({
          id: t.id, name: t.name,
          artist: t.artists?.[0]?.name || 'Unknown',
          albumImage: t.album?.images?.[0]?.url || null,
          previewUrl: t.preview_url || null, genre,
        });
      }
    } catch (err) {
      console.error(`[Spotify] Search (FR) failed for "${genre}":`, err.message);
    }
  }

  // Strategy 2: search without market restriction
  if (tracks.length === 0) {
    try {
      const q = encodeURIComponent(`genre:"${genre}"`);
      const url = `${API_BASE}/search?q=${q}&type=track&limit=20`;
      console.log(`[Spotify] Search URL (no market):`, url);
      const data = await spotifyFetch(url);
      for (const item of (data?.tracks?.items || [])) {
        const t = item.track ? item.track : item;
        tracks.push({
          id: t.id, name: t.name,
          artist: t.artists?.[0]?.name || 'Unknown',
          albumImage: t.album?.images?.[0]?.url || null,
          previewUrl: t.preview_url || null, genre,
        });
      }
    } catch (err) {
      console.error(`[Spotify] Search (no market) failed for "${genre}":`, err.message);
    }
  }

  // Strategy 3: keyword search as last resort
  if (tracks.length === 0) {
    try {
      const url = `${API_BASE}/search?q=${encodeURIComponent(genre)}&type=track&limit=20&market=FR`;
      console.log(`[Spotify] Keyword search URL:`, url);
      const data = await spotifyFetch(url);
      for (const item of (data?.tracks?.items || [])) {
        const t = item.track ? item.track : item;
        tracks.push({
          id: t.id, name: t.name,
          artist: t.artists?.[0]?.name || 'Unknown',
          albumImage: t.album?.images?.[0]?.url || null,
          previewUrl: t.preview_url || null, genre,
        });
      }
    } catch (err) {
      console.error(`[Spotify] Keyword search failed for "${genre}":`, err.message);
    }
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

export { getTracksByGenre, getPlaylistTracks, getValidToken, GENRES, getGenreLabel };
