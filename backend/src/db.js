import crypto from 'node:crypto';

let db;

function generateId() {
  return crypto.randomUUID();
}

if (process.env.DATABASE_URL) {
  const pg = await import('pg');
  const { Pool } = pg.default || pg;
  db = new Pool({ connectionString: process.env.DATABASE_URL });

  db.query = db.query.bind(db);
  db.run = (text, params) => db.query(text, params);
  db.get = async (text, params) => {
    const res = await db.query(text, params);
    return res.rows[0] || null;
  };
  db.all = async (text, params) => {
    const res = await db.query(text, params);
    return res.rows;
  };
} else {
  const Database = (await import('better-sqlite3')).default;
  db = new Database('./data.db');
  db.db = db;
}

async function init() {
  if (process.env.DATABASE_URL) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        discord_id TEXT UNIQUE,
        username TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        game_code TEXT,
        score INTEGER,
        total_rounds INTEGER,
        played_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        user_id TEXT REFERENCES users(id),
        friend_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, friend_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS round_results (
        id SERIAL PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        game_id VARCHAR(50),
        genre VARCHAR(50),
        track_id VARCHAR(100),
        guess_time_ms INT,
        points_earned INT,
        is_correct BOOLEAN,
        played_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        discord_id TEXT UNIQUE,
        username TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        game_code TEXT,
        score INTEGER,
        total_rounds INTEGER,
        played_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS friendships (
        user_id TEXT REFERENCES users(id),
        friend_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, friend_id)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS round_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT REFERENCES users(id),
        game_id VARCHAR(50),
        genre VARCHAR(50),
        track_id VARCHAR(100),
        guess_time_ms INT,
        points_earned INT,
        is_correct INTEGER,
        played_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
}

await init();

async function query(sql, params = []) {
  if (process.env.DATABASE_URL) {
    const res = await db.query(sql, params);
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
    [userId, gameId, genre, trackId, guessTimeMs, pointsEarned, isCorrect]
  );
}

export { generateId, query, get, all, run, insertRoundResult };
