import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyTrack } from '../src/classifier-metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const LOCAL_URL = process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';
const REMOTE_URL = 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';

const localPool = new pg.Pool({ connectionString: LOCAL_URL });
const remotePool = new pg.Pool({ connectionString: REMOTE_URL });

async function processOne(artist, name) {
  console.log(`\n--- Classifying: ${artist} - ${name} ---`);
  
  // Find in local
  const { rows } = await localPool.query(
    'SELECT id, artist, name, genres FROM songs_cache WHERE artist = $1 AND name = $2',
    [artist, name]
  );
  
  if (rows.length === 0) {
    console.log(`Track not found in local database.`);
    return;
  }
  
  const track = rows[0];
  if ((track.artist === 'Kalash' && track.name === 'Doliprane') ||
      (track.artist === 'ROSALÍA' && track.name === 'Berghain')) {
    track.genres = [];
  }
  const result = await classifyTrack(track);
  console.log('Result:', result);
  
  // Update local
  await localPool.query(
    `UPDATE songs_cache 
     SET ai_genres = $1::jsonb, 
         ai_tags = $2::jsonb, 
         ai_confidence = $3::jsonb, 
         ai_processed_at = NOW(), 
         ai_version = $4 
     WHERE id = $5`,
    [
      JSON.stringify(result.genres),
      JSON.stringify(result.tags),
      JSON.stringify(result.confidence),
      'llama3-8b-v4',
      track.id
    ]
  );
  console.log('Updated in Local DB ✓');

  // Update remote
  try {
    const { rowCount } = await remotePool.query(
      `UPDATE songs_cache 
       SET ai_genres = $1::jsonb, 
           ai_tags = $2::jsonb, 
           ai_confidence = $3::jsonb, 
           ai_processed_at = NOW(), 
           ai_version = $4 
       WHERE id = $5`,
      [
        JSON.stringify(result.genres),
        JSON.stringify(result.tags),
        JSON.stringify(result.confidence),
        'llama3-8b-v4',
        track.id
      ]
    );
    if (rowCount > 0) {
      console.log('Updated in Remote DB ✓');
    } else {
      console.log('Track not found in Remote DB.');
    }
  } catch (err) {
    console.log('Failed to update remote DB: ', err.message);
  }
}

async function main() {
  await processOne('ROSALÍA', 'Berghain');
  await processOne('Kalash', 'Doliprane');
  
  await localPool.end();
  await remotePool.end();
}

main();
