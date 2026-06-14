import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';
const OUTPUT_FILE = path.join(__dirname, '../../backend/src/artist-groups.json');

const pool = new pg.Pool({ connectionString: DB_URL });

async function ollamaGenerate(prompt) {
  const url = `${OLLAMA_URL}/api/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.2 }, // A bit of creativity for grouping
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response;
}

async function run() {
  console.log(`[AI] Fetching all distinct artists from DB...`);
  const { rows } = await pool.query('SELECT artist, played_count FROM curated_songs ORDER BY played_count DESC, artist ASC LIMIT 150');
  const artists = rows.map(r => r.artist).filter(Boolean);
  
  if (artists.length === 0) {
    console.log(`[AI] No artists found in DB.`);
    process.exit(0);
  }

  console.log(`[AI] Found ${artists.length} artists. Sending to LLM to categorize...`);
  
  const prompt = `
You are an expert music curator AI.
Below is a list of ${artists.length} artists.
Group them into 10-15 fun and engaging categories/playlists. 
Each category should have an id, a fun display name, and a list of exact artist strings that fit into it.
Put every single artist into at least one category! (It is okay if an artist fits in multiple).

Respond with a raw JSON array of objects, using this exact schema:
[
  {
    "id": "french_rap_legends",
    "name": "French Rap Legends",
    "artists": ["Booba", "Ninho", ...]
  },
  {
    "id": "2000s_pop_queens",
    "name": "2000s Pop Queens",
    "artists": ["Britney Spears", "Lady Gaga", ...]
  }
]

List of artists:
${artists.join('\n')}
  `;

  try {
    const raw = await ollamaGenerate(prompt);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const stripped = raw.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
      parsed = JSON.parse(stripped);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("LLM did not return a JSON array");
    }

    console.log(`[AI] Successfully generated ${parsed.length} artist groups!`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    console.log(`[AI] Saved groups to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error(`[AI] Failed to generate artist groups:`, err);
  } finally {
    pool.end();
  }
}

run();
