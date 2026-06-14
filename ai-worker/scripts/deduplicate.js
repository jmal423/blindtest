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
  const { rows } = await pool.query('SELECT id, name, artist, rank, already_verified FROM songs_cache');
  
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

const dryRun = process.argv.includes('--dry-run');

async function getExistingTables(dbPool) {
  const { rows } = await dbPool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  return new Set(rows.map(r => r.table_name));
}

async function applyDeduplication(dbPool, tables, keepId, deleteIds) {
  for (const delId of deleteIds) {
    // 1. Update songs_played if it exists
    if (tables.has('songs_played')) {
      await dbPool.query('UPDATE songs_played SET song_id = $1 WHERE song_id = $2', [keepId, delId]);
    }
    
    // 2. Update round_results if it exists
    if (tables.has('round_results')) {
      await dbPool.query('UPDATE round_results SET track_id = $1 WHERE track_id = $2', [keepId, delId]);
    }
    
    // 3. Handle curated_songs if it exists
    if (tables.has('curated_songs')) {
      // Check if keepId exists in curated_songs
      const { rows: keepRows } = await dbPool.query('SELECT 1 FROM curated_songs WHERE id = $1', [keepId]);
      const keepExists = keepRows.length > 0;
      
      // Check if delId exists in curated_songs
      const { rows: delRows } = await dbPool.query('SELECT 1 FROM curated_songs WHERE id = $1', [delId]);
      const delExists = delRows.length > 0;
      
      if (delExists) {
        if (!keepExists) {
          // Rename delId to keepId
          await dbPool.query('UPDATE curated_songs SET id = $1 WHERE id = $2', [keepId, delId]);
          console.log(`   [DB] Updated curated_songs: ID ${delId} -> ${keepId}`);
        } else {
          // Delete delId since keepId already exists in curated_songs
          await dbPool.query('DELETE FROM curated_songs WHERE id = $1', [delId]);
          console.log(`   [DB] Deleted duplicate from curated_songs: ${delId}`);
        }
      }
    }
    
    // 4. Delete from songs_cache
    if (tables.has('songs_cache')) {
      await dbPool.query('DELETE FROM songs_cache WHERE id = $1', [delId]);
    }
  }
}

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';

