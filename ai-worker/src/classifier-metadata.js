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
      options: { temperature: 0.0 }, // <- CORRIGIDO: Forçar 0.0 para determinismo absoluto
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response;
}

const VALID_GENRES = new Set([
  "PT_fado", "PT_tradicional_folklore_pimba", "PT_pop_tuga", "PT_pop_rock_tuga", "PT_hip_hop_tuga",
  "PT_classica_tuga", "PT_kizomba_palop", "PT_pop_urbano_nova_pop", "US_pop_us", "US_hip_hop_trap_us",
  "US_country_americana_us", "US_rock_alternative_us", "UK_pop_uk", "UK_uk_drill_grime", "UK_britpop_rock_uk",
  "UK_uk_garage_dnb", "FR_chanson_francaise", "FR_pop_francaise", "FR_rap_francais", "FR_french_touch_electro",
  "ES_flamenco", "ES_reggaeton_urbano", "ES_musica_regional_latina", "BR_samba_pagode", "BR_bossa_nova",
  "BR_funk_brasileiro", "GL_reggae", "GL_kpop", "BR_pop_rock_brasileiro", "BR_pop", "GL_edm_dance", "GL_afrobeats_african",
  "GL_metal", "GL_soundtracks", "GL_jazz_lounge", "GL_other"
]);

const VALID_REGIONS = new Set([
  "portuguese", "brazilian", "united_states", "united_kingdom", "french", "spanish", "global_other"
]);

const GENRE_TO_REGION = {
  "PT_fado": "portuguese", "PT_tradicional_folklore_pimba": "portuguese", "PT_pop_tuga": "portuguese", "PT_pop_rock_tuga": "portuguese",
  "PT_hip_hop_tuga": "portuguese", "PT_classica_tuga": "portuguese", "PT_kizomba_palop": "portuguese", "PT_pop_urbano_nova_pop": "portuguese",
  "BR_samba_pagode": "brazilian", "BR_bossa_nova": "brazilian", "BR_funk_brasileiro": "brazilian", "BR_pop_rock_brasileiro": "brazilian", "BR_pop": "brazilian",
  "US_pop_us": "united_states", "US_hip_hop_trap_us": "united_states", "US_country_americana_us": "united_states", "US_rock_alternative_us": "united_states",
  "UK_pop_uk": "united_kingdom", "UK_uk_drill_grime": "united_kingdom", "UK_britpop_rock_uk": "united_kingdom", "UK_uk_garage_dnb": "united_kingdom",
  "FR_chanson_francaise": "french", "FR_pop_francaise": "french", "FR_rap_francais": "french", "FR_french_touch_electro": "french",
  "ES_flamenco": "spanish", "ES_reggaeton_urbano": "spanish", "ES_musica_regional_latina": "spanish",
  "GL_reggae": "global_other", "GL_kpop": "global_other", "GL_edm_dance": "global_other", "GL_afrobeats_african": "global_other",
  "GL_metal": "global_other", "GL_soundtracks": "global_other", "GL_jazz_lounge": "global_other", "GL_other": "global_other"
};

function parseResponse(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
    try { parsed = JSON.parse(stripped); } catch {}
  }

  if (!parsed) {
    throw new Error(`Failed to parse LLM response: ${raw.slice(0, 200)}`);
  }

  let genreId = null;
  let confidence = 0;

  if (parsed.mapped_genre_id) {
    genreId = parsed.mapped_genre_id.trim();
    confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  } else if (parsed.genre) {
    genreId = parsed.genre.trim();
    confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  } else {
    throw new Error(`No genre in response: ${raw.slice(0, 200)}`);
  }

  // Fix casing
  if (genreId.length > 3 && genreId[2] === '_') {
    genreId = genreId.substring(0, 2).toUpperCase() + genreId.substring(2).toLowerCase();
  } else {
    genreId = genreId.toLowerCase();
  }

  if (!VALID_GENRES.has(genreId)) {
    console.warn(`[AI] LLM returned invalid genre_id "${genreId}" (conf: ${confidence}). Falling back to "other".`);
    genreId = 'other';
    confidence = Math.min(confidence, 0.3);
  }

  const region = GENRE_TO_REGION[genreId] || 'global_other';

  return {
    genres: [genreId],
    tags: [region],
    primary: genreId,
    confidence: { [genreId]: confidence },
    confidenceScore: confidence,
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
