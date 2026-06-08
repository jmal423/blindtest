import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { GameRoom } from './game.js';
import { GENRES, getGenreLabel } from './deezer.js';
import { generateId, get, all, run, ping, getTableCounts, createGame, finishGame, addGamePlayer, addRoundResultV2, getGameHistory, getPlayerStats, getLeaderboardV2, getRecentGames, getGameDetails, getSongCacheCounts, getSongCacheByGenre } from './db.js';
import { getAuthUrl, handleDiscordCallback, authenticate, requireAdmin, tryDecodeToken } from './auth.js';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', credentials: true },
});

const rooms = new Map();
const socketPlayerMap = new Map();

io.on('connection', (socket) => {
  socket.on('join_room', (roomCode, playerId) => {
    if (!roomCode) return;
    socket.join(roomCode);
    if (playerId) socketPlayerMap.set(socket.id, { roomCode, playerId });
    const room = rooms.get(roomCode);
    if (room) {
      if (playerId) room.setPlayerSocket(playerId, socket.id);
      socket.emit('game_state', room.getState());
    }
  });

  socket.on('playback_started', () => {
    const info = socketPlayerMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (room) room.markPlayerReady(info.playerId);
  });

  socket.on('skip_round', () => {
    const info = socketPlayerMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const player = room.getPlayer(info.playerId);
    if (!player) return;
    const isAdmin = player.role === 'admin';
    const isHost = info.playerId === room.hostId;
    const result = room.voteSkip(info.playerId, isAdmin, isHost);
    broadcastState(info.roomCode);
    if (result.skipped) {
      io.to(info.roomCode).emit('new_chat_message', { isSystem: true, content: '⏭ Round skipped!' });
    } else {
      io.to(info.roomCode).emit('new_chat_message', { isSystem: true, content: `Skip vote: ${result.votes}/${result.needed}` });
    }
  });

  socket.on('kick_player', (targetPlayerId) => {
    const info = socketPlayerMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const player = room.getPlayer(info.playerId);
    if (!player || (player.role !== 'admin' && info.playerId !== room.hostId)) return;
    room.kickPlayer(targetPlayerId);
  });

  socket.on('submit_guess', (data) => {
    const info = socketPlayerMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const result = room.submitAnswer(info.playerId, (data.input || '').trim());
    if (!result) return;
    broadcastState(info.roomCode);
  });

  socket.on('send_chat_message', (data) => {
    const info = socketPlayerMap.get(socket.id);
    if (!info || !data.content || !data.content.trim()) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const player = room.getPlayer(info.playerId);
    io.to(info.roomCode).emit('new_chat_message', {
      isSystem: false,
      sender: player?.name || 'Unknown',
      content: data.content.trim(),
    });
  });

  socket.on('play_again', (roomCode) => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const info = socketPlayerMap.get(socket.id);
    if (!info || info.playerId !== room.hostId) return;
    room.resetGame();
  });

  socket.on('disconnect', () => {
    socketPlayerMap.delete(socket.id);
  });
});

function broadcastState(code) {
  const room = rooms.get(code);
  if (room) {
    io.to(code).emit('game_state', room.getState());
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

// Genres
// Health check (public, no auth)
app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await ping();
    const counts = await getTableCounts();
    res.json({
      ok: dbOk,
      uptime: process.uptime(),
      database: { connected: dbOk, type: 'PostgreSQL', tables: counts },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/genres', (req, res) => {
  res.json(GENRES.map(g => ({ id: g, label: getGenreLabel(g) })));
});

// Rooms (auth required)
app.post('/api/rooms', authenticate, async (req, res) => {
  const { genres = [], rounds, roundTime } = req.body;

  const user = await get('SELECT id, username, avatar_url, role FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const code = generateCode();
  const room = new GameRoom(code, genres, io);
  if (rounds || roundTime) room.updateSettings({ rounds, roundTime });
  const playerId = room.addPlayer(user.username, user.avatar_url, user.role, user.id);
  rooms.set(code, room);

  res.json({ code, playerId, settings: room.getSettings(), genres: room.genres });
});

app.post('/api/rooms/join', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Room code is required' });

  const user = await get('SELECT id, username, avatar_url, role FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const room = rooms.get(code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const playerId = room.addPlayer(user.username, user.avatar_url, user.role, user.id);
  broadcastState(room.code);
  res.json({ code: room.code, playerId });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  res.json({
    code: room.code,
    genres: room.genres,
    state: room.state,
    playerCount: room.players.length,
  });
});

// Game
app.post('/api/game/:code/settings', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.state !== 'waiting') return res.status(400).json({ error: 'Game already started' });
  if (room.hostId !== req.body.playerId) return res.status(403).json({ error: 'Only the host can change settings' });

  if (req.body.genres !== undefined && Array.isArray(req.body.genres)) {
    room.genres = req.body.genres;
  }
  room.updateSettings(req.body);
  broadcastState(room.code);
  res.json(room.getSettings());
});

app.post('/api/game/:code/start', async (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { playerId } = req.body;
  if (room.hostId !== playerId) {
    return res.status(403).json({ error: 'Only the host can start' });
  }

  const error = await room.startGame();
  if (error) return res.status(400).json({ error });
  res.json({ ok: true });
});

// (submit_guess moved to WebSocket — see io.on('connection') above)

app.post('/api/game/:code/save', authenticate, async (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.state !== 'game_over') return res.status(400).json({ error: 'Game not finished' });

  const player = room.players.find(p => p.id === req.body.playerId);
  if (!player) return res.status(404).json({ error: 'Player not in game' });

  const id = generateId();
  await run(
    'INSERT INTO game_scores (id, user_id, game_code, score, total_rounds) VALUES (?, ?, ?, ?, ?)',
    [id, req.user.userId, room.code, player.score, room.totalRounds]
  );

  res.json({ saved: true, score: player.score, totalRounds: room.totalRounds });
});

