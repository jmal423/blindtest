// Search Deezer for curated playlists for missing genres
const API_BASE = 'https://api.deezer.com';

async function deezerFetch(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const searches = {
  pop_tuga: 'Pop Português',
  pop_urbano_nova_pop: 'Nova Pop Portuguesa',
  country_americana_us: 'Country Americana',
  rock_alternative_us: 'Rock Alternative',
  pop_uk: 'Pop UK Hits',
  uk_drill_grime: 'UK Drill Grime',
  britpop_rock_uk: 'Britpop Rock UK',
  uk_garage_dnb: 'Drum and Bass UK Garage',
  chanson_francaise: 'Chanson Française',
  pop_francaise: 'Pop Française',
  reggae: 'Reggae',
};

for (const [genre, query] of Object.entries(searches)) {
  console.log(`\n=== ${genre} (query: "${query}") ===`);
  const data = await deezerFetch(`/search/playlist?q=${encodeURIComponent(query)}&limit=8`);
  if (!data?.data) {
    console.log('  No results');
    continue;
  }
  for (const pl of data.data) {
    // Get first 3 tracks for verification
    const tracks = await deezerFetch(`/playlist/${pl.id}/tracks?limit=3`);
    const artists = tracks?.data?.map(t => t.artist?.name).join(', ') || 'unknown';
    console.log(`  [${pl.id}] "${pl.title}" (${pl.nb_tracks} tracks) by ${pl.creator?.name} → ${artists}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

process.exit(0);
