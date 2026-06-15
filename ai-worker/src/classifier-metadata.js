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
      options: { temperature: 0.0 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response;
}

const VALID_GENRES = new Set([
  "UNCLASSIFIED",
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
  "UNCLASSIFIED": "global_other",
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

const DEEZER_GENRE_MAP = {
  'rap-francais': 'FR_rap_francais', 'french rap': 'FR_rap_francais', 'rap francais': 'FR_rap_francais',
  'rap français': 'FR_rap_francais', 'french hip hop': 'FR_rap_francais', 'french hip-hop': 'FR_rap_francais',
  'chanson-francaise': 'FR_chanson_francaise', 'chanson française': 'FR_chanson_francaise', 'variété française': 'FR_chanson_francaise',
  'pop-francaise': 'FR_pop_francaise', 'pop française': 'FR_pop_francaise',
  'french touch': 'FR_french_touch_electro', 'french electro': 'FR_french_touch_electro',
  'fado': 'PT_fado', 'fado-portuguese': 'PT_fado',
  'kizomba': 'PT_kizomba_palop', 'kuduro': 'PT_kizomba_palop', 'semba': 'PT_kizomba_palop',
  'pimba': 'PT_tradicional_folklore_pimba', 'folklore portuguese': 'PT_tradicional_folklore_pimba', 'popular portuguese': 'PT_tradicional_folklore_pimba',
  'hip hop tuga': 'PT_hip_hop_tuga', 'rap tuga': 'PT_hip_hop_tuga', 'hip-hop tuga': 'PT_hip_hop_tuga',
  'funk-brasileiro': 'BR_funk_brasileiro', 'funk brasileiro': 'BR_funk_brasileiro', 'baile funk': 'BR_funk_brasileiro', 'funk carioca': 'BR_funk_brasileiro',
  'samba': 'BR_samba_pagode', 'pagode': 'BR_samba_pagode',
  'bossa-nova': 'BR_bossa_nova', 'bossa nova': 'BR_bossa_nova', 'mpb': 'BR_bossa_nova',
  'sertanejo': 'BR_pop', 'sertanejo pop': 'BR_pop',
  'k-pop': 'GL_kpop', 'kpop': 'GL_kpop', 'k pop': 'GL_kpop',
  'metal': 'GL_metal', 'heavy metal': 'GL_metal', 'metalcore': 'GL_metal',
  'soundtrack': 'GL_soundtracks', 'musique de film': 'GL_soundtracks', 'score': 'GL_soundtracks', 'film score': 'GL_soundtracks',
  'jazz': 'GL_jazz_lounge', 'lounge': 'GL_jazz_lounge',
  'reggae': 'GL_reggae', 'ska': 'GL_reggae',
  'dancehall': 'GL_reggae',
  'afrobeat': 'GL_afrobeats_african', 'afrobeats': 'GL_afrobeats_african', 'african': 'GL_afrobeats_african', 'musique-africaine': 'GL_afrobeats_african',
  'dance': 'GL_edm_dance', 'edm': 'GL_edm_dance', 'electro': 'GL_edm_dance', 'house': 'GL_edm_dance', 'techno': 'GL_edm_dance', 'trance': 'GL_edm_dance', 'drum and bass': 'GL_edm_dance', 'dnb': 'GL_edm_dance', 'electronic': 'GL_edm_dance',
  'rap': 'US_hip_hop_trap_us', 'hip-hop': 'US_hip_hop_trap_us', 'hip hop': 'US_hip_hop_trap_us', 'trap': 'US_hip_hop_trap_us',
  'country': 'US_country_americana_us', 'americana': 'US_country_americana_us',
  'rock': 'US_rock_alternative_us', 'classic rock': 'US_rock_alternative_us', 'alternative': 'US_rock_alternative_us', 'indie': 'US_rock_alternative_us',
  'pop': null,
};

function confidenceFromOutput(raw, matchedGenre) {
  let matchCount = 0;
  let firstMatchIdx = Infinity;

  for (const g of VALID_GENRES) {
    if (g === 'UNCLASSIFIED') continue;
    const idx = raw.indexOf(g);
    if (idx !== -1) {
      matchCount++;
      if (idx < firstMatchIdx) firstMatchIdx = idx;
    }
  }

  let conf = 0.5;

  if (firstMatchIdx === 0) conf = 0.90;
  else if (firstMatchIdx < 10) conf = 0.80;
  else if (firstMatchIdx < 30) conf = 0.65;
  else conf = 0.50;

  if (matchCount > 6) conf -= 0.10;

  if (matchedGenre === 'other' || matchedGenre === 'GL_other') {
    conf = Math.min(conf, 0.30);
  }

  return Math.max(0, Math.min(1, conf));
}

function unclassifiedResult() {
  return {
    genres: ['UNCLASSIFIED'],
    tags: ['global_other'],
    primary: 'UNCLASSIFIED',
    confidence: { UNCLASSIFIED: 0 },
    confidenceScore: 0,
  };
}

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

  if (genreId === 'UNCLASSIFIED') {
    return unclassifiedResult();
  }

  if (genreId.length > 3 && genreId[2] === '_') {
    genreId = genreId.substring(0, 2).toUpperCase() + genreId.substring(2).toLowerCase();
  } else {
    genreId = genreId.toLowerCase();
  }

  if (!VALID_GENRES.has(genreId)) {
    console.warn(`[AI] LLM returned invalid genre_id "${genreId}" (conf: ${confidence}). Falling back to UNCLASSIFIED.`);
    return unclassifiedResult();
  }

  if (confidence < 0.60) {
    console.warn(`[AI] Low confidence (${confidence}) for "${genreId}" — marking UNCLASSIFIED.`);
    return unclassifiedResult();
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

function buildPromptWithDeezer(name, artist, genres) {
  let prompt = `Track: "${name}" by ${artist}\n`;
  if (genres && genres.length > 0) {
    const tags = genres.filter(Boolean).join(', ');
    if (tags) prompt += `Deezer tags: ${tags}\n`;
  }
  prompt += `Genre:`;
  return prompt;
}

function findDeezerOverride(existingGenres) {
  if (!existingGenres || !Array.isArray(existingGenres)) return null;
  for (const g of existingGenres) {
    const key = (g || '').toLowerCase().trim();
    const mapped = DEEZER_GENRE_MAP[key];
    if (mapped) return mapped;
  }
  return null;
}

export async function classifyTrack(track) {
  const trackName = track.name || '';
  const artist = track.artist || '';
  const existingGenres = track.genres || [];

  if (config.ollamaModel === 'blindtest-classifier' || config.ollamaModel.includes('classifier')) {
    return classifyWithFineTuned(trackName, artist, existingGenres);
  }

  const prompt = buildGenrePrompt(trackName, artist, existingGenres);
  const raw = await ollamaGenerate(prompt);
  const result = parseResponse(raw);

  return result;
}

async function classifyWithFineTuned(name, artist, existingGenres = []) {
  const prompt = buildPromptWithDeezer(name, artist, existingGenres);
  const res = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      stream: false,
      options: { temperature: 0.0, num_predict: 50 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  const raw = (data.response || '').trim();

  let genreId = 'other';
  for (const g of VALID_GENRES) {
    if (g === 'UNCLASSIFIED') continue;
    if (raw.startsWith(g)) {
      genreId = g;
      break;
    }
  }

  const deezerOverride = findDeezerOverride(existingGenres);
  if (deezerOverride) {
    genreId = deezerOverride;
  }

  const confidence = confidenceFromOutput(raw, genreId);

  if (confidence < 0.50) {
    return unclassifiedResult();
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
