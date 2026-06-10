// Backfill preview_url for all songs in songs_cache that have a null preview_url
import { pool } from './src/db.js';

const API_BASE = 'https://api.deezer.com';

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

const { rows } = await pool.query(
  `SELECT id FROM songs_cache WHERE preview_url IS NULL ORDER BY rank DESC LIMIT 500`
);

console.log(`Found ${rows.length} tracks without preview_url`);

let updated = 0;
let failed = 0;
const batchSize = 5;

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  await Promise.all(batch.map(async (row) => {
    const rawId = row.id.replace('deezer:', '');
    const data = await deezerFetch(`/track/${rawId}`);
    if (data?.preview) {
      await pool.query(
        `UPDATE songs_cache SET preview_url = $1 WHERE id = $2`,
        [data.preview, row.id]
      );
      updated++;
    } else {
      failed++;
    }
  }));
  
  if ((i + batchSize) % 50 === 0 || i + batchSize >= rows.length) {
    console.log(`Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length} (${updated} updated, ${failed} failed)`);
  }
  
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nDone! Updated ${updated} tracks, ${failed} failed.`);
process.exit(0);
