import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { GameRoom } from './game.js';
import { GENRES, getGenreLabel, GENRE_GROUPS } from './deezer.js';
import { generateId, get, all, run, ping, getTableCounts, createGame, finishGame, addGamePlayer, addRoundResultV2, getGameHistory, getPlayerStats, getLeaderboardV2, getRecentGames, getGameDetails, getSongCacheCounts, getSongCacheByGenre, getPlayedSongs, getAiEnrichmentStats, getAiGenreDistribution, getUnprocessedTracks, getCuratedSongsStats, getCuratedSongsByGenreGrouped, getCuratedSongsByGenreRaw, getUnverifiedCuratedSongs, updateCuratedSongGenre, addCuratedSong, setCuratedVerified, getDiscoveryCandidates, getDiscoveryCandidatesAll, searchAiEnrichedTracks, getRecentAiEnrichedTracks, getSongById } from './db.js';
import { getAuthUrl, handleDiscordCallback, exchangeDiscordCode, exchangeDiscordAccessToken, authenticate, requireAdmin, tryDecodeToken } from './auth.js';

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
const flagCounts = new Map();

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
    const target = room.getPlayer(targetPlayerId);
    if (target?.role === 'admin') return;
    room.kickPlayer(targetPlayerId);
  });

  socket.on('transfer_host', (targetPlayerId) => {
    const info = socketPlayerMap.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.roomCode);
    if (!room) return;
    if (info.playerId !== room.hostId) return;
    const target = room.getPlayer(targetPlayerId);
    if (!target) return;
    room.hostId = targetPlayerId;
    room.broadcast();
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

  socket.on('flag_song', async ({ songId, reason }) => {
    if (!songId || !reason) return;
    const info = socketPlayerMap.get(socket.id);
    if (!info || !info.roomCode) return;

    const roomFlags = flagCounts.get(info.roomCode);
    const playerFlags = roomFlags?.get(info.playerId) || 0;
    if (playerFlags >= 5) {
      return socket.emit('flag_result', { ok: false, error: 'Max 5 flags per game' });
    }

    try {
      const { addSongFlag, getFlagCount } = await import('./db.js');
      await addSongFlag(generateId(), songId, info.playerId, info.roomCode, reason);

      if (!flagCounts.has(info.roomCode)) flagCounts.set(info.roomCode, new Map());
      flagCounts.get(info.roomCode).set(info.playerId, playerFlags + 1);

      const cnt = await getFlagCount(songId);
      console.log(`[Flag] ${info.playerId} flagged ${songId} (${reason}) — ${cnt} unique flags`);

      if (cnt >= 3) {
        await setCuratedVerified(songId, false);
        console.log(`[Flag] ${songId} demoted (${cnt} unique flags)`);
        socket.emit('flag_result', { ok: true, demoted: true, flags: cnt });
      } else {
        const needed = 3 - cnt;
        socket.emit('flag_result', { ok: true, demoted: false, flags: cnt, needed });
      }
    } catch (err) {
      console.error(`[Flag] Error:`, err);
      socket.emit('flag_result', { ok: false, error: 'Failed to flag' });
    }
  });

  socket.on('disconnect', () => {
    const info = socketPlayerMap.get(socket.id);
    if (info) {
      const room = rooms.get(info.roomCode);
      if (room) {
        room.setPlayerSocket(info.playerId, null);
        
        // Wait 10 seconds before deciding to remove the player
        setTimeout(() => {
          if (room.playerSockets[info.playerId] === null) {
            if (room.state === 'waiting' || room.state === 'game_over') {
              room.removePlayer(info.playerId);
              cleanupRoom(info.roomCode);
            }
          }
        }, 10000);
      }
    }
    socketPlayerMap.delete(socket.id);
  });
});

function broadcastState(code) {
  const room = rooms.get(code);
  if (room) {
    io.to(code).emit('game_state', room.getState());
  }
}

function findRoomByUserId(userId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.userId === userId)) return room;
  }
  return null;
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.players.length === 0 && room.state !== 'playing') {
    room.destroy();
    rooms.delete(code);
    flagCounts.delete(code);
  }
}

