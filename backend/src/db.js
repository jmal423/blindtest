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

async function createGame(gameId, code, genres, audioSource, rounds, roundTime) {
  await run(
    'INSERT INTO games (id, code, genres, audio_source, rounds, round_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [gameId, code, JSON.stringify(genres), audioSource, rounds, roundTime, 'playing']
  );
}

async function finishGame(gameId) {
  await run(
    'UPDATE games SET status = ?, finished_at = NOW() WHERE id = ?',
    ['finished', gameId]
  );
}

async function addGamePlayer(id, gameId, playerId, playerName, score, position) {
  await run(
    'INSERT INTO game_players (id, game_id, player_id, player_name, score, position) VALUES (?, ?, ?, ?, ?, ?)',
    [id, gameId, playerId, playerName, score, position]
  );
}

async function addRoundResultV2(id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth) {
  await run(
    'INSERT INTO round_results_v2 (id, game_id, player_id, player_name, round, track_name, track_artist, genre, guess, guess_time_ms, points_earned, found_artist, found_title, found_both) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, gameId, playerId, playerName, round, trackName, trackArtist, genre, guess, guessTimeMs, pointsEarned, foundArtist, foundTitle, foundBoth]
  );
}

async function getGameHistory(playerId, limit = 20) {
  return all(
    `SELECT g.id, g.code, g.genres, g.audio_source, g.rounds, g.round_time, g.status, g.created_at, g.finished_at,
            gp.score, gp.position
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.player_id = ? OR gp.player_name = (
       SELECT player_name FROM game_players WHERE player_id = ? LIMIT 1
     )
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [playerId, playerId, limit]
  );
}

async function getPlayerStats(playerId) {
  const [totals, best, rounds] = await Promise.all([
    get('SELECT COUNT(*) as games, COALESCE(SUM(gp.score), 0) as total_points, COALESCE(AVG(gp.score), 0) as avg_score FROM game_players gp WHERE gp.player_id = ?', [playerId]),
    get('SELECT MAX(gp.score) as best_score FROM game_players gp WHERE gp.player_id = ?', [playerId]),
    get('SELECT COUNT(*) as total_rounds, COALESCE(SUM(rv.points_earned), 0) as total_points, COALESCE(AVG(rv.guess_time_ms), 0) as avg_speed, COALESCE(SUM(CASE WHEN rv.found_both THEN 1 ELSE 0 END), 0) as perfects FROM round_results_v2 rv WHERE rv.player_id = ?', [playerId]),
  ]);

  return {
    gamesPlayed: totals?.games || 0,
    totalPoints: totals?.total_points || 0,
    avgScore: totals?.avg_score || 0,
    bestScore: best?.best_score || 0,
    totalRounds: rounds?.total_rounds || 0,
    roundPoints: rounds?.total_points || 0,
    avgSpeedMs: rounds?.avg_speed ? Math.round(Number(rounds.avg_speed)) : null,
    perfects: rounds?.perfects || 0,
  };
}

async function getLeaderboardV2(limit = 50) {
  return all(
    `SELECT gp.player_name, gp.player_id,
            COUNT(DISTINCT gp.game_id) as games_played,
            COALESCE(SUM(gp.score), 0) as total_score,
            COALESCE(AVG(gp.score), 0) as avg_score,
            MAX(gp.score) as best_score,
            COALESCE(SUM(gp.position = 1)::int, 0) as wins
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE g.status = 'finished'
     GROUP BY gp.player_id, gp.player_name
     ORDER BY total_score DESC
     LIMIT ?`,
    [limit]
  );
}

async function getRecentGames(limit = 20) {
  return all(
    `SELECT g.id, g.code, g.genres, g.audio_source, g.rounds, g.round_time, g.status, g.created_at, g.finished_at,
            (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
     FROM games g
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function getGameDetails(gameId) {
  const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) return null;

  const players = await all('SELECT * FROM game_players WHERE game_id = ?', [gameId]);
  const rounds = await all('SELECT * FROM round_results_v2 WHERE game_id = ? ORDER BY round, created_at', [gameId]);

  return { ...game, players, rounds };
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
      (SELECT COUNT(*) FROM friendships) AS friendships,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM game_players) AS game_players,
      (SELECT COUNT(*) FROM round_results_v2) AS round_results_v2
  `);
  return rows[0];
}

export { generateId, query, get, all, run, insertRoundResult, createGame, finishGame, addGamePlayer, addRoundResultV2, getGameHistory, getPlayerStats, getLeaderboardV2, getRecentGames, getGameDetails, ping, getTableCounts, pool };
