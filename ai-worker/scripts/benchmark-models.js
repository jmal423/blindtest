// Compares qwen3.5 models for speed and accuracy on genre classification.
// Usage: node scripts/benchmark-models.js
import { execSync } from 'child_process';

const OLLAMA_URL = 'http://127.0.0.1:11434';

const MODELS = ['llama3.2:3b', 'llama3.1:8b'];

// Mock songs with known correct genres — pulled from your taxonomy
const TEST_SONGS = [
  { name: "Gata", artist: "Nininho Vaz Maia", expected: "PT_hip_hop_tuga" },
  { name: "Te Amo", artist: "Calema", expected: "PT_kizomba_palop" },
  { name: "Ai Se Eu Te Pego", artist: "Michel Teló", expected: "BR_pop" },
  { name: "Telefone", artist: "Luísa Sonza", expected: "BR_pop" },
  { name: "Dois Apaixonados", artist: "Melody", expected: "BR_funk_brasileiro" },
  { name: "A Loba", artist: "Gloria Groove", expected: "BR_pop" },
  { name: "Metamorfose Ambulante", artist: "Raul Seixas", expected: "BR_pop_rock_brasileiro" },
  { name: "Vai Me Dando Corda", artist: "Grupo Menos É Mais", expected: "BR_samba_pagode" },
  { name: "Espresso", artist: "Sabrina Carpenter", expected: "US_pop_us" },
  { name: "Not Like Us", artist: "Kendrick Lamar", expected: "US_hip_hop_trap_us" },
  { name: "Humble", artist: "Kendrick Lamar", expected: "US_hip_hop_trap_us" },
  { name: "1979", artist: "The Smashing Pumpkins", expected: "US_rock_alternative_us" },
  { name: "All I Want for Christmas Is You", artist: "Mariah Carey", expected: "US_pop_us" },
  { name: "A Bar Song (Tipsy)", artist: "Shaboozey", expected: "US_country_americana_us" },
  { name: "Angels", artist: "Robbie Williams", expected: "UK_pop_uk" },
  { name: "Wonderwall", artist: "Oasis", expected: "UK_britpop_rock_uk" },
  { name: "Let It Be", artist: "The Beatles", expected: "UK_britpop_rock_uk" },
  { name: "Crossroads", artist: "Blazin' Squad", expected: "UK_uk_garage_dnb" },
  { name: "Game On", artist: "JT", expected: "UK_uk_drill_grime" },
  { name: "Petite Marie", artist: "Francis Cabrel", expected: "FR_chanson_francaise" },
  { name: "Ancrée à ton port", artist: "Louane", expected: "FR_pop_francaise" },
  { name: "Piano", artist: "Werenoi", expected: "FR_rap_francais" },
  { name: "Around the World", artist: "Daft Punk", expected: "FR_french_touch_electro" },
  { name: "La Camisa Negra", artist: "Juanes", expected: "ES_reggaeton_urbano" },
  { name: "Soltera", artist: "Shakira", expected: "ES_reggaeton_urbano" },
  { name: "Fale Então", artist: "Marshmello", expected: "GL_edm_dance" },
  { name: "Du hast", artist: "Rammstein", expected: "GL_metal" },
  { name: "PONGO", artist: "Rvssian", expected: "GL_reggae" },
  { name: "CRAZY", artist: "LE SSERAFIM", expected: "GL_kpop" },
];

function buildPrompt(name, artist, options) {
  const list = options.map(g => `- ${g}`).join('\n');
  return `Classify this track into one genre from the list.

${list}

Track: "${name}" by ${artist}

Return ONLY {"genre": "genre_id_here"}`;
}

