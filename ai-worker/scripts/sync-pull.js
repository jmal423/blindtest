import pg from 'pg';

const REMOTE_URL = process.env.REMOTE_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';

const remote = new pg.Pool({ connectionString: REMOTE_URL, max: 3 });
const local = new pg.Pool({ connectionString: LOCAL_URL, max: 5 });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const COLS = ['id', 'name', 'artist', 'album_image', 'preview_url', 'duration_ms', 'genre', 'rank', 'source', 'fetched_at', 'genres', 'chart_source', 'ai_genres', 'ai_tags', 'ai_audio_genres', 'ai_confidence', 'ai_processed_at', 'ai_version'];

async function getSyncWatermarks() {
  const { rows } = await local.query(`
    SELECT
      MAX(fetched_at) as max_fetched,
      MAX(ai_processed_at) as max_ai_processed,
      MAX(synced_at) as max_synced
    FROM songs_cache
  `);
  return rows[0] || {};
}

async function getRemoteChanges(watermark, limit, offset) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (watermark.max_fetched) {
    conditions.push(`fetched_at > $${idx++}`);
    params.push(watermark.max_fetched);
  }
  if (watermark.max_ai_processed) {
    conditions.push(`(ai_processed_at IS NOT NULL AND ai_processed_at > $${idx++})`);
    params.push(watermark.max_ai_processed);
  }

  const where = conditions.length > 0 ? conditions.join(' OR ') : 'TRUE';
  const { rows } = await remote.query(
    `SELECT ${COLS.join(', ')} FROM songs_cache WHERE ${where} ORDER BY fetched_at DESC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
  return rows;
}

async function getNewIdsFromRemote(localIds, limit, offset) {
  if (localIds.length === 0) {
    return getRemoteChanges({}, limit, offset);
  }
  const { rows } = await remote.query(
    `SELECT ${COLS.join(', ')} FROM songs_cache
     WHERE id != ALL($1::text[])
     ORDER BY fetched_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [localIds, limit, offset]
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
  const updates = COLS.map(c => c === 'id' ? null : `${c} = EXCLUDED.${c}`).filter(Boolean).join(', ');

  await local.query(
    `INSERT INTO songs_cache (${cols}) VALUES ${placeholders}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values
  );
}

console.log(`[Sync-Pull] Remote → Local`);

const watermark = await getSyncWatermarks();
console.log(`[Sync-Pull] Local watermark: fetched ≤ ${watermark.max_fetched ? watermark.max_fetched.toISOString().split('.')[0].replace('T', ' ') : 'never'}`);

// Phase 1: pull changed/updated tracks (by timestamp)
let pulled = 0;
let offset = 0;
while (true) {
  const rows = await getRemoteChanges(watermark, BATCH_SIZE, offset);
  if (rows.length === 0) break;
  await upsertLocal(rows);
  pulled += rows.length;
  offset += BATCH_SIZE;
}

// Phase 2: pull any tracks missing locally (edge case: timestamps might not catch everything)
const localIds = (await local.query('SELECT array_agg(id) as ids FROM songs_cache')).rows[0]?.ids || [];
const remoteTotal = parseInt((await remote.query('SELECT COUNT(*) as c FROM songs_cache')).rows[0].c, 10);

if (localIds.length < remoteTotal) {
  let missOffset = 0;
  while (true) {
    const rows = await getNewIdsFromRemote(localIds, BATCH_SIZE, missOffset);
    if (rows.length === 0) break;
    await upsertLocal(rows);
    pulled += rows.length;
    missOffset += BATCH_SIZE;
  }
}

await remote.end();
await local.end();
console.log(`[Sync-Pull] Done — ${pulled} new/updated tracks synced`);
