<h1 align="center">
  <br/>
  🎵 BlindTest
  <br/>
  <sub>Real-time multiplayer music guessing game</sub>
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Express-5-black?logo=express" />
  <img src="https://img.shields.io/badge/Socket.io-4-black?logo=socket.io" />
  <img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" />
</p>

<p align="center">
  <strong>Play music → Guess the song → Compete with friends</strong>
</p>

---

## Features

- **4 audio sources** — Spotify previews, Deezer (free, no auth), YouTube full songs, Auto mode
- **Real-time multiplayer** — Socket.io powers live game state, no polling
- **Smart scoring** — Points for artist, title, or both with time bonuses and streaks
- **20 genres** — Pop, Rock, Hip-Hop, R&B, Electronic, Jazz, Classical, Country, Metal, Indie, and more
- **Admin panel** — Live rooms, user management, API diagnostics, database status
- **Guest login** — No Discord required, play instantly
- **Mobile-first** — Responsive UI optimized for phones

## Architecture

```
┌──────────────┐  HTTP/JSON  ┌──────────────┐
│   Next.js 16  │ ◄────────► │   Express 5   │
│   Frontend    │             │   Backend      │
│   (Vercel)    │  Socket.io  │   (Railway)    │
└──────────────┘ Б──Б──Б──Б─Б─└───────┬───────┘
                                ┌──────┼──────┐
                                ▼      ▼      ▼
                           Spotify  Deezer  YouTube
                           (audio)  (audio) (audio)
                                      │
                                 PostgreSQL
                                (users/scores)
```

## Game Flow

```
Create Room → Choose Genres → Choose Audio Source → Start
       ↓
Round Start → Play 30s clip → Players guess → Show answer → Next round
       ↓
Game Over → Podium → Play Again
```

## Quick Start

```bash
# Backend
cd backend && npm install
cp .env.example .env  # Fill in your API keys
npm run dev

# Frontend
cd frontend && npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
```

### Environment Variables

