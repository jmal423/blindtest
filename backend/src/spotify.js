import SpotifyWebApi from 'spotify-web-api-node';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpiration = 0;

async function ensureToken() {
  const now = Date.now();
  if (now >= tokenExpiration) {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    tokenExpiration = now + data.body.expires_in * 1000 - 60000;
  }
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

async function getTracksByGenre(genre, limit = 20) {
  await ensureToken();

  const searchLimit = Math.max(limit * 5, 50);

  try {
    const data = await spotifyApi.searchTracks(genre, { limit: searchLimit });
    const tracks = data.body.tracks.items
      .filter(t => t.preview_url)
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        name: t.name,
        artist: t.artists[0].name,
        previewUrl: t.preview_url,
        albumImage: t.album.images[0]?.url,
      }));

    if (tracks.length >= 1) {
      return shuffle(tracks);
    }
  } catch (err) {
    console.error(`Spotify error for genre "${genre}":`, err.message);
  }

  return [];
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
