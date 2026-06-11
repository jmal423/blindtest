import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set.');
  console.error('[DB] For local dev: docker compose up -d');
  console.error('[DB] For production: set DATABASE_URL to your PostgreSQL connection string.');
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export let rawPool = null;
if (process.env.RAW_DATABASE_URL) {
  rawPool = new pg.Pool({
    connectionString: process.env.RAW_DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  rawPool.on('error', (err) => {
    console.error('[DB] Unexpected raw pool error:', err.message);
  });
}

export async function connectWithRetry(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log(`[DB] PostgreSQL (Main) connected: ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);

      if (rawPool) {
        const rawClient = await rawPool.connect();
        rawClient.release();
        console.log(`[DB] PostgreSQL (Raw) connected: ${process.env.RAW_DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
      }
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

export function generateId() {
  return crypto.randomUUID();
}

export async function query(sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function all(sql, params = []) {
  return query(sql, params);
}

export async function run(sql, params = []) {
  await query(sql, params);
}
