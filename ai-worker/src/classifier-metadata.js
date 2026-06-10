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

  const genreId = parsed.mapped_genre_id.toLowerCase().trim();
  const region = (parsed.mapped_region || 'global_other').toLowerCase().trim();

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
