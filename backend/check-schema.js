import { pool } from './src/db.js';

const { rows } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'songs_cache' ORDER BY ordinal_position");
console.log('songs_cache columns:');
rows.forEach(r => console.log(' ', r.column_name, '-', r.data_type));
process.exit(0);
