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
  let index = 0;
  const startTime = Date.now();

  async function worker() {
    while (index < tracks.length) {
      const track = tracks[index++];
      try {
        const result = await classifyTrack(track);
        await updateAiClassification(track.id, result);

        if (config.audioEnabled) {
          const audioResult = await classifyAudio(track);
          if (audioResult.genres.length > 0) {
            await updateAiAudioGenres(track.id, audioResult.genres);
          }
        }

        processed++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const pct = ((index / tracks.length) * 100).toFixed(0);
        console.log(`[${pct}%] ✓ ${track.artist} - ${track.name} → ${result.genres.slice(0, 3).join(', ')}${result.genres.length > 3 ? '…' : ''}`);
      } catch (err) {
        console.error(`[ERR] ✗ ${track.artist} - ${track.name}: ${err.message}`);
        await markError(track.id, err.message);
        processed++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(config.concurrency, tracks.length) }, () => worker());
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const perTrack = (elapsed / processed).toFixed(1);
  console.log(`[AI] Batch done: ${processed} tracks in ${elapsed}s (${perTrack}s/track)`);
  return processed;
}

async function runBatch() {
  console.log(`[AI] Model: ${config.ollamaModel}, version: ${config.aiVersion}`);
  console.log(`[AI] Concurrency: ${config.concurrency}, batch size: ${config.batchSize}`);

  const total = await fetchUnprocessedCount();
  if (total === 0) {
    console.log('[AI] All tracks already processed ✓');
    await closePool();
    return;
  }
  console.log(`[AI] ${total} tracks to process`);

  let done = 0;
  let startedAt = Date.now();

  while (done < total) {
    const count = await processBatch();
    done += count;
    if (count === 0) break;

    const remaining = await fetchUnprocessedCount();
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const rate = (done / (Date.now() - startedAt) * 1000).toFixed(1);
    const eta = remaining > 0 ? ((remaining / parseFloat(rate)).toFixed(0)) : '0';
    console.log(`[AI] ${done}/${total} done — ${rate} tracks/s — ETA ${eta}s — ${remaining} remaining`);
  }

  const totalTime = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[AI] Complete: ${done} tracks in ${totalTime}s`);
  await closePool();
}

async function runWatch() {
  console.log(`[AI] Watch mode — polling every ${config.pollIntervalMs}ms`);
  console.log(`[AI] Model: ${config.ollamaModel}, version: ${config.aiVersion}`);

  async function cycle() {
    try {
      const count = await processBatch();
      if (count > 0) {
        const remaining = await fetchUnprocessedCount();
        console.log(`[AI] ${remaining} tracks remaining in queue`);
      }
    } catch (err) {
      console.error('[AI] Watch cycle error:', err.message);
    }
    setTimeout(cycle, config.pollIntervalMs);
  }

  cycle();
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
