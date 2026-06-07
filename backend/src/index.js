import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { GameRoom } from './game.js';
import { GENRES, getGenreLabel } from './spotify.js';
import { generateId, get, all, run } from './db.js';
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
    if (!player || (player.role !== 'admin' && info.playerId !== room.hostId)) return;
    room.skipRound();
    broadcastState(info.roomCode);
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
app.get('/api/genres', (req, res) => {
  res.json(GENRES.map(g => ({ id: g, label: getGenreLabel(g) })));
});

// Rooms
app.post('/api/rooms', (req, res) => {
  const { genres = [], playerName, avatarUrl, role, rounds, roundTime } = req.body;
  if (!playerName || !playerName.trim()) {
    return res.status(400).json({ error: 'Player name is required' });
  }

  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const decoded = tryDecodeToken(authHeader.slice(7));
    if (decoded) userId = decoded.userId;
  }

  const code = generateCode();
  const room = new GameRoom(code, genres, io);
  if (rounds || roundTime) room.updateSettings({ rounds, roundTime });
  const playerId = room.addPlayer(playerName.trim(), avatarUrl || null, role || 'user', userId);
  rooms.set(code, room);

  res.json({ code, playerId, settings: room.getSettings(), genres: room.genres });
});

app.post('/api/rooms/join', (req, res) => {
  const { code, playerName, avatarUrl, role } = req.body;
  if (!code || !playerName || !playerName.trim()) {
    return res.status(400).json({ error: 'Code and name are required' });
  }

  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const decoded = tryDecodeToken(authHeader.slice(7));
    if (decoded) userId = decoded.userId;
  }

  const room = rooms.get(code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const playerId = room.addPlayer(playerName.trim(), avatarUrl || null, role || 'user', userId);
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

// YouTube
app.get('/api/youtube/search', async (req, res) => {
  const { name, artist } = req.query;
  if (!name || !artist) {
    return res.status(400).json({ error: 'name and artist query params required' });
  }

  try {
    const { searchYouTubeVideo } = await import('./youtube.js');
    const videoId = await searchYouTubeVideo(name, artist);
    res.json({ videoId, name, artist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Guest login — bypasses Discord auth for quick access
app.post('/api/auth/guest', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'Guest';
  const userId = `guest_${generateId()}`;
  const isJl = name.toLowerCase() === 'jl';
  const role = isJl ? 'admin' : 'user';

  let avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  if (isJl) {
    // Use JL's Discord avatar from the database
    const adminUser = await get('SELECT avatar_url FROM users WHERE username IS NOT NULL AND role = ? LIMIT 1', ['admin']);
    if (adminUser?.avatar_url) {
      avatarUrl = adminUser.avatar_url;
    }
  }

  const token = jwt.sign(
    { userId, role, guest: true, username: name },
    process.env.JWT_SECRET || 'blindtest-dev-secret-change-in-production',
    { expiresIn: '365d' }
  );

  res.json({
    token,
    user: { id: userId, username: name, avatar_url: avatarUrl, role, created_at: new Date().toISOString() },
  });
});

// Users
app.get('/api/users/me', authenticate, async (req, res) => {
  if (req.user.guest) {
    return res.json({
      id: req.user.userId,
      username: req.user.username || 'Guest',
      avatar_url: null,
      role: req.user.role || 'user',
      created_at: new Date().toISOString(),
    });
  }
  const user = await get('SELECT id, username, avatar_url, role, created_at FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/users/me/scores', authenticate, async (req, res) => {
  const scores = await all(
    'SELECT * FROM game_scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 50',
    [req.user.userId]
  );
  res.json(scores);
});

app.get('/api/users/me/stats', authenticate, async (req, res) => {
  const correctVal = process.env.DATABASE_URL ? true : 1;
  const [totalPoints, avgSpeed, bestGenre] = await Promise.all([
    get('SELECT COALESCE(SUM(points_earned), 0) as total FROM round_results WHERE user_id = ?', [req.user.userId]),
    get('SELECT AVG(guess_time_ms) as avg FROM round_results WHERE user_id = ? AND is_correct = ?', [req.user.userId, correctVal]),
    get('SELECT genre FROM round_results WHERE user_id = ? AND is_correct = ? GROUP BY genre ORDER BY COUNT(*) DESC LIMIT 1', [req.user.userId, correctVal]),
  ]);
  res.json({
    totalPoints: totalPoints?.total || 0,
    averageSpeedMs: avgSpeed?.avg ? Math.round(Number(avgSpeed.avg)) : null,
    bestGenre: bestGenre?.genre || null,
  });
});

app.get('/api/users/:id', async (req, res) => {
  const user = await get('SELECT id, username, avatar_url, created_at FROM users WHERE id = ?', [req.params.id]);
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

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const entries = await all(`
    SELECT u.id, u.username, u.avatar_url, SUM(gs.score) as total_score, COUNT(gs.id) as games_played
    FROM game_scores gs JOIN users u ON u.id = gs.user_id
    GROUP BY u.id ORDER BY total_score DESC LIMIT ?
  `, [limit]);
  res.json(entries);
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

// Admin — comprehensive Spotify diagnostic
app.post('/api/admin/test/spotify', requireAdmin, async (req, res) => {
  const { getValidToken } = await import('./spotify.js');
  const results = [];

  const testEndpoint = async (label, url, token) => {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Blindtest/1.0' },
        redirect: 'follow',
      });
      const body = await r.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = body?.substring(0, 500); }
      results.push({ label, status: r.status, ok: r.ok, body: typeof parsed === 'object' ? parsed : parsed });
    } catch (err) {
      results.push({ label, status: 'FETCH_ERROR', ok: false, body: err.message });
    }
  };

  try {
    const token = await getValidToken();

    // 1. Search (the one we actually use)
    await testEndpoint('search?q=test&type=track&limit=1', 'https://api.spotify.com/v1/search?q=test&type=track&limit=1', token);
    // 2. Search with market=FR (same as production code)
    await testEndpoint('search?q=test&type=track&limit=1&market=FR', 'https://api.spotify.com/v1/search?q=test&type=track&limit=1&market=FR', token);
    // 3. Search with limit=50
    await testEndpoint('search?q=test&type=track&limit=50', 'https://api.spotify.com/v1/search?q=test&type=track&limit=50', token);
    // 4. Artist lookup
    await testEndpoint('artists/0TnOYISbd1XYRBk9myaseg', 'https://api.spotify.com/v1/artists/0TnOYISbd1XYRBk9myaseg', token);
    // 5. No auth (should 401)
    try {
      const r = await fetch('https://api.spotify.com/v1/search?q=test&type=track&limit=1', { redirect: 'follow' });
      const body = await r.text();
      results.push({ label: '(no auth) search', status: r.status, ok: r.ok, body: body?.substring(0, 200) });
    } catch (err) {
      results.push({ label: '(no auth) search', status: 'FETCH_ERROR', ok: false, body: err.message });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, results });
  }
});

app.post('/api/admin/test/genre', requireAdmin, async (req, res) => {
  const { genre } = req.body;
  if (!genre) return res.status(400).json({ error: 'Genre required' });
  try {
    const { getTracksByGenre } = await import('./spotify.js');
    const tracks = await getTracksByGenre(genre, 5);
    res.json({
      ok: true,
      count: tracks.length,
      tracks: tracks.map(t => ({
        name: t.name,
        artist: t.artist,
        previewUrl: !!t.previewUrl,
        genre: t.genre,
      })),
    });
  } catch (err) {
    res.json({ ok: false, count: 0, tracks: [], error: err.message });
  }
});

app.post('/api/admin/test/youtube', requireAdmin, async (req, res) => {
  const { name, artist } = req.body;
  if (!name || !artist) return res.status(400).json({ error: 'Name and artist required' });
  try {
    const { searchYouTubeVideo } = await import('./youtube.js');
    const videoId = await searchYouTubeVideo(name, artist);
    res.json({ ok: true, videoId });
  } catch (err) {
    res.json({ ok: false, videoId: null, error: err.message });
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [userCount, roundCount] = await Promise.all([
    get('SELECT COUNT(*) as count FROM users'),
    get('SELECT COUNT(*) as count FROM round_results'),
  ]);
  res.json({ totalUsers: userCount?.count || 0, totalRounds: roundCount?.count || 0 });
});

app.delete('/api/admin/users/:id/scores', requireAdmin, async (req, res) => {
  await run('DELETE FROM round_results WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM game_scores WHERE user_id = ?', [req.params.id]);
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
  await run('DELETE FROM game_scores WHERE user_id = ?', [req.params.id]);
  await run('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?', [req.params.id, req.params.id]);
  await run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BlindTest server running on port ${PORT}`);
});
