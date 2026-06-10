import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// Normalize titles to find potential duplicate groups
function getNormalizationKey(title) {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')      // Remove (Remastered), (Live), (Radio Edit)
    .replace(/\[.*?\]/g, '')      // Remove [Live]
    .replace(/\s*-\s*.*$/g, '')    // Remove anything after a dash (e.g., - 2011 Remaster)
    .replace(/[^a-z0-9]/g, '')    // Strip non-alphanumeric characters
    .trim();
}

async function getDuplicateGroups() {
  const { rows } = await pool.query('SELECT id, name, artist, rank FROM songs_cache');
  
  // Group by artist and normalized title
  const groups = {};
  
  for (const track of rows) {
    const artistKey = track.artist.toLowerCase().trim();
    const titleKey = getNormalizationKey(track.name);
    
    if (!titleKey) continue;
    
    const key = `${artistKey}::${titleKey}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(track);
  }
  
  // Filter only groups with more than 1 track (actual duplicates)
  return Object.entries(groups)
    .filter(([_, tracks]) => tracks.length > 1)
    .map(([key, tracks]) => ({
      key,
      artist: tracks[0].artist,
      tracks
    }));
}

async function askOllamaToDeduplicate(artist, tracks) {
  const prompt = `
You are a music librarian. We have duplicate versions of the same song by the artist "${artist}" in our database for a music guessing game.
We only want to keep the single best, original studio version of this song, and delete any alternate versions (such as remasters, live recordings, radio edits, acoustic versions, or deluxe edits).

Here is the list of duplicates:
${JSON.stringify(tracks.map(t => ({ id: t.id, name: t.name, rank: t.rank })), null, 2)}

Instructions:
1. Select the ID of the single best version to KEEP (usually the original/studio version, often having the cleanest title or higher rank).
2. List the IDs of all the duplicate versions to DELETE.

Return a JSON object with this exact format:
{
  "keepId": "id_to_keep",
  "deleteIds": ["id_to_delete_1", "id_to_delete_2", ...]
}
`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`);
  }

  const data = await res.json();
  return JSON.parse(data.response);
}

async function main() {
  try {
    console.log('[Start] Checking for duplicate tracks in songs_cache...');
    const duplicateGroups = await getDuplicateGroups();
    
    console.log(`[Start] Found ${duplicateGroups.length} potential duplicate song groups.`);
    if (duplicateGroups.length === 0) {
      console.log('No duplicates found. Database is already clean! ✓');
      process.exit(0);
    }
    
    const allDeletedIds = [];
    let processed = 0;
    
    for (const group of duplicateGroups) {
      processed++;
      console.log(`[Processing ${processed}/${duplicateGroups.length}] Artist: ${group.artist} - "${group.tracks[0].name}"...`);
      
      try {
        const result = await askOllamaToDeduplicate(group.artist, group.tracks);
        
        console.log(`   -> KEEP: "${group.tracks.find(t => t.id === result.keepId)?.name || result.keepId}"`);
        for (const delId of result.deleteIds) {
          const trackName = group.tracks.find(t => t.id === delId)?.name;
          console.log(`   -> DELETE: "${trackName || delId}"`);
          allDeletedIds.push(delId);
        }
      } catch (err) {
        console.error(`   [Error] Failed to process group: ${err.message}`);
      }
    }
    
    if (allDeletedIds.length > 0) {
      console.log(`[DB] Deleting ${allDeletedIds.length} duplicate tracks from songs_cache...`);
      // Delete in batches of 50
      const batchSize = 50;
      for (let i = 0; i < allDeletedIds.length; i += batchSize) {
        const batch = allDeletedIds.slice(i, i + batchSize);
        await pool.query('DELETE FROM songs_cache WHERE id = ANY($1)', [batch]);
      }
      console.log(`[DB] Successfully cleaned up ${allDeletedIds.length} duplicate tracks! ✓`);
    } else {
      console.log('[DB] No tracks marked for deletion.');
    }
    
  } catch (err) {
    console.error('[Error]', err.message);
  } finally {
    await pool.end();
  }
}

main();
