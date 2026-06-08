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

- **Deezer audio** — Free 30s previews, no API keys needed, genre charts sorted by popularity
- **Song cache with recency weighting** — Fetched tracks persist in DB; recently played songs are exponentially less likely to reappear (never=1.0, <1h=0.05, <1d=0.2, <1w=0.5, older=0.85)
- **Real-time multiplayer** — Socket.io for live game state, no polling
- **Smart scoring** — Artist 3pts, title 3pts, both 4pts combo + speed + streak bonuses
- **16 genres + Top 100** — Pop, Rock, Hip-Hop, R&B, Electronic, Jazz, Classical, Country, Metal, Indie, Soul, Blues, Reggae, Latin, Dance, and the global Top 100 chart
- **Skip vote system** — Host/admin skips instantly, players vote (majority wins)
- **Track history sidebar** — Reversed (last played on top), skipped tracks shown with ⏭ + strikethrough + dimmed
- **Chat clears per round** — `chat_clear` socket event wipes stale messages each round
- **Leaderboard** — Global ranking with wins, avatars, clickable player detail panels; sidebar on dashboard
- **Persistent stats** — Discord-authenticated players; games, points, perfects, best genre, avg speed
- **Discord OAuth2** — Required for access; server-gated to a specific guild; sessions persist across deploys (365-day JWT)
- **Discord server gating** — Restrict access to a specific Discord guild
- **Multi-language** — English, Français, Português, Español (persisted in localStorage)
- **Volume control** — Default 20%, mute + slider, `M` key shortcut
- **Admin panel** — Live rooms, user management, genre tester, song cache stats, database monitoring

---

## Architecture

```
┌──────────────┐  HTTP/JSON  ┌──────────────────────┐
│   Next.js 16  │ ◄────────► │   Express 5           │
│   Frontend    │             │   Backend             │
│   (Vercel)    │  Socket.io  │   (Railway)           │
└──────────────┘ ─────────── └───────┬───────────────┘
                                ┌─────┴─────┐
                                ▼           ▼
                              Deezer     PostgreSQL
                              (audio)    (games, stats,
                                          users, songs)
```

## Game Flow

```
Create Room → Choose Genres → Start
       ↓
Round: Play audio → Chat clears → Timer starts → Guess → Score → Next round
       ↓
Game Over → Podium → Auto-save to DB → Play Again / Main Menu
```

- Round timer starts after all connected players report audio ready (fallback timeout)
- Cache-first track selection: queries `songs_cache` with recency weighting before hitting Deezer API
- Tracks without available audio are automatically skipped
- Skip votes show live tally (host/admin skips instantly)

---

## Quick Start

```bash
# Start PostgreSQL
docker compose up -d

# Backend
cd backend && npm install
cp .env.example .env  # Fill in your variables
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
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth2 application ID |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth2 secret |
| `DISCORD_ALLOWED_GUILD_ID` | Yes | Discord server ID to gate access |
| `ADMIN_DISCORD_IDS` | No | Comma-separated Discord IDs for admin role |
| `JWT_SECRET` | Yes | Token signing secret (generate a random string) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NODE_ENV` | No | Set to `production` for SSL with self-signed certs |
| `FRONTEND_URL` | No | CORS origin + OAuth redirect base |
| `PORT` | No | `3001` |