async function ollamaGenerate(model, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.0 } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return data.response || '';
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function testModel(model) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Testing: ${model}`);
  console.log(`${'='.repeat(60)}`);

  let correct = 0;
  let total = 0;
  let totalTime = 0;
  const results = [];

  // Group genre options by region for faster classification
  const genreOptions = {
    PT: ["PT_fado", "PT_tradicional_folklore_pimba", "PT_pop_tuga", "PT_pop_rock_tuga", "PT_hip_hop_tuga", "PT_kizomba_palop", "PT_pop_urbano_nova_pop"],
    BR: ["BR_samba_pagode", "BR_bossa_nova", "BR_funk_brasileiro", "BR_pop_rock_brasileiro", "BR_pop"],
    US: ["US_pop_us", "US_hip_hop_trap_us", "US_country_americana_us", "US_rock_alternative_us"],
    UK: ["UK_pop_uk", "UK_uk_drill_grime", "UK_britpop_rock_uk", "UK_uk_garage_dnb"],
    FR: ["FR_chanson_francaise", "FR_pop_francaise", "FR_rap_francais", "FR_french_touch_electro"],
    ES: ["ES_flamenco", "ES_reggaeton_urbano", "ES_musica_regional_latina"],
    GL: ["GL_reggae", "GL_kpop", "GL_edm_dance", "GL_afrobeats_african", "GL_metal", "GL_soundtracks", "GL_jazz_lounge", "GL_other"],
  };

  for (const song of TEST_SONGS) {
    const prefix = song.expected.substring(0, 2);
    const options = genreOptions[prefix] || genreOptions.GL;
    const prompt = buildPrompt(song.name, song.artist, options);
    const start = Date.now();
    let predicted = 'ERROR';
    try {
      const raw = await ollamaGenerate(model, prompt);
      // Try to extract JSON from the response
      const match = raw.match(/\{[^}]*"genre"\s*:\s*"[^"]*"[^}]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        predicted = parsed.genre || 'MISSING_FIELD';
      } else {
        predicted = 'NO_MATCH: ' + raw.slice(0, 60);
      }
    } catch (err) {
      predicted = `PARSE_ERR: ${err.message.slice(0, 50)}`;
    }
    const elapsed = Date.now() - start;
    totalTime += elapsed;

    const isCorrect = predicted === song.expected;
    if (isCorrect) correct++;
    total++;

    const mark = isCorrect ? '✓' : '✗';
    const timeStr = (elapsed / 1000).toFixed(1);
    console.log(`  ${mark} [${timeStr}s] "${song.name}" - ${song.artist} → ${predicted} (expected: ${song.expected})`);

    results.push({ song: `${song.name} - ${song.artist}`, expected: song.expected, predicted, correct: isCorrect, time: elapsed });
  }

  const accuracy = ((correct / total) * 100).toFixed(0);
  const avgTime = (totalTime / total / 1000).toFixed(1);

  console.log(`\n  ──────────────────────────────────`);
  console.log(`  Accuracy: ${correct}/${total} (${accuracy}%)`);
  console.log(`  Avg time: ${avgTime}s per song`);
  console.log(`  Total:    ${(totalTime / 1000).toFixed(0)}s`);

  return { model, accuracy: Number(accuracy), avgTime: Number(avgTime), totalTime, correct, total, results };
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Model Benchmark: Genre Classification   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n${TEST_SONGS.length} test songs`);
  console.log(`Ollama: ${OLLAMA_URL}\n`);

  const modelResults = [];
  for (const model of MODELS) {
    const result = await testModel(model);
    modelResults.push(result);
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('  FINAL COMPARISON');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Model               Accuracy    Avg/Song    Total     Correct`);
  console.log(`  ───────────────────────────────────────────────────────────`);
  for (const r of modelResults) {
    const model = r.model.padEnd(20);
    const acc = `${r.accuracy}%`.padStart(8);
    const time = `${r.avgTime}s`.padStart(10);
    const total = `${(r.totalTime / 1000).toFixed(0)}s`.padStart(9);
    const corr = `${r.correct}/${r.total}`.padStart(7);
    console.log(`  ${model} ${acc} ${time} ${total} ${corr}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
