import { getTracksByGenre } from './deezer.js';

try {
  console.log('Fetching tracks for pop_urbano_nova_pop...');
  const tracks = await getTracksByGenre('pop_urbano_nova_pop', 15);
  console.log('Tracks returned:');
  console.table(tracks.map(t => ({
    id: t.id,
    name: t.name,
    artist: t.artist,
    genres: t.genres,
    previewUrl: t.previewUrl ? 'Yes' : 'No'
  })));
} catch (err) {
  console.error(err);
}