**Frontend (`.env.local`):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:3001`) |

---

## Audio Source

| Source | Auth | Quality | Notes |
|--------|------|---------|-------|
| **Deezer** | None (free) | 30s preview | Genre charts sorted by popularity rank; cached in PostgreSQL with recency-weighted selection |

---

## Scoring

- **Artist correct:** +3 pts
- **Title correct:** +3 pts
- **Both correct:** +4 pts combo bonus
- **Speed bonus:** 1st to find both +3, 2nd +2, 3rd +1
- **Streak bonus:** 2 consecutive both-found +2, 3+ consecutive +4

Fuzzy matching splits multi-part titles on `-`, `,`, `feat.` and checks each part. Typo tolerance via Levenshtein distance.

---

## Database

### Local development
PostgreSQL via Docker — `docker compose up -d` starts a Postgres 16 container with persistent volume.

### Production (Railway)
Add the PostgreSQL plugin to your Railway project. `DATABASE_URL` is auto-set. The backend uses `pg.Pool` with connection retry and health checks.

### Schema

| Table | Purpose |
|-------|---------|
| `users` | Discord OAuth users (id, discord_id, username, avatar, role) |
| `games` | Game sessions (id, code, genres, rounds, status, timestamps) |
| `game_players` | Players per game (player_id, player_name, score, position) |
| `round_results_v2` | Detailed per-guess data (track, artist, genre, guess, found_artist/title/both, time_ms) |
| `songs_cache` | Cached tracks from Deezer (id, title, artist, genre, preview_url, rank) |
| `songs_played` | Play history for recency weighting (song_id, played_at) |
| `friendships` | Friend requests and accepted friendships |
| `game_scores` | Legacy per-game scores |
| `round_results` | Legacy per-guess data |

### Migrations
Migrations run automatically on startup from `backend/src/migrations/`:

| File | Description |
|------|-------------|
| `001_initial.js` | Core tables (users, game_scores, friendships, round_results) |
| `002_indexes.js` | Performance indexes on user_id, game_id, genre, played_at |
| `003_games_and_rounds.js` | Games, game_players, round_results_v2 tables with indexes |
| `004_song_cache.js` | songs_cache and songs_played tables with genre + recency indexes |

### Auto-save behavior
- **Game start** → Inserts row into `games` table
- **Every guess** → Inserts row into `round_results_v2` (all players, not just authenticated)
- **Game end** → Marks game as `finished`, inserts all players into `game_players`, upserts all players into `users` table via `ensureUser()`
- **Round end** → Calls `recordPlay()` to track song recency in `songs_played`
- **After Deezer fetch** → Calls `cacheSongs()` to upsert tracks into `songs_cache`

See `DEPLOY.md` for full deployment guide.

---

## API Routes

### Game
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/genres` | No | List available genres |
| `POST` | `/api/rooms` | JWT | Create room |
| `POST` | `/api/rooms/join` | JWT | Join room (works mid-game) |
| `GET` | `/api/rooms/:code` | No | Room status |
| `POST` | `/api/game/:code/settings` | No | Update settings (host only) |
| `POST` | `/api/game/:code/start` | No | Start game (host only) |
| `POST` | `/api/game/:code/leave` | No | Leave room |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | Join room + receive state |
| `game_state` | Server → Client | Full state update (state, players, settings, track info) |
| `submit_guess` | Client → Server | Submit artist/title guess |
| `skip_round` | Client → Server | Vote to skip (host/admin skips instantly) |
| `playback_started` | Client → Server | Audio started playing |
| `kick_player` | Client → Server | Admin removes a player |
| `kicked` | Server → Client | You were removed |
| `play_again` | Client → Server | Reset and start new game |
| `guess_made` | Server → Client | Another player guessed (for progress bar) |
| `new_chat_message` | Server → Client | Chat message or system notification |
| `chat_clear` | Server → Client | Clears chat at start of each round |

