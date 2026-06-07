import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set.');
  console.error('[DB] For local dev: docker compose up -d');
  console.error('[DB] For production: set DATABASE_URL to your PostgreSQL connection string.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function connectWithRetry(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log(`[DB] PostgreSQL connected: ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error(`[DB] FATAL: Could not connect after ${retries} attempts.`);
        throw err;
      }
      console.log(`[DB] Connect attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delayMs / 1000}s...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

await connectWithRetry();

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const { rows: appliedRows } = await pool.query('SELECT name FROM _migrations ORDER BY name');
  const applied = new Set(appliedRows.map(r => r.name));

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const mod = await import(`./migrations/${file}`);
    const migration = mod.default;

    if (applied.has(migration.name)) {
      console.log(`[DB] Migration ${migration.name} already applied`);
      continue;
    }

    console.log(`[DB] Running migration: ${migration.name}`);

    const stmts = migration.up.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      await pool.query(stmt);
    }

    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
    console.log(`[DB] Migration ${migration.name} applied`);
  }
}

await runMigrations();

function generateId() {
  return crypto.randomUUID();
}

async function query(sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  return query(sql, params);
}

async function run(sql, params = []) {
  await query(sql, params);
}

async function insertRoundResult(userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect) {
  await run(
    'INSERT INTO round_results (user_id, game_id, genre, track_id, guess_time_ms, points_earned, is_correct) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect]
  );
}

async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows.length > 0;
}

async function getTableCounts() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM game_scores) AS game_scores,
      (SELECT COUNT(*) FROM round_results) AS round_results,
      (SELECT COUNT(*) FROM friendships) AS friendships
  `);
  return rows[0];
}

export { generateId, query, get, all, run, insertRoundResult, ping, getTableCounts, pool };
