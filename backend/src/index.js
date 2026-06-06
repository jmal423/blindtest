import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameRoom } from './game.js';
import { GENRES, getGenreLabel } from './spotify.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const rooms = new Map();

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

app.get('/api/genres', (req, res) => {
  res.json(GENRES.map(g => ({ id: g, label: getGenreLabel(g) })));
});

app.post('/api/rooms', (req, res) => {
  const { genres = ['pop', 'rock'], playerName, rounds, roundTime } = req.body;
  if (!playerName || !playerName.trim()) {
    return res.status(400).json({ error: 'Player name is required' });
  }

  const code = generateCode();
  const room = new GameRoom(code, genres);
  if (rounds || roundTime) room.updateSettings({ rounds, roundTime });
  const playerId = room.addPlayer(playerName.trim());
  rooms.set(code, room);

  res.json({ code, playerId, settings: room.getSettings(), genres: room.genres });
});

app.post('/api/rooms/join', (req, res) => {
  const { code, playerName } = req.body;
  if (!code || !playerName || !playerName.trim()) {
    return res.status(400).json({ error: 'Code and name are required' });
  }

  const room = rooms.get(code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.state !== 'waiting') return res.status(400).json({ error: 'Game already in progress' });

  const playerId = room.addPlayer(playerName.trim());
  res.json({ code: room.code, playerId });
});

app.get('/api/game/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room.getState());
});

app.post('/api/game/:code/settings', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.state !== 'waiting') return res.status(400).json({ error: 'Game already started' });
  if (room.hostId !== req.body.playerId) return res.status(403).json({ error: 'Only the host can change settings' });

  if (req.body.genres && Array.isArray(req.body.genres) && req.body.genres.length > 0) {
    room.genres = req.body.genres;
  }
  room.updateSettings(req.body);
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

app.post('/api/game/:code/submit', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { playerId, answer } = req.body;
  if (!playerId || !answer) {
    return res.status(400).json({ error: 'playerId and answer required' });
  }

  const result = room.submitAnswer(playerId, answer.trim());
  if (!result) return res.status(400).json({ error: 'Cannot submit now' });
  res.json(result);
});

app.post('/api/game/:code/leave', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { playerId } = req.body;
  room.players = room.players.filter(p => p.id !== playerId);

  if (room.players.length === 0) {
    room.destroy();
    rooms.delete(req.params.code.toUpperCase());
  }

  res.json({ ok: true });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BlindTest server running on port ${PORT}`);
});