### Auth & Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/discord` | No | Discord OAuth redirect |
| `GET` | `/api/auth/discord/callback` | No | OAuth callback |
| `GET` | `/api/users/me` | JWT | Current user profile |
| `GET` | `/api/users/me/scores` | JWT | User's game scores (legacy) |
| `GET` | `/api/users/me/stats` | JWT | Enhanced stats (games, points, perfects, avg speed, best genre) |
| `GET` | `/api/users/me/history` | JWT | Player's game history |
| `GET` | `/api/users/:id/stats` | No | Public user stats |
| `GET` | `/api/leaderboard` | No | Global ranking (v2 with wins, avatars) |
| `GET` | `/api/games/recent` | No | Recent completed games |
| `GET` | `/api/games/:id` | No | Full game details with players and rounds |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | DB connectivity, uptime, table counts |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/stats` | Admin | User/game/round/song cache counts |
| `GET` | `/api/admin/db-status` | Admin | DB type, row counts, connectivity |
| `GET` | `/api/admin/rooms` | Admin | Active room list with state |
| `GET` | `/api/admin/users` | Admin | All users |
| `PUT` | `/api/admin/users/:id/role` | Admin | Change user role |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user + all data |
| `DELETE` | `/api/admin/users/:id/scores` | Admin | Wipe user scores (round_results_v2 + game_players) |
| `POST` | `/api/admin/test/genre` | Admin | Test Deezer genre fetch |
| `POST` | `/api/admin/test/deezer` | Admin | Test Deezer API connection |
| `POST` | `/api/game/:code/test-source` | No | Test audio source for a room |
| `POST` | `/api/admin/test/seed-game/:code` | Admin | Inject mock tracks and start a game |
| `POST` | `/api/admin/test/start-round/:code` | Admin | Force start current round |

---

## Languages

| Flag | Language | Code |
|------|----------|------|
| 🇬🇧 | English | `en` |
| 🇫🇷 | Français | `fr` |
| 🇧🇷 | Português | `pt` |
| 🇪🇸 | Español | `es` |

Switch from main menu, header dropdown, or settings modal. Language is persisted to `localStorage`.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, motion (Framer Motion), Socket.io |
| Backend | Express 5, Socket.io, pg (PostgreSQL) |
| Audio | Deezer API (free, no auth), song cache with recency weighting |
| Auth | Discord OAuth2 + JWT (guild-gated, 365-day sessions) |
| i18n | Custom JSON-based (en, fr, pt, es), persisted in localStorage |
| Database | PostgreSQL (Docker local, Railway production), migration system |
| Deployment | Vercel (frontend) + Railway (backend + PostgreSQL) |

---

## Project Structure

```
blindtest/
├── DEPLOY.md                  # Railway + Vercel deployment guide
├── backend/
│   ├── .env.example           # All environment variables documented
│   ├── railway.json            # Railway deployment config
│   └── src/
│       ├── index.js           # Express server, routes, admin endpoints
│       ├── game.js            # GameRoom class, game logic, scoring, skip votes, song cache
│       ├── deezer.js          # Deezer genre charts + artist top tracks, rank sorting, GENRES
│       ├── db.js              # PostgreSQL pool, queries, migrations, song cache, recency weighting
│       ├── auth.js            # Discord OAuth + JWT middleware + guild gating
│       └── migrations/
│           ├── 001_initial.js        # Core tables (users, game_scores, friendships, round_results)
│           ├── 002_indexes.js         # Performance indexes
│           ├── 003_games_and_rounds.js  # Games, game_players, round_results_v2
│           └── 004_song_cache.js      # songs_cache, songs_played, recency indexes
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Dashboard (create/join room + leaderboard sidebar)
│   │   ├── leaderboard/
│   │   │   └── page.tsx       # Full leaderboard with clickable player detail panels
│   │   ├── game/[code]/
│   │   │   ├── page.tsx       # Game room (WaitingRoom → Playing → Podium)
│   │   │   ├── Chat.tsx       # Chat with chat_clear support
│   │   │   ├── Podium.tsx     # Endgame rankings
│   │   │   └── TrackHistory.tsx # Reversed history, skipped tracks (⏭ + strikethrough)
│   │   ├── admin/page.tsx     # Admin (stats, users, rooms, leaderboard, genre tester)
│   │   ├── login/page.tsx     # Discord login
│   │   ├── profile/page.tsx   # Profile with 8 stat cards
│   │   └── components/
│   │       ├── AudioPlayer.tsx        # HTML5 <audio> only (Deezer previews)
│   │       ├── Header.tsx             # Profile dropdown with language + stats (score, games, best genre)
│   │       ├── SettingsModal.tsx       # Volume (default 20%), auto-focus, theme, language
│   │       ├── LanguageSwitcher.tsx    # Flag button grid
│   │       └── LanguageInitializer.tsx # Sets <html lang> from settings
│   ├── context/
│   │   ├── SettingsContext.tsx  # Volume (0.2 default), accessibility, theme, language
│   │   └── AuthContext.tsx      # Auth state
│   ├── lib/
│   │   ├── api.ts            # All API + WebSocket functions (Deezer-only)
│   │   ├── useTranslation.ts # i18n hook (t, language, setLanguage)
│   │   ├── useSound.ts       # Sound effect hook
│   │   └── debug-context.tsx
│   └── locales/
│       ├── en.json           # English keys
│       ├── fr.json           # French keys
│       ├── pt.json           # Portuguese keys
│       └── es.json           # Spanish keys
└── README.md
```

---

## License

MIT