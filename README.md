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

- **Deezer audio** — Free 30s previews, no API keys needed; genre charts sorted by popularity
- **Album genre enrichment** — Tracks are tagged with their album's actual genres (via `/album/{id}`), decoupled from chart search context
- **Song cache with recency weighting** — Fetched tracks persist in DB; recently played songs are exponentially less likely to reappear
- **Real-time multiplayer** — Socket.io for live game state, no polling
- **Smart scoring** — Artist 3pts, title 3pts, both 4pts combo + speed + streak bonuses
- **37 genres** — Pop, Rock, Hip-Hop, R&B, Electronic, Jazz, Classical, Country, Metal, Indie, Soul, Blues, Reggae, Latin, Dance
- **Skip vote system** — Host/admin skips instantly, players vote (majority wins)
- **Track history sidebar** — Reversed (last played on top), skipped tracks shown with ⏭ + strikethrough + dimmed
- **Chat clears per round** — `chat_clear` socket event wipes stale messages each round
- **Leaderboard** — Global ranking with wins, avatars, clickable player detail panels
- **Persistent stats** — Discord-authenticated players; games, points, perfects, best genre, avg speed
- **Discord OAuth2** — Required for access; server-gated to a specific guild; 365-day JWT sessions
- **Multi-language** — English, Français, Português, Español (persisted in localStorage)
- **Volume control** — Default 20%, mute + slider, `M` key shortcut
- **Admin panel** — Live rooms, user management, genre tester, song cache stats, database monitoring
- **Developer Debug Overlay** — Collapsible client-side dev console showing active track metadata (deezer title/artist, genre, charts rank), audio offset details, clipboard exporters, and player guess status indicators

---

## UI/UX Redesign

- **Theme-Sensitive Radial Background** — Tailored gradients for both Dark Mode (dark violet mesh) and Light Mode (bright white/grey mesh).
- **Glassmorphism Styling** — Semi-transparent cards, neon accents, and backdrop blurs applied site-wide.
- **Visual Top-3 Podium** — Leaderboard includes 1st (Gold, crown badge), 2nd (Silver), and 3rd (Bronze) columns, a scrollable runners-up list, and an inspector side drawer.
- **Sticky Glass Navigation** — Sticky header navigation bar with profile and stats dropdown popovers.
- **Accounts Card** — Centered login page inside a glowing glass card container.
- **Responsive Waiting Room** — Grid-based lobby adjusting to two-column panels on desktop screens with animated genre accordions.
- **iOS-style Toggles & Custom Sliders** — Settings elements feature spring-animated knobs and custom progress tracks.
- **Overhauled Debug Console** — Minimizable bottom-right floating badge (emerald/rose socket connection heartbeat + active round tracker) that expands into a full tabbed window (🎵 Track, 👥 Players, ⚙️ Rules) with a one-click formatted JSON game state copy tool.

---

## Architecture

```
┌──────────────┐             ┌──────────────────────┐
│  Next.js 16  │  HTTP/JSON  │   Express 5           │
│  Frontend    │ ◄────────► │   Backend              │
│              │  Socket.io  │                        │
└──────────────┘ ─────────── └───────┬───────────────┘
                                ┌─────┴─────┐
                                ▼           ▼
                              Deezer     PostgreSQL
                              (audio)    (games, stats,
                                          users, songs)
```

Self-hosted on OptiPlex 790 (i5, Ubuntu 26.04 LTS) behind a Cloudflare Tunnel on `blindtest.jl423.xyz`.

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

### Developer Mode

For admin users, a real-time developer overlay is available in the game lobby.
1. Log in with a Discord account that has the `admin` role (configured via `ADMIN_DISCORD_IDS` in the backend `.env`).
2. Click on your profile dropdown in the top header and toggle the **Debug** switch.
3. The DevConsole will appear in the bottom-right corner. It is collapsible/minimizable and persists across page reloads.

### Environment Variables

