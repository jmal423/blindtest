import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest' });

// Count tracks that would appear in triage
const { rows } = await pool.query(`
  SELECT COUNT(*) as total FROM tracks t
  WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
     OR EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id AND c.genre_id = 'UNCLASSIFIED' ORDER BY c.created_at DESC LIMIT 1)
`);
console.log(`Triage queue: ${rows[0].total} tracks`);

// Count UNCLASSIFIED classifications
const { rows: u } = await pool.query(`
  SELECT COUNT(*) FROM classifications WHERE genre_id = 'UNCLASSIFIED'
`);
console.log(`UNCLASSIFIED classifications: ${u[0].count}`);

// Count tracks with NO classifications  
const { rows: n } = await pool.query(`
  SELECT COUNT(*) FROM tracks t WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
`);
console.log(`Tracks with zero classifications: ${n[0].count}`);

// Show sample of triage tracks
const { rows: sample } = await pool.query(`
  SELECT t.id, t.name, t.artist_name
  FROM tracks t
  WHERE NOT EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id)
     OR EXISTS (SELECT 1 FROM classifications c WHERE c.track_id = t.id AND c.genre_id = 'UNCLASSIFIED' ORDER BY c.created_at DESC LIMIT 1)
  LIMIT 5
`);
console.log('\nSample:');
for (const s of sample) console.log(`  ${s.name} - ${s.artist_name}`);

await pool.end();
