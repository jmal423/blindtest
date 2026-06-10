import pg from 'pg';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node db-status.js <database_url>');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

try {
  const { rows: stats } = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version NOT LIKE 'error:%') as processed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) as unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version LIKE 'error:%') as errors,
      COUNT(*) FILTER (WHERE already_verified = TRUE) as verified
    FROM songs_cache
  `);

  const { rows: tracks } = await pool.query('SELECT id, name, artist FROM songs_cache');
  
  // Normalized duplicates logic
  function getNormalizationKey(title) {
    return title
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\s*-\s*.*$/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  const groups = {};
  for (const track of tracks) {
    const artistKey = track.artist.toLowerCase().trim();
    const titleKey = getNormalizationKey(track.name);
    if (!titleKey) continue;
    const key = `${artistKey}::${titleKey}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(track);
  }

  const duplicates = Object.values(groups).filter(g => g.length > 1).length;
  const duplicateTracks = Object.values(groups).filter(g => g.length > 1).reduce((sum, g) => sum + g.length, 0);

  console.log(JSON.stringify({
    ok: true,
    stats: stats[0],
    duplicates,
    duplicateTracks
  }));
} catch (err) {
  console.log(JSON.stringify({
    ok: false,
    error: err.message
  }));
} finally {
  await pool.end();
}