app.post('/api/game/:code/leave', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { playerId } = req.body;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.hostId === playerId) {
    room.hostId = room.players[0]?.id || null;
  }

  if (room.players.length === 0) {
    room.destroy();
    rooms.delete(room.code);
  } else {
    broadcastState(room.code);
  }

  res.json({ ok: true });
});

// Auth
app.get('/api/auth/discord', (req, res) => {
  const redirectUrl = typeof req.query.redirect === 'string' ? req.query.redirect : null;
  const url = getAuthUrl(req.headers.host, redirectUrl);
  res.redirect(url);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const result = await handleDiscordCallback(code, req.headers.host, state);
    const fallback = process.env.FRONTEND_URL || 'http://localhost:3000';
    const target = result.redirectUrl || fallback;
    res.redirect(`${target}?token=${result.token}`);
  } catch (err) {
    const fallback = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${fallback}?error=${encodeURIComponent(err.message)}`);
  }
});

// Users — /me/* routes MUST come before /:id wildcard routes
app.get('/api/users/me', authenticate, async (req, res) => {
  const user = await get('SELECT id, username, avatar_url, role, created_at FROM users WHERE id = ?', [req.user.userId]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.get('/api/users/me/scores', authenticate, async (req, res) => {
  const scores = await all(
    'SELECT * FROM game_scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 50',
    [req.user.userId]
  );
  res.json(scores);
});

app.get('/api/users/me/history', authenticate, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const userId = req.user.userId;
    const games = await getGameHistory(userId, limit);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/me/stats', authenticate, async (req, res) => {
  const userId = req.user.userId;
  try {
    const stats = await getPlayerStats(userId);
    res.json(stats);
  } catch (err) {
    // Fallback to old stats
    const [totalPoints, avgSpeed, bestGenre] = await Promise.all([
      get('SELECT COALESCE(SUM(points_earned), 0) as total FROM round_results WHERE user_id = ?', [userId]),
      get('SELECT AVG(guess_time_ms) as avg FROM round_results WHERE user_id = ? AND is_correct = true', [userId]),
      get('SELECT genre FROM round_results WHERE user_id = ? AND is_correct = true GROUP BY genre ORDER BY COUNT(*) DESC LIMIT 1', [userId]),
    ]);
    res.json({
      totalPoints: totalPoints?.total || 0,
      averageSpeedMs: avgSpeed?.avg ? Math.round(Number(avgSpeed.avg)) : null,
      bestGenre: bestGenre?.genre || null,
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const user = await get('SELECT id, username, avatar_url, role, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const scores = await all(
    'SELECT score, total_rounds, played_at FROM game_scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 20',
    [req.params.id]
  );

  const bestScore = await get(
    'SELECT MAX(score) as best FROM game_scores WHERE user_id = ?',
    [req.params.id]
  );

  res.json({ ...user, scores, bestScore: bestScore?.best || 0 });
});

// Public user stats
app.get('/api/users/:id/stats', async (req, res) => {
  try {
    const stats = await getPlayerStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  try {
    const entries = await getLeaderboardV2(limit);
    res.json(entries);
  } catch (err) {
    console.error('[DB] Leaderboard v2 failed:', err.message);
    res.json([]);
  }
});

// Recent games (public)
app.get('/api/games/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const games = await getRecentGames(limit);
    // Parse genres JSON
    const parsed = games.map(g => ({ ...g, genres: g.genres ? JSON.parse(g.genres) : [] }));
    res.json(parsed);
  } catch (err) {
    res.json([]);
  }
});

// Game details (public)
app.get('/api/games/:id', async (req, res) => {
  try {
    const game = await getGameDetails(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    game.genres = game.genres ? JSON.parse(game.genres) : [];
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Friends
app.get('/api/friends', authenticate, async (req, res) => {
  const friends = await all(`
    SELECT u.id, u.username, u.avatar_url, f.status, f.created_at
    FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
  `, [req.user.userId, req.user.userId, req.user.userId]);

  const pending = await all(`
    SELECT u.id, u.username, u.avatar_url, f.created_at
    FROM friendships f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `, [req.user.userId]);

  res.json({ friends, pending });
});

app.post('/api/friends/request/:userId', authenticate, async (req, res) => {
  if (req.params.userId === req.user.userId) {
    return res.status(400).json({ error: 'Cannot friend yourself' });
  }

  const target = await get('SELECT id FROM users WHERE id = ?', [req.params.userId]);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const existing = await get(
    'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    [req.user.userId, req.params.userId, req.params.userId, req.user.userId]
  );

  if (existing) {
    return res.status(400).json({ error: 'Friendship already exists or pending' });
  }

  await run(
    'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
    [req.user.userId, req.params.userId, 'pending']
  );

  res.json({ ok: true });
});

app.post('/api/friends/accept/:userId', authenticate, async (req, res) => {
  const existing = await get(
    'SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?',
    [req.params.userId, req.user.userId, 'pending']
  );

  if (!existing) return res.status(404).json({ error: 'No pending request' });

  await run(
    'UPDATE friendships SET status = ? WHERE user_id = ? AND friend_id = ?',
    ['accepted', req.params.userId, req.user.userId]
  );

  res.json({ ok: true });
});

app.delete('/api/friends/:userId', authenticate, async (req, res) => {
  await run(
    'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    [req.user.userId, req.params.userId, req.params.userId, req.user.userId]
  );
  res.json({ ok: true });
});

// Admin — genre test (Deezer only)
app.post('/api/admin/test/genre', requireAdmin, async (req, res) => {
  const { genre, count } = req.body;
  if (!genre) return res.status(400).json({ error: 'Genre required' });
  try {
    const { getTracksByGenre } = await import('./deezer.js');
    const tracks = await getTracksByGenre(genre, count || 5);
    res.json({ ok: true, count: tracks.length, tracks: tracks.map(t => ({ name: t.name, artist: t.artist, previewUrl: !!t.previewUrl, genre: t.genre })) });
  } catch (err) {
    res.json({ ok: false, count: 0, tracks: [], error: err.message });
  }
});

// Test: seed mock tracks for testing
app.post('/api/admin/test/seed-game/:code', requireAdmin, async (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.state !== 'waiting') return res.status(400).json({ error: 'Game already started' });

  const rounds = parseInt(req.body.rounds) || 3;
  const mockTracks = [
    { id: 'deezer:1', name: 'Bohemian Rhapsody', artist: 'Queen', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 355000, genre: 'rock' },
    { id: 'deezer:2', name: 'Billie Jean', artist: 'Michael Jackson', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 294000, genre: 'pop' },
    { id: 'deezer:3', name: 'Smells Like Teen Spirit', artist: 'Nirvana', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 301000, genre: 'rock' },
    { id: 'deezer:4', name: 'Like a Prayer', artist: 'Madonna', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 280000, genre: 'pop' },
    { id: 'deezer:5', name: 'Stairway to Heaven', artist: 'Led Zeppelin', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 482000, genre: 'rock' },
  ];

  room.tracks = mockTracks.slice(0, Math.max(rounds, mockTracks.length));
  room.totalRounds = rounds;
  room.genres = [...new Set(mockTracks.map(t => t.genre))];

  const error = await room.startGame();
  if (error) return res.status(400).json({ error });
  res.json({ ok: true, rounds, tracks: room.tracks.length });
});

app.post('/api/admin/test/start-round/:code', requireAdmin, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  // Force state to playing and start the timer
  if (room.state === 'round_preparing') {
    if (room.countdownTimer) clearTimeout(room.countdownTimer);
    room.state = 'playing';
    room.broadcast();
  }
  if (room.state === 'playing') {
    room.startRoundTimer();
  }
  res.json({ ok: true, state: room.state });
});

app.post('/api/admin/test/deezer', requireAdmin, async (req, res) => {
  const results = [];
  const { getTracksByGenre } = await import('./deezer.js');

  const testEndpoint = async (label, url) => {
    const start = Date.now();
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Blindtest/1.0' } });
      const ms = Date.now() - start;
      let body;
      try { body = await r.clone().json(); } catch { body = (await r.text())?.substring(0, 200); }
      results.push({ label, status: r.status, ok: r.ok, ms });
    } catch (err) {
      results.push({ label, status: 'FETCH_ERROR', ok: false, ms: Date.now() - start, error: err.message });
    }
  };

  await testEndpoint('genre list', 'https://api.deezer.com/genre');
  await testEndpoint('search pop', 'https://api.deezer.com/search?q=pop&limit=1');
  await testEndpoint('artist top tracks', 'https://api.deezer.com/artist/13/top?limit=1');

  res.json(results);
});

app.post('/api/admin/test/deezer/genre', requireAdmin, async (req, res) => {
  const { genre, count } = req.body;
  if (!genre) return res.status(400).json({ error: 'Genre required' });
  try {
    const { getTracksByGenre } = await import('./deezer.js');
    const start = Date.now();
    const tracks = await getTracksByGenre(genre, count || 10);
    const ms = Date.now() - start;
    res.json({
      ok: true,
      count: tracks.length,
      previewCount: tracks.filter(t => t.previewUrl).length,
      latencyMs: ms,
      tracks: tracks.map(t => ({
        name: t.name,
        artist: t.artist,
        previewUrl: !!t.previewUrl,
        durationMs: t.durationMs,
        id: t.id,
        rank: t.rank || 0,
      })),
    });
  } catch (err) {
    res.json({ ok: false, count: 0, tracks: [], error: err.message });
  }
});

app.get('/api/admin/db-status', requireAdmin, async (req, res) => {
  try {
    const tables = await getTableCounts();
    res.json({
      ok: true,
      isPostgres: true,
      hasData: tables.users > 0,
      tables,
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [userCount, roundCount, gameCount, songCache] = await Promise.all([
    get('SELECT COUNT(*) as count FROM users'),
    get('SELECT COUNT(*) as count FROM round_results_v2'),
    get('SELECT COUNT(*) as count FROM games WHERE status = \'finished\''),
    getSongCacheCounts().catch(() => ({ total: 0, genres: 0, plays: 0 })),
  ]);
  res.json({
    totalUsers: Number(userCount?.count || 0),
    totalRounds: Number(roundCount?.count || 0),
    totalGames: Number(gameCount?.count || 0),
    activeRooms: rooms.size,
    songCacheTotal: Number(songCache.total || 0),
    songCacheTracks: Number(songCache.total || 0),
    songCacheGenres: Number(songCache.genres || 0),
    songCachePlays: Number(songCache.plays || 0),
  });
});

app.get('/api/admin/song-cache', requireAdmin, async (req, res) => {
  const [counts, genres] = await Promise.all([
    getSongCacheCounts().catch(() => ({ total: 0, genres: 0, plays: 0 })),
    getSongCacheByGenre().catch(() => []),
  ]);
  res.json({ ...counts, genres });
});

app.get('/api/admin/rooms', requireAdmin, (req, res) => {
  const list = [];
  for (const [code, room] of rooms) {
    list.push({
      code,
      state: room.state,
      players: room.players.length,
      genres: room.genres,
      currentRound: room.tracksPlayed + 1,
      totalRounds: room.totalRounds,
      settings: room.getSettings(),
    });
  }
  list.sort((a, b) => (b.players || 0) - (a.players || 0));
  res.json(list);
});

app.delete('/api/admin/users/:id/scores', requireAdmin, async (req, res) => {
  await run('DELETE FROM round_results WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM game_scores WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM round_results_v2 WHERE player_id = ?', [req.params.id]);
  await run('DELETE FROM game_players WHERE player_id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await all('SELECT id, username, avatar_url, role, created_at FROM users ORDER BY created_at DESC');
  res.json(users);
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  await run('DELETE FROM round_results WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM round_results_v2 WHERE player_id = ?', [req.params.id]);
  await run('DELETE FROM game_players WHERE player_id = ?', [req.params.id]);
  await run('DELETE FROM game_scores WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?', [req.params.id, req.params.id]);
  await run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BlindTest server running on port ${PORT}`);
});