// Clean up stale rooms every 30 seconds
setInterval(() => {
  for (const [code, room] of rooms) {
    const hasActivePlayers = room.players.some(p => room.playerSockets[p.id] !== undefined && room.playerSockets[p.id] !== null);
    if (!hasActivePlayers) {
      room.destroy();
      rooms.delete(code);
    }
  }
}, 30000);

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
  const genreGroupMap = {};
  for (const group of GENRE_GROUPS) {
    for (const g of group.genreIds) {
      genreGroupMap[g] = group.id;
    }
  }
  res.json({
    genres: GENRES.map(g => ({ id: g, label: getGenreLabel(g), group: genreGroupMap[g] || null })),
    groups: GENRE_GROUPS,
  });
});

// Rooms (auth required)
app.post('/api/rooms', authenticate, async (req, res) => {
  const { genres = [], artists = [], gameMode = 'genre', rounds, roundTime, discordChannelId } = req.body;

  const user = await get('SELECT id, username, avatar_url, role FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  // If discordChannelId provided, check if there's already a room for this channel
  if (discordChannelId) {
    for (const room of rooms.values()) {
      if (room.discordChannelId === discordChannelId && room.state === 'waiting') {
        const existing = room.players.find(p => p.userId === user.id);
        if (existing) {
          broadcastState(room.code);
          return res.json({ code: room.code, playerId: existing.id, settings: room.getSettings(), genres: room.genres, artists: room.artists });
        }
        const playerId = room.addPlayer(user.username, user.avatar_url, user.role, user.id);
        broadcastState(room.code);
        return res.json({ code: room.code, playerId, settings: room.getSettings(), genres: room.genres, artists: room.artists });
      }
    }
  }

  const existing = findRoomByUserId(user.id);
  if (existing) existing.removePlayer(existing.players.find(p => p.userId === user.id)?.id);

  const code = generateCode();
  const room = new GameRoom(code, genres, io);
  room.artists = artists;
  room.discordChannelId = discordChannelId || null;
  room.updateSettings({ gameMode });
  if (rounds || roundTime) room.updateSettings({ rounds, roundTime });
  const playerId = room.addPlayer(user.username, user.avatar_url, user.role, user.id);
  rooms.set(code, room);

  res.json({ code, playerId, settings: room.getSettings(), genres: room.genres, artists: room.artists });
});

app.get('/api/rooms/by-channel/:channelId', authenticate, (req, res) => {
  const { channelId } = req.params;
  for (const room of rooms.values()) {
    if (room.discordChannelId === channelId && room.state === 'waiting') {
      return res.json({ code: room.code, state: room.state, playerCount: room.players.length });
    }
  }
  res.json({ code: null });
});

app.post('/api/rooms/join', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Room code is required' });

  const user = await get('SELECT id, username, avatar_url, role FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const room = rooms.get(code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const existingOther = findRoomByUserId(user.id);
  if (existingOther && existingOther.code !== room.code) {
    existingOther.removePlayer(existingOther.players.find(p => p.userId === user.id)?.id);
  }

  const existing = room.players.find(p => p.userId === user.id);
  if (existing) {
    broadcastState(room.code);
    return res.json({ code: room.code, playerId: existing.id });
  }

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
    artists: room.artists,
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
  if (req.body.artists !== undefined && Array.isArray(req.body.artists)) {
    room.artists = req.body.artists;
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
  room.removePlayer(playerId);
  cleanupRoom(room.code);

  res.json({ ok: true });
});

// Auth
app.get('/api/auth/discord', (req, res) => {
  const redirectUrl = typeof req.query.redirect === 'string' ? req.query.redirect : null;
  const url = getAuthUrl(req.headers.host, redirectUrl);
  res.redirect(url);
});

app.post('/api/auth/discord/activity', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const result = await exchangeDiscordCode(code, req.headers.host);
    res.json({ token: result.token, user: result.user, access_token: result.access_token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
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
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const games = await getGameHistory(req.user.userId, limit);
    
    // Map to legacy game_scores format for the frontend
    const scores = games.map(g => ({
      id: g.id,
      user_id: req.user.userId,
      game_code: g.code,
      score: g.score,
      total_rounds: g.rounds,
      played_at: g.created_at
    }));
    
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

app.get('/api/users/me/current-room', authenticate, (req, res) => {
  const room = findRoomByUserId(req.user.userId);
  if (!room) return res.json({ room: null });

  const player = room.players.find(p => p.userId === req.user.userId);
  res.json({
    room: {
      code: room.code,
      state: room.state,
      genres: room.genres,
      playerCount: room.players.length,
      playerScore: player?.score || 0,
      currentRound: room.tracksPlayed + 1,
      totalRounds: room.totalRounds,
      settings: room.getSettings(),
    },
  });
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
    console.error('[DB] Recent games failed:', err.message);
    res.json([]);
  }
});

app.get('/api/artist-groups', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src', 'artist-groups.json');
    const data = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Failed to read artist groups:', err);
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
function getUserPresence(userId) {
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.userId === userId);
    if (player) {
      // Check if player socket is active in room
      const socketId = room.playerSockets[player.id];
      if (socketId) {
        if (room.state === 'waiting') {
          return { status: 'lobby', roomCode: room.code };
        } else if (room.state !== 'game_over') {
          return { status: 'playing', roomCode: room.code };
        }
      }
    }
  }
  return { status: 'offline', roomCode: null };
}

// Memory-based invites storage: { id, fromUser, fromUserId, toUserId, roomCode, expiresAt }
let activeInvites = [];

function cleanupInvites() {
  const now = Date.now();
  activeInvites = activeInvites.filter(inv => inv.expiresAt > now);
}

app.get('/api/users/search', authenticate, async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.json([]);
  }
  const searchPattern = `%${query.toLowerCase()}%`;
  try {
    const matches = await all(`
      SELECT u.id, u.username, u.avatar_url, f.status, f.user_id AS friendship_sender
      FROM users u
      LEFT JOIN friendships f ON 
        (f.user_id = ? AND f.friend_id = u.id) OR 
        (f.user_id = u.id AND f.friend_id = ?)
      WHERE (LOWER(u.username) LIKE ? OR u.id = ?) AND u.id != ?
      LIMIT 10
    `, [req.user.userId, req.user.userId, searchPattern, query, req.user.userId]);
    res.json(matches);
  } catch (err) {
    console.error('Failed to search users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

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

  const friendsWithPresence = friends.map(f => ({
    ...f,
    presence: getUserPresence(f.id)
  }));

  res.json({ friends: friendsWithPresence, pending });
});

// Lobby Invite Endpoints
app.post('/api/game/:code/invite/:friendId', authenticate, async (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const friend = await get('SELECT id, username FROM users WHERE id = ?', [req.params.friendId]);
  if (!friend) return res.status(404).json({ error: 'Friend not found' });

  // Verify friendship
  const friendship = await get(
    'SELECT * FROM friendships WHERE status = \'accepted\' AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))',
    [req.user.userId, friend.id, friend.id, req.user.userId]
  );
  if (!friendship) return res.status(403).json({ error: 'You can only invite friends' });

  cleanupInvites();
  // Filter out any existing active invites to this same friend for this room
  activeInvites = activeInvites.filter(
    inv => !(inv.toUserId === friend.id && inv.roomCode === room.code)
  );

  const invite = {
    id: generateId(),
    fromUser: req.user.username,
    fromUserId: req.user.userId,
    toUserId: friend.id,
    roomCode: room.code,
    expiresAt: Date.now() + 60000 // 60 seconds
  };
  activeInvites.push(invite);

  res.json({ ok: true });
});

app.get('/api/invites', authenticate, (req, res) => {
  cleanupInvites();
  const myInvites = activeInvites.filter(inv => inv.toUserId === req.user.userId);
  res.json(myInvites);
});

app.delete('/api/invites/:inviteId', authenticate, (req, res) => {
  cleanupInvites();
  activeInvites = activeInvites.filter(
    inv => !(inv.id === req.params.inviteId && inv.toUserId === req.user.userId)
  );
  res.json({ ok: true });
});

app.post('/api/friends/request/:userId', authenticate, async (req, res) => {
  const target = await get(
    'SELECT id FROM users WHERE id = ? OR LOWER(username) = LOWER(?)',
    [req.params.userId, req.params.userId]
  );
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (target.id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot friend yourself' });
  }

  const existing = await get(
    'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    [req.user.userId, target.id, target.id, req.user.userId]
  );

  if (existing) {
    return res.status(400).json({ error: 'Friendship already exists or pending' });
  }

  await run(
    'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
    [req.user.userId, target.id, 'pending']
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
    res.json({ ok: true, count: tracks.length, tracks: tracks.map(t => ({ name: t.name, artist: t.artist, previewUrl: !!t.previewUrl, genre: t.genre, genres: t.genres, chartSource: t.chartSource })) });
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
    { id: 'deezer:1', name: 'Bohemian Rhapsody', artist: 'Queen', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 355000, genre: 'rock', genres: ['rock'], chartSource: 'rock' },
    { id: 'deezer:2', name: 'Billie Jean', artist: 'Michael Jackson', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 294000, genre: 'pop', genres: ['pop'], chartSource: 'pop' },
    { id: 'deezer:3', name: 'Smells Like Teen Spirit', artist: 'Nirvana', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 301000, genre: 'rock', genres: ['rock'], chartSource: 'rock' },
    { id: 'deezer:4', name: 'Like a Prayer', artist: 'Madonna', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 280000, genre: 'pop', genres: ['pop'], chartSource: 'pop' },
    { id: 'deezer:5', name: 'Stairway to Heaven', artist: 'Led Zeppelin', albumImage: null, previewUrl: 'https://cdns-preview.dz.example.mp3', durationMs: 482000, genre: 'rock', genres: ['rock'], chartSource: 'rock' },
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

app.get('/api/admin/ai/stats', requireAdmin, async (req, res) => {
  let stats = { total: 0, processed: 0, unprocessed: 0, errors: 0, last_processed: null };
  let distribution = [];
  let unprocessedTracks = [];
  try { stats = await getAiEnrichmentStats(); } catch (err) { console.error('ai stats query failed:', err.message); }
  try { distribution = await getAiGenreDistribution(); } catch (err) { console.error('ai distribution query failed:', err.message); }
  try { unprocessedTracks = await getUnprocessedTracks(20); } catch (err) { console.error('ai unprocessed query failed:', err.message); }
  res.json({ ok: true, ...stats, distribution, unprocessedTracks });
});

app.get('/api/admin/ai/search', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  if (!q) return res.json({ ok: true, tracks: [] });

  const pattern = `%${q}%`;
  try {
    const tracks = await searchAiEnrichedTracks(pattern, limit);
    res.json({ ok: true, tracks });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, tracks: [] });
  }
});

app.get('/api/admin/ai/unclassified', requireAdmin, async (req, res) => {
  try {
    const { getUnclassifiedTracks } = await import('./db/repositories/songRepository.js');
    const tracks = await getUnclassifiedTracks();
    res.json({ ok: true, tracks });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, tracks: [] });
  }
});

app.post('/api/admin/ai/update-genre', requireAdmin, async (req, res) => {
  try {
    const { id, genre } = req.body;
    if (!id || !genre) return res.status(400).json({ ok: false, error: 'Missing id or genre' });
    const { updateSongGenre } = await import('./db/repositories/songRepository.js');
    await updateSongGenre(id, genre);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/ai/track/:id', requireAdmin, async (req, res) => {
  try {
    const { run } = await import('./db/connection.js');
    await run('DELETE FROM songs_cache WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/ai/recent', requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const tracks = await getRecentAiEnrichedTracks(limit);
    res.json({ ok: true, tracks });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, tracks: [] });
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
  const [counts, genres, played] = await Promise.all([
    getSongCacheCounts().catch(() => ({ total: 0, genres: 0, plays: 0 })),
    getSongCacheByGenre().catch(() => []),
    getPlayedSongs(200).catch(() => []),
  ]);
  res.json({ ...counts, genres, played });
});

app.get('/api/admin/curated/stats', requireAdmin, async (req, res) => {
  try {
    const [stats, byGenre] = await Promise.all([
      getCuratedSongsStats().catch(() => ({ total: 0, verified: 0, unverified: 0, total_plays: 0, genres: 0 })),
      getCuratedSongsByGenreGrouped().catch(() => []),
    ]);
    res.json({ ...stats, byGenre });
  } catch (err) {
    res.json({ total: 0, verified: 0, unverified: 0, total_plays: 0, genres: 0, byGenre: [] });
  }
});

app.get('/api/admin/curated/by-genre', requireAdmin, async (req, res) => {
  try {
    const rows = await getCuratedSongsByGenreRaw(req.query.genre);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/admin/curated/unverified', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || null;
    const result = await getUnverifiedCuratedSongs(limit, offset, search);
    res.json(result);
  } catch (err) {
    console.error('[Admin] Unverified fetch error:', err);
    res.json({ songs: [], total: 0 });
  }
});



app.get('/api/admin/curated/discovery', requireAdmin, async (req, res) => {
  try {
    const genre = req.query.genre || null;
    const tracks = genre
      ? await getDiscoveryCandidates(genre, 50)
      : await getDiscoveryCandidatesAll(100);
    res.json(tracks);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/admin/curated/import', requireAdmin, async (req, res) => {
  try {
    const { songIds, genre } = req.body;
    if (!songIds?.length) return res.json({ ok: false, error: 'No song IDs' });
    let imported = 0;
    for (const id of songIds) {
      const s = await getSongById(id);
      if (!s) continue;
      await addCuratedSong({
        id: s.id, name: s.name, artist: s.artist,
        previewUrl: s.preview_url, durationMs: s.duration_ms,
        genre: genre || s.genre || 'other',
        chartSource: s.chart_source,
        verified: false,
      });
      imported++;
    }
    res.json({ ok: true, imported });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/curated/verify', requireAdmin, async (req, res) => {
  try {
    const { songId, verified } = req.body;
    await setCuratedVerified(songId, verified !== false);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/curated/update-genre', requireAdmin, async (req, res) => {
  try {
    const { songId, genre } = req.body;
    await updateCuratedSongGenre(songId, genre);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/curated/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM curated_songs WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/tracks/:id/preview', requireAdmin, async (req, res) => {
  try {
    const rawId = req.params.id.replace('deezer:', '');
    const response = await fetch(`https://api.deezer.com/track/${rawId}`);
    const data = await response.json();
    if (data && data.preview) {
      res.json({ ok: true, previewUrl: data.preview });
    } else {
      res.json({ ok: false, error: 'No preview available' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/rooms', requireAdmin, (req, res) => {
  const list = [];
  for (const [code, room] of rooms) {
    list.push({
      code,
      state: room.state,
      playerCount: room.players.length,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        avatarUrl: p.avatarUrl,
        role: p.role,
        userId: p.userId,
      })),
      genres: room.genres,
      currentRound: room.tracksPlayed + 1,
      totalRounds: room.totalRounds,
      settings: room.getSettings(),
    });
  }
  list.sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0));
  res.json(list);
});

app.post('/api/admin/rooms/:code/start', requireAdmin, async (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const error = await room.startGame();
  if (error) return res.status(400).json({ error });
  res.json({ ok: true });
});

app.post('/api/admin/rooms/:code/kick/:playerId', requireAdmin, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  const target = room.getPlayer(req.params.playerId);
  if (target?.role === 'admin') return res.status(403).json({ ok: false, error: 'Cannot kick another admin' });
  const removed = room.kickPlayer(req.params.playerId);
  if (!removed) return res.status(404).json({ ok: false, error: 'Player not found' });
  res.json({ ok: true });
});

app.delete('/api/admin/rooms/:code', requireAdmin, (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  room.destroy();
  rooms.delete(room.code);
  res.json({ ok: true });
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
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`BlindTest server running on ${HOST}:${PORT}`);
});
