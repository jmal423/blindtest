import { config } from './config.js';
import { buildGenrePrompt } from './genres.js';

async function ollamaGenerate(prompt) {
  const url = `${config.ollamaUrl}/api/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response;
}

const VALID_GENRES = new Set([
  "fado", "tradicional_folklore_pimba", "pop_tuga", "pop_rock_tuga", "hip_hop_tuga",
  "classica_tuga", "kizomba_palop", "pop_urbano_nova_pop", "pop_us", "hip_hop_trap_us",
  "country_americana_us", "rock_alternative_us", "pop_uk", "uk_drill_grime", "britpop_rock_uk",
  "uk_garage_dnb", "chanson_francaise", "pop_francaise", "rap_francais", "french_touch_electro",
  "flamenco", "reggaeton_urbano", "musica_regional_latina", "samba_pagode", "bossa_nova",
  "funk_brasileiro", "other"
]);

const VALID_REGIONS = new Set([
  "portuguese", "brazilian", "united_states", "united_kingdom", "french", "spanish", "global_other"
]);

const GENRE_TO_REGION = {
  "fado": "portuguese", "tradicional_folklore_pimba": "portuguese", "pop_tuga": "portuguese", "pop_rock_tuga": "portuguese",
  "hip_hop_tuga": "portuguese", "classica_tuga": "portuguese", "kizomba_palop": "portuguese", "pop_urbano_nova_pop": "portuguese",
  "samba_pagode": "brazilian", "bossa_nova": "brazilian", "funk_brasileiro": "brazilian",
  "pop_us": "united_states", "hip_hop_trap_us": "united_states", "country_americana_us": "united_states", "rock_alternative_us": "united_states",
  "pop_uk": "united_kingdom", "uk_drill_grime": "united_kingdom", "britpop_rock_uk": "united_kingdom", "uk_garage_dnb": "united_kingdom",
  "chanson_francaise": "french", "pop_francaise": "french", "rap_francais": "french", "french_touch_electro": "french",
  "flamenco": "spanish", "reggaeton_urbano": "spanish", "musica_regional_latina": "spanish",
  "other": "global_other"
};

function parseResponse(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
    try { parsed = JSON.parse(stripped); } catch {}
  }

  if (!parsed || !parsed.mapped_genre_id) {
    throw new Error(`Failed to parse LLM response: ${raw.slice(0, 200)}`);
  }

  let genreId = parsed.mapped_genre_id.toLowerCase().trim();

  // Validate genre
  if (!VALID_GENRES.has(genreId)) {
    console.warn(`[AI] LLM returned invalid genre_id "${genreId}". Falling back to "other".`);
    genreId = 'other';
  }

  // Enforce region matches genre (bulletproof alignment guard)
  const region = GENRE_TO_REGION[genreId] || 'global_other';

  return {
    genres: [genreId],
    tags: [region],
    primary: genreId,
    confidence: { [genreId]: 1.0 },
  };
}

export async function classifyTrack(track) {
  const trackName = track.name || '';
  const artist = track.artist || '';
  const existingGenres = track.genres || [];

  const prompt = buildGenrePrompt(trackName, artist, existingGenres);
  const raw = await ollamaGenerate(prompt);
  const result = parseResponse(raw);

  return result;
}
