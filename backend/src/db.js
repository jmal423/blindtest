import 'dotenv/config';
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
  const [totals, best, rounds, genreRow] = await Promise.all([
    get('SELECT COUNT(DISTINCT gp.game_id) as games, COALESCE(SUM(gp.score), 0) as total_points, COALESCE(AVG(gp.score), 0) as avg_score FROM game_players gp JOIN games g ON g.id = gp.game_id WHERE g.status = \'finished\' AND gp.player_id = ?', [playerId]),
    get('SELECT MAX(gp.score) as best_score FROM game_players gp WHERE gp.player_id = ?', [playerId]),
    get('SELECT COUNT(*) as total_rounds, COALESCE(SUM(rv.points_earned), 0) as round_points, COALESCE(AVG(rv.guess_time_ms), 0) as avg_speed, COALESCE(SUM(CASE WHEN rv.found_both THEN 1 ELSE 0 END), 0) as perfects FROM round_results_v2 rv WHERE rv.player_id = ?', [playerId]),
    get('SELECT rv.genre FROM round_results_v2 rv WHERE rv.player_id = ? AND (rv.found_artist OR rv.found_title) GROUP BY rv.genre ORDER BY COUNT(*) DESC LIMIT 1', [playerId]),
  ]);

  return {
    totalPoints: Number(totals?.total_points || 0),
    averageSpeedMs: rounds?.avg_speed ? Math.round(Number(rounds.avg_speed)) : null,
    bestGenre: genreRow?.genre || null,
    gamesPlayed: Number(totals?.games || 0),
    avgScore: Number(totals?.avg_score || 0),
    bestScore: Number(best?.best_score || 0),
    totalRounds: Number(rounds?.total_rounds || 0),
    roundPoints: Number(rounds?.round_points || 0),
    perfects: Number(rounds?.perfects || 0),
  };
}

async function getLeaderboardV2(limit = 50) {
  return all(
    `SELECT MAX(gp.player_name) as username, gp.player_id as id,
            COUNT(DISTINCT gp.game_id) as games_played,
            COALESCE(SUM(gp.score), 0) as total_score,
            COALESCE(AVG(gp.score), 0) as avg_score,
            MAX(gp.score) as best_score,
            COALESCE(SUM(CASE WHEN gp.position = 1 THEN 1 ELSE 0 END), 0) as wins,
            u.avatar_url
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     LEFT JOIN users u ON u.id = gp.player_id
     WHERE g.status = 'finished'
     GROUP BY gp.player_id, u.avatar_url
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

async function cacheSongs(tracks) {
  for (const t of tracks) {
    if (!t.id || !t.name || !t.artist) continue;
    const genres = Array.isArray(t.genres) && t.genres.length > 0
      ? JSON.stringify(t.genres)
      : JSON.stringify(t.genre ? [t.genre] : []);
    await run(
      `INSERT INTO songs_cache (id, name, artist, album_image, duration_ms, genre, genres, rank, source, chart_source)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         artist = EXCLUDED.artist,
         album_image = EXCLUDED.album_image,
         duration_ms = EXCLUDED.duration_ms,
         genres = EXCLUDED.genres,
         rank = EXCLUDED.rank,
         chart_source = EXCLUDED.chart_source,
         fetched_at = NOW()`,
      [t.id, t.name, t.artist, t.albumImage || null, t.durationMs || 0, t.genre || null, genres, t.rank || 0, 'deezer', t.chartSource || null]
    );
  }
}

async function recordPlay(songId, gameId) {
  await run(
    'INSERT INTO songs_played (id, song_id, game_id) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING',
    [crypto.randomUUID(), songId, gameId]
  );
}

async function getCachedTracksByGenre(genre, count) {
  const rows = await all(
    `SELECT sc.*,
       COALESCE(
          CASE
            WHEN sp.last_played IS NULL THEN 1.0
            WHEN sp.last_played > NOW() - INTERVAL '1 hour' THEN 0.05
            WHEN sp.last_played > NOW() - INTERVAL '1 day' THEN 0.2
            WHEN sp.last_played > NOW() - INTERVAL '7 days' THEN 0.5
            ELSE 0.85
          END, 1.0
        ) as recency_weight
     FROM songs_cache sc
     LEFT JOIN (
       SELECT song_id, MAX(played_at) as last_played
       FROM songs_played
       GROUP BY song_id
     ) sp ON sp.song_id = sc.id
     WHERE (sc.genres @> ?::jsonb OR sc.genre = ? OR sc.ai_genres @> ?::jsonb)
     ORDER BY (sc.rank + 1000) * COALESCE(
       CASE
         WHEN sp.last_played IS NULL THEN 1.0
         WHEN sp.last_played > NOW() - INTERVAL '1 hour' THEN 0.05
         WHEN sp.last_played > NOW() - INTERVAL '1 day' THEN 0.2
         WHEN sp.last_played > NOW() - INTERVAL '7 days' THEN 0.5
         ELSE 0.85
       END, 1.0
     ) * random() DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, JSON.stringify([genre]), count * 3]
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.album_image,
    previewUrl: null,
    durationMs: r.duration_ms,
    genre: r.genre,
    genres: typeof r.genres === 'string' ? JSON.parse(r.genres) : (r.genres || []),
    chartSource: r.chart_source || null,
    rank: r.rank,
  }));
}

