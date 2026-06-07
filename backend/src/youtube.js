const API_BASE = 'https://www.googleapis.com/youtube/v3';

const cache = new Map();
const CACHE_MAX = 500;

function getCacheKey(name, artist) {
  return `${name}|${artist}`.toLowerCase().replace(/\s+/g, ' ');
}

async function searchDataAPI(name, artist) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const query = `"${name}" "${artist}" audio`;
  const url = `${API_BASE}/search?part=id&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${key}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.items?.[0]?.id?.videoId || null;
  } catch {
    return null;
  }
}

async function searchScrape(name, artist) {
  const query = encodeURIComponent(`${artist} ${name}`);
  const url = `https://www.youtube.com/results?search_query=${query}`;

  try {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Blindtest/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/"videoId":"([^"]+)"/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function searchYouTubeVideo(name, artist) {
  if (!name || !artist) return null;

  const cacheKey = getCacheKey(name, artist);
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const setCache = (videoId) => {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, videoId);
    return videoId;
  };

  const apiResult = await searchDataAPI(name, artist);
  if (apiResult) {
    console.log(`[YouTube] Data API: ${artist} - ${name} → ${apiResult}`);
    return setCache(apiResult);
  }

  const scrapeResult = await searchScrape(name, artist);
  if (scrapeResult) {
    console.log(`[YouTube] Scrape: ${artist} - ${name} → ${scrapeResult}`);
    return setCache(scrapeResult);
  }

  return null;
}

export { searchYouTubeVideo };