**Backend (`.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes* | Spotify app credentials |
| `SPOTIFY_CLIENT_SECRET` | Yes* | Spotify app credentials |
| `YOUTUBE_API_KEY` | No | YouTube Data API key (scraping fallback works without it) |
| `DISCORD_CLIENT_ID` | No | Discord OAuth for registered users |
| `DISCORD_CLIENT_SECRET` | No | Discord OAuth secret |
| `JWT_SECRET` | Yes | Token signing secret |
| `DATABASE_URL` | No | Postgres URL (auto-uses SQLite if unset) |
| `FRONTEND_URL` | No | `http://localhost:3000` |
| `PORT` | No | `3001` |

*Spoitify is only needed if using Spotify as audio source. Deezer works without any keys.

**Frontend (`.env.local`):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:3001`) |

## Audio Sources

| Source | Auth | Quality | Reliability |
|--------|------|---------|-------------|
| **Spotify** | Client Credentials | 30s preview | Rate limited (429) |
| **Deezer** | None (free) | 30s preview | High, uses genre charts |
| **YouTube** | API key or scraping | Full song | Quota limited |
| **Auto** | — | Best available | Falls through all sources |

When **Auto** is selected, the game tries Spotify → Deezer → YouTube, using whichever returns playable tracks first.

## API Routes

### Game
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/genres` | No | List available genres |
| `POST` | `/api/rooms` | No | Create room |
| `POST` | `/api/rooms/join` | No | Join room |
| `GET` | `/api/rooms/:code` | No | Room status |
| `POST` | `/api/game/:code/settings` | No | Update settings (host only) |
| `POST` | `/api/game/:code/start` | No | Start game (host only) |
| `POST` | `/api/game/:code/leave` | No | Leave room |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | Join room + receive state |
| `game_state` | Server → Client | Full state update |
| `submit_guess` | Client → Server | Submit answer |
| `skip_round` | Client → Server | Skip current round (host/admin) |
| `playback_started` | Client → Server | Audio started playing |
| `play_again` | Client → Server | Reset and start new game |

### Auth & Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/discord` | No | Discord OAuth redirect |
| `GET` | `/api/auth/discord/callback` | No | OAuth callback |
| `POST` | `/api/auth/guest` | No | Guest login (name only) |
| `GET` | `/api/users/me` | JWT | Current user profile |
| `GET` | `/api/users/me/scores` | JWT | User's game history |
| `GET` | `/api/users/me/stats` | JWT | User stats |
| `GET` | `/api/leaderboard` | No | Global ranking |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/stats` | Admin | User/room counts, YouTube status |
| `GET` | `/api/admin/db-status` | Admin | DB type, row counts, connectivity |
| `GET` | `/api/admin/rooms` | Admin | Active room list |
| `GET` | `/api/admin/users` | Admin | All users |
| `PUT` | `/api/admin/users/:id/role` | Admin | Change user role |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user + data |
| `POST` | `/api/admin/test/spotify` | Admin | Test Spotify API connectivity |
| `POST` | `/api/admin/test/genre` | Admin | Test Spotify genre fetch |
| `POST` | `/api/admin/test/deezer` | Admin | Test Deezer API connectivity |
| `POST` | `/api/admin/test/deezer/genre` | Admin | Test Deezer genre fetch |
| `POST` | `/api/admin/test/youtube` | Admin | Test YouTube search |
| `POST` | `/api/admin/test/source-preview` | Admin | Test specific audio source |

## Scoring

- **Artist correct:** +50 pts
- **Title correct:** +50 pts
- **Both correct:** +100 bonus
- **Time bonus:** Up to +150 pts (faster = more)
- **Streak bonus:** Multiplier for consecutive correct answers

Fuzzy matching handles typos, punctuation, and "(feat. ...)" suffixes.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, motion (Framer Motion), Socket.io |
| Backend | Express 5, Socket.io, better-sqlite3 / pg |
| Audio | Spotify Web API, Deezer API (free), YouTube Data API / scraping |
| Auth | Discord OAuth2 + JWT, Guest tokens |
| Database | PostgreSQL (Railway) / SQLite (local) |
| Deployment | Vercel (frontend) + Railway (backend) |

## Project Structure

```
blindtest/
├── backend/
│   └── src/
│       ├── index.js      # Express server, routes, admin endpoints
│       ├── game.js        # GameRoom class, game logic, scoring
│       ├── spotify.js     # Spotify client credentials + genre search
│       ├── deezer.js      # Deezer genre charts + artist top tracks
│       ├── youtube.js     # YouTube Data API + scraping fallback
│       ├── db.js          # Database abstraction (PostgreSQL / SQLite)
│       └── auth.js        # Discord OAuth + JWT middleware
├── frontend/
│   ├── app/
│   │   ├── page.tsx       # Home (create/join/leaderboard)
│   │   ├── game/[code]/
│   │   │   ├── page.tsx   # Game room (WaitingRoom → Playing → Podium)
│   │   │   ├── Chat.tsx
│   │   │   ├── DebugOverlay.tsx
│   │   │   ├── Podium.tsx
│   │   │   └── TrackHistory.tsx
│   │   ├── admin/page.tsx # Admin panel (System, Users, Rooms, Leaderboard, API)
│   │   ├── login/page.tsx # Discord + guest login
│   │   ├── profile/page.tsx
│   │   └── components/
│   │       ├── AudioPlayer.tsx   # YouTube iframe + HTML5 audio
│   │       ├── Header.tsx         # Mobile dropdown nav
│   │       └── SettingsModal.tsx  # Volume, reduced motion, auto-focus
│   ├── context/
│   │   ├── SettingsContext.tsx     # Global settings (volume, motion)
│   │   └── AuthContext.tsx        # Auth state
│   └── lib/
│       ├── api.ts          # All API + WebSocket functions
│       ├── useSound.ts     # Sound effect hook
│       └── debug-context.tsx
└── package.json
```

## License

MIT