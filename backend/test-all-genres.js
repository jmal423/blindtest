import { getTracksByGenre } from './src/deezer.js';
import { GENRES } from './src/genres-config.js';

const count = 5;
const results = [];
const DELAY_MS = 3000; // 3 second delay between genres to avoid Deezer rate limiting

for (const genre of GENRES) {
  process.stdout.write(`Testing "${genre}"... `);
  try {
    const tracks = await getTracksByGenre(genre, count);
    const artists = tracks.map(t => t.artist).join(', ');
    const ok = tracks.length > 0;
    results.push({ genre, count: tracks.length, ok, artists });
    console.log(`${ok ? '✅' : '❌'} ${tracks.length} tracks → ${artists}`);
  } catch (err) {
    results.push({ genre, count: 0, ok: false, artists: '', error: err.message });
    console.log(`❌ ERROR: ${err.message}`);
  }
  // Wait between genres to avoid Deezer rate limiting
  await new Promise(r => setTimeout(r, DELAY_MS));
}

console.log('\n\n========== SUMMARY ==========\n');
const maxLen = Math.max(...results.map(r => r.genre.length));
for (const r of results) {
  const status = r.ok ? '✅' : '❌';
  const pad = r.genre.padEnd(maxLen);
  console.log(`${status} ${pad}  ${r.count} tracks  →  ${r.artists}`);
}

const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  console.log(`\n⚠️  ${failed.length} genres returned 0 tracks: ${failed.map(r => r.genre).join(', ')}`);
} else {
  console.log(`\n🎉 All ${results.length} genres returned tracks successfully!`);
}

process.exit(0);