**Backend (`.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth2 application ID |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth2 secret |
| `DISCORD_ALLOWED_GUILD_ID` | Yes | Discord server ID to gate access |
| `ADMIN_DISCORD_IDS` | No | Comma-separated Discord IDs for admin role |
| `JWT_SECRET` | Yes | Token signing secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
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
| **Deezer** | None (free) | 30s preview | Genre charts by popularity rank; album genres enriched via `/album/{id}` |

### Genre Pipeline

Tracks are discovered via Deezer genre charts (`/chart/{genreId}/tracks`). The search context (e.g., `pop`, `rock`) is stored as `chart_source`, separate from the track's actual musical genres. After fetching, each track's `album.id` is used to call `/album/{id}` and retrieve the real genre tags from `genres.data`, which are stored as a JSON array. This means a track found via the "rock" chart might have genres `["rock", "alternative"]` if its album tags it as both.

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

PostgreSQL with auto-migrations on startup. Schema:

| Table | Purpose |
|-------|---------|
| `users` | Discord OAuth users (id, discord_id, username, avatar, role) |
| `games` | Game sessions (id, code, genres JSON, rounds, status, timestamps) |
| `game_players` | Players per game (player_id, player_name, score, position) |
| `round_results_v2` | Detailed per-guess data (track, artist, genre, guess, found_artist/title/both, time_ms) |
| `songs_cache` | Cached tracks (id, name, artist, genres JSONB, chart_source, rank, source) |
| `songs_played` | Play history for recency weighting (song_id, played_at) |
| `friendships` | Friend requests and accepted friendships |

### Migrations

Run automatically on startup from `backend/src/migrations/`:

| File | Description |
|------|-------------|
| `001_initial.js` | Core tables (users, game_scores, friendships, round_results) |
| `002_indexes.js` | Performance indexes |
| `003_games_and_rounds.js` | Games, game_players, round_results_v2 |
| `004_song_cache.js` | songs_cache and songs_played with genre + recency indexes |
| `005_cleanup_ghost_users.js` | Merge ghost users, fix discord_id references |
| `006_genres_array.js` | Add genres JSONB + chart_source columns, migrate genre → genres |

---

## API Routes

### Game

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/genres` | No | List available genres (15) |
| `POST` | `/api/rooms` | JWT | Create room |
| `POST` | `/api/rooms/join` | JWT | Join room |
| `GET` | `/api/rooms/:code` | No | Room status |
| `POST` | `/api/game/:code/settings` | No | Update settings (host only) |
| `POST` | `/api/game/:code/start` | No | Start game (host only) |
| `POST` | `/api/game/:code/leave` | No | Leave room |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | Join room + receive state |
| `game_state` | Server → Client | Full state update |
| `submit_guess` | Client → Server | Submit artist/title guess |
| `skip_round` | Client → Server | Vote to skip |
| `playback_started` | Client → Server | Audio started playing |
| `kick_player` | Client → Server | Admin removes a player |
| `chat_clear` | Server → Client | Clears chat each round |
| `guess_made` | Server → Client | Another player guessed (progress bar) |

### Auth & Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/discord` | No | Discord OAuth redirect |
| `GET` | `/api/auth/discord/callback` | No | OAuth callback |
| `GET` | `/api/users/me` | JWT | Current user profile |
| `GET` | `/api/users/me/stats` | JWT | Enhanced stats |
| `GET` | `/api/users/me/history` | JWT | Player's game history |
| `GET` | `/api/users/:id/stats` | No | Public user stats |
| `GET` | `/api/leaderboard` | No | Global ranking |
| `GET` | `/api/games/recent` | No | Recent completed games |

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/stats` | Admin | User/game/round/song cache counts |
| `GET` | `/api/admin/db-status` | Admin | DB connectivity and table counts |
| `GET` | `/api/admin/rooms` | Admin | Active room list |
| `GET` | `/api/admin/users` | Admin | All users |
| `PUT` | `/api/admin/users/:id/role` | Admin | Change user role |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user + all data |
| `DELETE` | `/api/admin/users/:id/scores` | Admin | Wipe user scores |
| `GET` | `/api/admin/song-cache` | Admin | Song cache stats, genres, played songs |
| `POST` | `/api/admin/test/genre` | Admin | Test genre fetch |
| `POST` | `/api/admin/test/deezer` | Admin | Test Deezer API connectivity |
| `POST` | `/api/admin/test/deezer/genre` | Admin | Test Deezer genre with timing |

---

## Languages

| Flag | Language | Code |
|------|----------|------|
| 🇬🇧 | English | `en` |
| 🇫🇷 | Français | `fr` |
| 🇧🇷 | Português | `pt` |
| 🇪🇸 | Español | `es` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, motion, Socket.io |
| Backend | Express 5, Socket.io, pg (PostgreSQL) |
| Audio | Deezer API (free, no auth), album genre enrichment |
| Auth | Discord OAuth2 + JWT (guild-gated, 365-day sessions) |
| i18n | Custom JSON (en, fr, pt, es), persisted in localStorage |
| Database | PostgreSQL (auto-migrations) |
| Deployment | Self-hosted OptiPlex + Cloudflare Tunnel |

---

## Project Structure

```
blindtest/
├── backend/
│   ├── .env.example
│   └── src/
│       ├── index.js           # Express server, routes, admin endpoints
│       ├── game.js            # GameRoom class, scoring, skip votes
│       ├── deezer.js          # Genre charts, album enrichment, GENRES
│       ├── db.js              # PostgreSQL pool, queries, song cache, recency
│       ├── auth.js            # Discord OAuth + JWT + guild gating
│       └── migrations/
│           ├── 001_initial.js
│           ├── 002_indexes.js
│           ├── 003_games_and_rounds.js
│           ├── 004_song_cache.js
│           ├── 005_cleanup_ghost_users.js
│           └── 006_genres_array.js
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Dashboard (create/join + leaderboard)
│   │   ├── game/[code]/
│   │   │   ├── page.tsx       # Game room (WaitingRoom → Playing → Podium)
│   │   │   ├── Chat.tsx       # Chat with chat_clear support
│   │   │   └── DebugOverlay.tsx
│   │   ├── admin/page.tsx    # Admin panel (stats, users, rooms, music, API)
│   │   ├── leaderboard/
│   │   ├── login/
│   │   ├── profile/
│   │   ├── settings/
│   │   └── components/
│   │       ├── AudioPlayer.tsx
│   │       ├── Header.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── api.ts             # All API + WebSocket functions
│   │   ├── useTranslation.ts  # i18n hook
│   │   ├── useSound.ts        # Sound effect hook
│   │   └── debug-context.ts
│   └── locales/
│       ├── en.json
│       ├── fr.json
│       ├── pt.json
│       └── es.json
└── docker-compose.yml
```

---

## License

MIT