async function getSongCacheCounts() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM songs_cache) AS total,
      (SELECT COUNT(DISTINCT genre) FROM songs_cache) AS genres,
      (SELECT COUNT(*) FROM songs_played) AS plays
  `);
  return rows[0];
}

async function getSongCacheByGenre() {
  const { rows } = await pool.query(`
    SELECT genre, COUNT(*) as count, MAX(fetched_at) as last_fetched
    FROM (
      SELECT jsonb_array_elements_text(genres) AS genre, fetched_at FROM songs_cache
      WHERE genres != '[]'::jsonb
      UNION ALL
      SELECT genre, fetched_at FROM songs_cache WHERE genre IS NOT NULL AND genres = '[]'::jsonb AND genre != ''
    ) sub
    GROUP BY genre
    ORDER BY count DESC
  `);
  return rows;
}

async function getPlayedSongs(limit = 200) {
  const { rows } = await pool.query(`
    SELECT sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank,
      COUNT(sp.id) as play_count, MAX(sp.played_at) as last_played
    FROM songs_played sp
    JOIN songs_cache sc ON sp.song_id = sc.id
    GROUP BY sc.id, sc.name, sc.artist, sc.genre, sc.genres, sc.chart_source, sc.rank
    ORDER BY play_count DESC, last_played DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

async function getAiEnrichmentStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_processed_at IS NULL) as unprocessed,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version LIKE 'error:%') as errors,
      COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND ai_version NOT LIKE 'error:%') as processed,
      MAX(ai_processed_at) as last_processed
    FROM songs_cache
  `);
  return rows[0];
}

async function getAiGenreDistribution() {
  const { rows } = await pool.query(`
    SELECT jsonb_array_elements_text(ai_genres) AS genre,
           COUNT(*) as count
    FROM songs_cache
    WHERE ai_genres != '[]'::jsonb
    GROUP BY genre
    ORDER BY count DESC
  `);
  return rows;
}

async function getUnprocessedTracks(limit = 50) {
  return all(
    `SELECT id, name, artist, genre, genres, chart_source, rank
     FROM songs_cache
     WHERE ai_processed_at IS NULL
     ORDER BY rank DESC
     LIMIT ?`,
    [limit]
  );
}

export { generateId, query, get, all, run, insertRoundResult, createGame, finishGame, addGamePlayer, addRoundResultV2, getGameHistory, getPlayerStats, getLeaderboardV2, getRecentGames, getGameDetails, ping, getTableCounts, cacheSongs, recordPlay, getCachedTracksByGenre, getSongCacheCounts, getSongCacheByGenre, getPlayedSongs, getAiEnrichmentStats, getAiGenreDistribution, getUnprocessedTracks, pool };