async function main() {
  let remotePool = null;
  try {
    if (dryRun) {
      console.log('=== DRY-RUN MODE ACTIVE: No database modifications will be executed ===');
    } else {
      try {
        const tempPool = new pg.Pool({
          connectionString: REMOTE_DATABASE_URL,
          max: 3,
          connectionTimeoutMillis: 3000,
        });
        const client = await tempPool.connect();
        client.release();
        remotePool = tempPool;
        console.log(`[DB] Connected to remote database: ${REMOTE_DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
      } catch (err) {
        console.warn(`[DB] Remote database not reachable (${err.message}). Skipping remote propagation.`);
      }
    }

    console.log('[Start] Checking for duplicate tracks in songs_cache...');
    const duplicateGroups = await getDuplicateGroups();
    
    console.log(`[Start] Found ${duplicateGroups.length} potential duplicate song groups.`);
    if (duplicateGroups.length === 0) {
      console.log('No duplicates found. Database is already clean! ✓');
      process.exit(0);
    }
    
    const deduplicateActions = [];
    const idsToVerify = [];
    let processed = 0;
    
    for (const group of duplicateGroups) {
      processed++;
      console.log(`[Processing ${processed}/${duplicateGroups.length}] Artist: ${group.artist} - "${group.tracks[0].name}"...`);
      
      // Check if there is already a verified track in the group
      const verifiedTracks = group.tracks.filter(t => t.already_verified);
      
      let keepId = null;
      let deleteIds = [];
      let usedLLM = false;

      if (verifiedTracks.length > 0) {
        // We have at least one verified track!
        // If there are multiple (edge case), pick the one with highest rank
        verifiedTracks.sort((a, b) => (b.rank || 0) - (a.rank || 0));
        const keptTrack = verifiedTracks[0];
        keepId = keptTrack.id;
        
        // Delete all other tracks in the group
        deleteIds = group.tracks.filter(t => t.id !== keepId).map(t => t.id);
        console.log(`   -> Bypassed Ollama (already verified song: "${keptTrack.name}" [ID: ${keepId}])`);
      } else {
        // No verified track, ask Ollama
        try {
          const result = await askOllamaToDeduplicate(group.artist, group.tracks);
          usedLLM = true;
          
          // Validate LLM output
          const validTrackIds = new Set(group.tracks.map(t => t.id));
          
          if (!result.keepId || !validTrackIds.has(result.keepId)) {
            console.error(`   [Error] LLM returned invalid keepId "${result.keepId}". Skipping group.`);
            continue;
          }
          
          keepId = result.keepId;
          
          // Filter deleteIds to only include valid IDs in the group and exclude keepId
          const rawDeleteIds = Array.isArray(result.deleteIds) ? result.deleteIds : [];
          deleteIds = rawDeleteIds.filter(id => validTrackIds.has(id) && id !== keepId);
          
          if (deleteIds.length === 0) {
            console.warn(`   [Warning] LLM did not suggest any valid duplicate IDs to delete. Skipping group.`);
            continue;
          }
          
          // Double safety: make sure we are not deleting everything
          if (deleteIds.length >= group.tracks.length) {
            console.error(`   [Error] LLM suggested deleting all tracks in the group. Skipping group.`);
            continue;
          }
        } catch (err) {
          console.error(`   [Error] Failed to process group via Ollama: ${err.message}`);
          continue;
        }
      }
      
      const keptTrackName = group.tracks.find(t => t.id === keepId)?.name;
      console.log(`   -> KEEP: "${keptTrackName}" [ID: ${keepId}]`);
      
      for (const delId of deleteIds) {
        const trackName = group.tracks.find(t => t.id === delId)?.name;
        console.log(`   -> DELETE: "${trackName}" [ID: ${delId}]`);
      }
      
      deduplicateActions.push({ keepId, deleteIds });
      
      // If we used the LLM, we should mark the kept track as verified in the DB
      if (usedLLM) {
        idsToVerify.push(keepId);
      }
    }
    
    // Perform verification updates in DB (local only, since sync-push handles remote)
    if (idsToVerify.length > 0) {
      if (dryRun) {
        console.log(`[Dry-Run] Would mark ${idsToVerify.length} tracks as already_verified=true in database.`);
      } else {
        console.log(`[DB] Marking ${idsToVerify.length} kept tracks as verified in songs_cache...`);
        // Check if synced_at exists in songs_cache
        const { rows: columns } = await pool.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'songs_cache' AND column_name = 'synced_at'
        `);
        const hasSyncedAt = columns.length > 0;
        const queryText = hasSyncedAt
          ? `UPDATE songs_cache SET already_verified = TRUE, synced_at = NULL WHERE id = ANY($1::text[])`
          : `UPDATE songs_cache SET already_verified = TRUE WHERE id = ANY($1::text[])`;

        // Update in batches of 50
        const batchSize = 50;
        for (let i = 0; i < idsToVerify.length; i += batchSize) {
          const batch = idsToVerify.slice(i, i + batchSize);
          await pool.query(queryText, [batch]);
        }
        console.log(`[DB] Successfully verified ${idsToVerify.length} tracks!`);
      }
    }
    
    // Perform updates and deletions in DB
    if (deduplicateActions.length > 0) {
      if (dryRun) {
        console.log(`[Dry-Run] Would apply deduplication for ${deduplicateActions.length} groups.`);
      } else {
        const localTables = await getExistingTables(pool);
        let remoteTables = null;
        if (remotePool) {
          remoteTables = await getExistingTables(remotePool);
        }
        
        console.log(`[DB] Applying deduplication updates and deletions...`);
        for (const action of deduplicateActions) {
          // Apply locally
          await applyDeduplication(pool, localTables, action.keepId, action.deleteIds);
          
          // Apply remotely if available
          if (remotePool && remoteTables) {
            await applyDeduplication(remotePool, remoteTables, action.keepId, action.deleteIds);
          }
        }
        console.log(`[DB] Successfully cleaned up duplicate tracks! ✓`);
      }
    } else {
      console.log('[DB] No tracks marked for deletion.');
    }
    
  } catch (err) {
    console.error('[Error]', err);
  } finally {
    await pool.end();
    if (remotePool) {
      await remotePool.end();
    }
  }
}

main();
