import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const REMOTE_URL = process.env.REMOTE_DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest';

const local = new pg.Pool({ connectionString: LOCAL_URL, max: 5 });
const remote = new pg.Pool({ connectionString: REMOTE_URL, max: 3 });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '200', 10);
const AI_COLS = ['ai_genres', 'ai_tags', 'ai_audio_genres', 'ai_confidence', 'ai_processed_at', 'ai_version', 'already_verified'];

async function getUnsyncedCount() {
  const { rows } = await local.query(`
    SELECT COUNT(*) as count FROM songs_cache
    WHERE ai_processed_at IS NOT NULL
      AND (synced_at IS NULL OR synced_at < ai_processed_at)
  `);
  return parseInt(rows[0].count, 10);
}

async function pullUnsyncedBatch() {
  const { rows } = await local.query(`
    SELECT id, ${AI_COLS.join(', ')} FROM songs_cache
    WHERE ai_processed_at IS NOT NULL
      AND (synced_at IS NULL OR synced_at < ai_processed_at)
    ORDER BY ai_processed_at DESC
    LIMIT $1
  `, [BATCH_SIZE]);
  return rows;
}

async function pushToRemote(rows) {
  if (rows.length === 0) return;
  const client = await remote.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(`
        UPDATE songs_cache
        SET ai_genres = $1::jsonb,
            ai_tags = $2::jsonb,
            ai_audio_genres = $3::jsonb,
            ai_confidence = $4::jsonb,
            ai_processed_at = $5,
            ai_version = $6,
            already_verified = $7
        WHERE id = $8
      `, [
        JSON.stringify(row.ai_genres || []),
        JSON.stringify(row.ai_tags || []),
        JSON.stringify(row.ai_audio_genres || []),
        JSON.stringify(row.ai_confidence || {}),
        row.ai_processed_at,
        row.ai_version,
        row.already_verified,
        row.id,
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markSynced(ids) {
  if (ids.length === 0) return;
  await local.query(
    `UPDATE songs_cache SET synced_at = NOW() WHERE id = ANY($1::text[])`,
    [ids]
  );
}

console.log(`[Sync-Push] Local → Remote`);
console.log(`[Sync-Push] Remote: ${REMOTE_URL.replace(/\/\/.*@/, '//***@')}`);

const total = await getUnsyncedCount();
console.log(`[Sync-Push] ${total} unsynced AI results to push`);

let pushed = 0;
while (true) {
  const rows = await pullUnsyncedBatch();
  if (rows.length === 0) break;
  await pushToRemote(rows);
  const ids = rows.map(r => r.id);
  await markSynced(ids);
  pushed += rows.length;
  console.log(`[Sync-Push] Progress: ${pushed}/${total}`);
}

await local.end();
await remote.end();
console.log(`[Sync-Push] Done — ${pushed} tracks pushed`);
