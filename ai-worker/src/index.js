import { config } from './config.js';
import { fetchUnprocessedTracks, fetchUnprocessedCount, updateAiClassification, updateAiAudioGenres, markError, closePool } from './db.js';
import { classifyTrack } from './classifier-metadata.js';
import { classifyAudio } from './classifier-audio.js';

const mode = process.argv.includes('--mode=watch') ? 'watch'
  : process.argv.includes('--mode=batch') ? 'batch'
  : 'batch';

async function processBatch() {
  const tracks = await fetchUnprocessedTracks();
  if (tracks.length === 0) {
    console.log('[AI] No unprocessed tracks found');
    return 0;
  }

  console.log(`[AI] Processing ${tracks.length} tracks (concurrency: ${config.concurrency})...`);
  let processed = 0;

  const queue = [...tracks];
  async function worker() {
    while (queue.length > 0) {
      const track = queue.shift();
      try {
        console.log(`[AI] Classifying: ${track.artist} - ${track.name}`);
        const result = await classifyTrack(track);
        await updateAiClassification(track.id, result);

        if (config.audioEnabled) {
          const audioResult = await classifyAudio(track);
          if (audioResult.genres.length > 0) {
            await updateAiAudioGenres(track.id, audioResult.genres);
            console.log(`[AI] Audio: ${track.artist} - ${track.name} → ${audioResult.genres.join(', ')}`);
          }
        }

        console.log(`[AI] Done: ${track.artist} - ${track.name} → ${result.genres.join(', ')}`);
        processed++;
      } catch (err) {
        console.error(`[AI] Failed: ${track.artist} - ${track.name}: ${err.message}`);
        await markError(track.id, err.message);
        processed++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(config.concurrency, tracks.length) }, () => worker());
  await Promise.all(workers);

  return processed;
}

async function runBatch() {
  console.log(`[AI] Batch mode — model: ${config.ollamaModel}, version: ${config.aiVersion}`);
  const total = await fetchUnprocessedCount();
  console.log(`[AI] ${total} tracks to process`);

  let done = 0;
  while (done < total) {
    const count = await processBatch();
    done += count;
    if (count === 0) break;
    console.log(`[AI] Progress: ${done}/${total}`);
  }

  console.log(`[AI] Batch complete: ${done} tracks processed`);
  await closePool();
}

async function runWatch() {
  console.log(`[AI] Watch mode — polling every ${config.pollIntervalMs}ms`);
  console.log(`[AI] Model: ${config.ollamaModel}, version: ${config.aiVersion}`);

  const run = async () => {
    try {
      const count = await processBatch();
      if (count > 0) {
        const remaining = await fetchUnprocessedCount();
        console.log(`[AI] ${remaining} tracks remaining in queue`);
      }
    } catch (err) {
      console.error('[AI] Watch cycle error:', err.message);
    }
  };

  await run();
  setInterval(run, config.pollIntervalMs);
}

console.log(`[AI] BlindTest AI Worker starting...`);
console.log(`[AI] Mode: ${mode}`);
console.log(`[AI] DB: ${config.databaseUrl.replace(/\/\/.*@/, '//***@')}`);
console.log(`[AI] Ollama: ${config.ollamaUrl}/${config.ollamaModel}`);

if (mode === 'watch') {
  await runWatch();
} else {
  await runBatch();
}
