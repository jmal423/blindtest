import pg from 'pg';

const REMOTE_URL = process.env.REMOTE_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';

const remote = new pg.Pool({ connectionString: REMOTE_URL, max: 3 });
const local = new pg.Pool({ connectionString: LOCAL_URL, max: 5 });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const COLS = ['id', 'name', 'artist', 'album_image', 'preview_url', 'duration_ms', 'genre', 'rank', 'source', 'fetched_at', 'genres', 'chart_source', 'ai_genres', 'ai_tags', 'ai_audio_genres', 'ai_confidence', 'ai_processed_at', 'ai_version'];

async function getRemoteCount() {
  const { rows } = await remote.query('SELECT COUNT(*) as count FROM songs_cache');
  return parseInt(rows[0].count, 10);
}

async function getLocalIds() {
  const { rows } = await local.query('SELECT id FROM songs_cache');
  return new Set(rows.map(r => r.id));
}

async function pullBatch(offset) {
  const { rows } = await remote.query(
    `SELECT ${COLS.join(', ')} FROM songs_cache ORDER BY fetched_at DESC LIMIT $1 OFFSET $2`,
    [BATCH_SIZE, offset]
  );
  return rows;
}

async function upsertLocal(rows) {
  if (rows.length === 0) return;
  const placeholders = rows.map((_, i) => {
    const base = i * COLS.length + 1;
    return `(${COLS.map((_, j) => `$${base + j}`).join(', ')})`;
  }).join(', ');

  const values = rows.flatMap(r => COLS.map(c => {
    const v = r[c];
    if (c === 'genres' || c === 'ai_genres' || c === 'ai_tags' || c === 'ai_audio_genres' || c === 'ai_confidence') {
      return typeof v === 'string' ? v : JSON.stringify(v || []);
    }
    return v ?? null;
  }));

  const cols = COLS.join(', ');
  const updates = COLS.map(c => {
    if (c === 'id') return null;
    return `${c} = EXCLUDED.${c}`;
  }).filter(Boolean).join(', ');

  await local.query(
    `INSERT INTO songs_cache (${cols}) VALUES ${placeholders}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values
  );
}

console.log(`[Sync-Pull] Remote: ${REMOTE_URL.replace(/\/\/.*@/, '//***@')}`);
console.log(`[Sync-Pull] Local: ${LOCAL_URL.replace(/\/\/.*@/, '//***@')}`);

const total = await getRemoteCount();
console.log(`[Sync-Pull] Remote has ${total} tracks`);

const localIds = await getLocalIds();
console.log(`[Sync-Pull] Local has ${localIds.size} tracks, need ${total - localIds.size} more`);

let pulled = 0;
for (let offset = 0; offset < total; offset += BATCH_SIZE) {
  const rows = await pullBatch(offset);
  await upsertLocal(rows);
  pulled += rows.length;
  console.log(`[Sync-Pull] Progress: ${pulled}/${total}`);
}

await remote.end();
await local.end();
console.log(`[Sync-Pull] Done — ${pulled} tracks synced`);
