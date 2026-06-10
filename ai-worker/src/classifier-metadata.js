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
      options: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response;
}

function extractJson(raw) {
  const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {}
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

function parseResponse(raw) {
  const parsed = extractJson(raw);

  if (!parsed || !Array.isArray(parsed.genres) || parsed.genres.length === 0) {
    throw new Error(`Failed to parse LLM response: ${raw.slice(0, 200)}`);
  }

  let confidence = {};
  if (parsed.confidence && typeof parsed.confidence === 'object' && !Array.isArray(parsed.confidence)) {
    const hasValid = parsed.genres.some(g => typeof parsed.confidence[g] === 'number');
    if (hasValid) {
      confidence = parsed.confidence;
    }
  }
  if (Object.keys(confidence).length === 0) {
    const perGenre = 1.0 / parsed.genres.length;
    for (const g of parsed.genres) {
      confidence[g] = g === parsed.primary ? Math.min(1, perGenre + 0.2) : perGenre;
    }
  }

  return {
    genres: parsed.genres,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    primary: parsed.primary || parsed.genres[0],
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
