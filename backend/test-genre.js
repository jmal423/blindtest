import { getTracksByGenre } from './src/deezer.js';

const genre = process.argv[2] || 'pop_rock_tuga';
const count = parseInt(process.argv[3]) || 5;

console.log(`\nTesting getTracksByGenre("${genre}", ${count})...\n`);

try {
  const tracks = await getTracksByGenre(genre, count);
  console.log(`\n✅ Returned ${tracks.length} tracks:\n`);
  for (const t of tracks) {
    console.log(`  🎵 ${t.artist} — ${t.name}  (id: ${t.id}, preview: ${!!t.previewUrl})`);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
}

process.exit(0);
