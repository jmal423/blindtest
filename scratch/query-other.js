import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Try to locate .env
if (fs.existsSync('./.env')) {
  dotenv.config({ path: './.env' });
} else if (fs.existsSync('../backend/.env')) {
  dotenv.config({ path: '../backend/.env' });
} else if (fs.existsSync('./backend/.env')) {
  dotenv.config({ path: './backend/.env' });
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest',
});

async function run() {
  try {
    console.log('Querying tracks in the "other" genre in curated_songs...');
    const { rows: curatedRows } = await pool.query(
      "SELECT id, name, artist, genre, album_genres FROM curated_songs WHERE genre = 'other' LIMIT 50"
    );
    
    console.log(`\nFound ${curatedRows.length} curated songs in 'other':`);
    console.table(curatedRows.map(r => ({
      ID: r.id,
      Name: r.name,
      Artist: r.artist,
      Genre: r.genre,
      'Album Genres': r.album_genres
    })));

    console.log('\nQuerying tracks in the "other" genre in songs_cache...');
    const { rows: cacheRows } = await pool.query(
      "SELECT id, name, artist, genre, genres, ai_genres, ai_tags FROM songs_cache WHERE genre = 'other' OR genres @> '[\"other\"]'::jsonb OR ai_genres @> '[\"other\"]'::jsonb LIMIT 50"
    );
    
    console.log(`\nFound ${cacheRows.length} cached songs with 'other' genre:`);
    console.table(cacheRows.map(r => ({
      ID: r.id,
      Name: r.name,
      Artist: r.artist,
      Genre: r.genre,
      Genres: JSON.stringify(r.genres),
      'AI Genres': JSON.stringify(r.ai_genres),
      'AI Tags': JSON.stringify(r.ai_tags)
    })));

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

run();
