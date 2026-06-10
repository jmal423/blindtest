import { getTracksByGenre } from './backend/src/deezer.js';

(async () => {
  const tracks = await getTracksByGenre('pop_rock_tuga', 5);
  console.log('Returned tracks count:', tracks.length);
  console.log(tracks.map(t => ({ id: t.id, preview: !!t.previewUrl, genre: t.genre })));
})();
