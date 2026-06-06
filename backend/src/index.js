import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameRoom } from './game.js';
import { GENRES, getGenreLabel } from './spotify.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

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
  const genreList = GENRES.map(g => ({ id: g, label: getGenreLabel(g) }));
  res.json(genreList);
});

app.post('/api/rooms', (req, res) => {
  const { genres } = req.body;
  if (!genres || !Array.isArray(genres) || genres.length === 0) {
    return res.status(400).json({ error: 'At least one genre is required' });
  }

  const code = generateCode();
  const room = new GameRoom(code, genres);
  rooms.set(code, room);

  res.json({ code, genres });
});

app.post('/api/rooms/join', (req, res) => {
  const { code } = req.body;
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  if (room.state !== 'waiting') {
    return res.status(400).json({ error: 'Game already in progress' });
  }

  res.json({
    code: room.code,
    genres: room.genres,
    playerCount: room.players.length,
  });
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerName = null;

  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.state !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    currentRoom = code;
    playerName = name;
    socket.join(code);

    const player = room.addPlayer(socket.id, name);
    io.to(code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
    });
  });

  socket.on('start_game', async () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const host = room.players[0];
    if (host?.id !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }

    await room.startGame(io);
  });

  socket.on('submit_answer', ({ answer }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.submitAnswer(socket.id, answer);
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.removePlayer(socket.id);
        io.to(currentRoom).emit('player_left', {
          players: room.players.map(p => ({ id: p.id, name: p.name })),
        });

        if (room.players.length === 0) {
          room.destroy();
          rooms.delete(currentRoom);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BlindTest server running on port ${PORT}`);
});
