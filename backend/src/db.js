import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '..', 'data.db');
const isPostgres = !!process.env.DATABASE_URL;

let db;

function generateId() {
  return crypto.randomUUID();
}

async function connectWithRetry(fn, label, retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`[DB] ${label} attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delayMs / 1000}s...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

if (isPostgres) {
  await connectWithRetry(async () => {
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    await db.query('SELECT 1');
  }, 'PostgreSQL connect');
  console.log(`[DB] PostgreSQL connected: ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);

  db.run = (text, params) => db.query(text, params);
  db.get = async (text, params) => {
    const res = await db.query(text, params);
    return res.rows[0] || null;
  };
  db.all = async (text, params) => {
    const res = await db.query(text, params);
    return res.rows;
  };
  db.exec = (text) => db.query(text);
} else {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const Database = (await import('better-sqlite3')).default;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = OFF');
  db.db = db;
  console.log(`[DB] SQLite connected: ${DB_PATH}`);

  db.run = (text, params = []) => {
    const stmt = db.prepare(text);
    stmt.run(...params);
  };
  db.get = (text, params = []) => {
    const stmt = db.prepare(text);
    return stmt.get(...params) || null;
  };
  db.all = (text, params = []) => {
    const stmt = db.prepare(text);
    return stmt.all(...params);
  };
  const nativeExec = db.exec.bind(db);
  db.exec = (text) => nativeExec(text);
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (isPostgres) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  const appliedRows = await db.all('SELECT name FROM _migrations ORDER BY name');
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

    if (isPostgres) {
      const stmts = migration.up.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await db.query(stmt);
      }
    } else {
      const stmts = (migration.sqlite || migration.up).split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        db.exec(stmt);
      }
    }

    await db.run('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
    console.log(`[DB] Migration ${migration.name} applied`);
  }
}

await runMigrations();

async function query(sql, params = []) {
  if (isPostgres) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const res = await db.query(pgSql, params);
    return res.rows;
  }
  const stmt = db.db.prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    return stmt.all(...params);
  }
  stmt.run(...params);
  return [];
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
    [userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect ? 1 : 0]
  );
}

async function ping() {
  const row = await get('SELECT 1 as ok');
  return !!row;
}

async function getTableCounts() {
  const [users, scores, rounds, friendships] = await Promise.all([
    get('SELECT COUNT(*) as count FROM users'),
    get('SELECT COUNT(*) as count FROM game_scores'),
    get('SELECT COUNT(*) as count FROM round_results'),
    get('SELECT COUNT(*) as count FROM friendships'),
  ]);
  return {
    users: users?.count || 0,
    game_scores: scores?.count || 0,
    round_results: rounds?.count || 0,
    friendships: friendships?.count || 0,
  };
}

export { generateId, query, get, all, run, insertRoundResult, ping, getTableCounts, isPostgres };
