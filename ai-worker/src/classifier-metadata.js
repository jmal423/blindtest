import { config } from './config.js';
import { GENRES, buildGenrePrompt } from './genres.js';

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

function parseResponse(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
    try { parsed = JSON.parse(stripped); } catch {}
  }

  if (!parsed || !Array.isArray(parsed.genres) || parsed.genres.length === 0) {
    throw new Error(`Failed to parse LLM response: ${raw.slice(0, 200)}`);
  }

  const validGenres = parsed.genres.filter(g => GENRES.includes(g));
  if (validGenres.length === 0) {
    throw new Error(`LLM returned no valid genres: ${parsed.genres.join(', ')}`);
  }

  const primary = Array.isArray(parsed.primary) ? parsed.primary[0] : parsed.primary;
  const resolvedPrimary = primary && GENRES.includes(primary) ? primary : validGenres[0];

  let confidence = {};
  if (parsed.confidence && typeof parsed.confidence === 'object' && !Array.isArray(parsed.confidence)) {
    const hasValid = validGenres.some(g => typeof parsed.confidence[g] === 'number');
    if (hasValid) confidence = parsed.confidence;
  }
  if (Object.keys(confidence).length === 0) {
    const perGenre = 1.0 / validGenres.length;
    for (const g of validGenres) {
      confidence[g] = g === resolvedPrimary ? Math.min(1, perGenre + 0.2) : perGenre;
    }
  }

  return {
    genres: validGenres,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    primary: resolvedPrimary,
    confidence,
  };
}

export async function classifyTrack(track) {
  const trackName = track.name || '';
  const artist = track.artist || '';
  const existingGenres = track.genres || [];

  const prompt = buildGenrePrompt(trackName, artist);
  const raw = await ollamaGenerate(prompt);
  const result = parseResponse(raw);

  if (existingGenres.length > 0) {
    const boosted = new Set([...existingGenres, ...result.genres]);
    for (const g of existingGenres) {
      result.confidence[g] = Math.max(result.confidence[g] || 0, 0.7);
    }
    result.genres = [...boosted];
  }

  return result;
}
