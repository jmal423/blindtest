const API_BASE = 'https://www.googleapis.com/youtube/v3';

const cache = new Map();
const CACHE_MAX = 500;

function getCacheKey(name, artist) {
  return `${name}|${artist}`.toLowerCase().replace(/\s+/g, ' ');
}

async function searchYouTubeVideo(name, artist) {
  if (!name || !artist) return null;

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const cacheKey = getCacheKey(name, artist);
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const query = `"${name}" "${artist}" audio`;
  const url = `${API_BASE}/search?part=id&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        console.error('YouTube API quota exceeded or forbidden');
        return null;
      }
      throw new Error(`YouTube API error (${res.status})`);
    }

    const data = await res.json();
    const videoId = data?.items?.[0]?.id?.videoId || null;

    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(cacheKey, videoId);

    return videoId;
  } catch (err) {
    console.error('YouTube search failed:', err.message);
    return null;
  }
}

export { searchYouTubeVideo };
