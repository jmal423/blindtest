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
- **27 genres** — Standardized global music taxonomy (Portuguese, Brazilian, US, UK, French, Spanish, and World/Other regions)
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
│  (Port 3000) │  Socket.io  │   (Port 3005)          │
└──────────────┘ ─────────── └───────┬───────────────┘
                                ┌─────┴─────┐
                                ▼           ▼
                              Deezer     PostgreSQL
                              (audio)    (games, stats,
                                          users, songs)
```

Self-hosted on OptiPlex 790 (i5, Ubuntu 26.04 LTS) behind a Cloudflare Tunnel on `blindtest.jl423.xyz`.

### Ports & Routing Architecture

* **Next.js Frontend**: Port `3000` (managed by the systemd service `blindtest-frontend`)
* **Express Backend**: Port `3005` (managed by the systemd service `blindtest-backend`, changed from `3001` to resolve local development conflicts)
* **Nginx Reverse Proxy**: Port `3002` (routes public traffic from Cloudflare Tunnel to port `3000`, and proxies `/api/` + `/socket.io/` directly to backend port `3005`)
* **PostgreSQL Database**: Port `5432` on the remote host (exposed on local port `5433` via SSH Tunnel for the AI worker)

---

## Quick Start

```bash
# Start PostgreSQL (local development only)
docker compose up -d

# Backend
cd backend && npm install
cp .env.example .env  # Fill in your variables (Default PORT=3005)
npm run dev

# Frontend
cd frontend && npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3005" > .env.local
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
| `PORT` | No | `3005` (Defaults to `3005`) |

**Frontend (`.env.local`):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:3005`) |

---

## Audio Source

| Source | Auth | Quality | Notes |
|--------|------|---------|-------|
| **Deezer** | None (free) | 30s preview | Genre charts by popularity rank; album genres enriched via `/album/{id}` |

### Genre Pipeline & AI Enrichment

Our intelligent classification cache upgrades a standard "dumb" track database into a curated, high-accuracy genre library.

1. **Discovery & Caching (Dumb DB)**: Uncached tracks requested in a game are fetched from Deezer charts (`/chart/{genreId}/tracks`). Their album metadata is queried via `/album/{id}` to capture album-level genres, and cached into the `songs_cache` table.
2. **Local AI Enrichment (Smart DB)**:
   An offline `ai-worker` running on a powerful local machine pulls unprocessed songs from the remote database and classifies them using Ollama (`llama3:8b`) based on a **strict, two-step region-to-genre decision process**:
   * **Step 1 (Linguistic/Regional Origin)**: The AI identifies the artist's country of origin and language cadence first (e.g., if the artist is French/Belgian like PLK, GIMS, or Stromae, the region is locked to `french`; if the artist is Portuguese like Slow J, the region is locked to `portuguese`).
   * **Step 2 (Target Subgenre)**: The AI selects the final genre ID *only* from the subgenres allowed for that specific region. This prevents cross-region leaks (e.g., preventing French rap from leaking into US trap `hip_hop_trap_us` or Portuguese pop `pop_urbano_nova_pop`).
3. **Automated Loop (Watch Mode)**:
   Running the worker in watch mode (`npm run watch`) periodically polls the database for newly added/unprocessed cache items (`ai_processed_at IS NULL`), processes them via LLM, and pushes the enriched results back.
4. **Database-First Playback**:
   When starting a lobby, the backend queries the database cache first using both traditional genres and `ai_genres` JSONB arrays. To prevent expired/broken URLs, the backend resolves fresh, non-expired preview URLs from Deezer on-demand in parallel. Only when the cache holds insufficient tracks does the system fetch raw tracks from the Deezer API, queuing them for background AI processing.

---

## AI Worker Scripts & Automation

The `ai-worker` contains several pipeline management scripts inside `ai-worker/scripts/`:

### 1. Synchronization Pipelines
To run the AI pipeline remotely without running Ollama on the production OptiPlex server:
* `npm run sync-pull`: Pulls newly cached, unprocessed songs from the remote database to your local PostgreSQL database.
* `npm run classify` (or `npm run batch`): Performs LLM classification on the local database.
* `npm run sync-push`: Pushes the local AI-enrichment columns (`ai_genres`, `ai_tags`, `ai_confidence`, etc.) back to the remote OptiPlex database.
* `npm run run`: Chains all three commands together (`sync-pull` && `classify` && `sync-push`) for a single-command sync loop.

### 2. Genre Config Generator
Generates the frontend-compatible and backend-compatible configuration files containing `GENRES` and `GENRE_GROUPS` definitions based on our target music taxonomy.
* **Command**: `npm run clean-genres`
* **Process**: Writes the standardized target taxonomy list and regional group mappings directly to `genres-config.js` for both the worker and backend.

### 3. Semantic Deduplication
To prevent users from hearing the same song multiple times in different forms (e.g., remasters, live recordings, radio edits, deluxe versions):
* **Command**: `npm run deduplicate`
* **Process**:
  1. Groups tracks by artist and normalized title (heuristically stripping parenthetical tags like `(Remastered)`, `[Live]`, or `- Radio Edit`).
  2. For each group with multiple tracks, queries Ollama to evaluate which version is the high-quality studio/original cut.
  3. Keeps the chosen version and deletes all other duplicate track entries from `songs_cache` in the database, ensuring a clean, unique song list.

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

PostgreSQL database access layer organized using the Repository Pattern with automatic pool connection retries and dynamic schema migrations on startup. Database schema:

| Table | Purpose |
|-------|---------|
| `users` | Discord OAuth users (id, discord_id, username, avatar, role) |
| `games` | Game sessions (id, code, genres JSON, rounds, status, timestamps) |
| `game_players` | Players per game (player_id, player_name, score, position) |
| `round_results_v2` | Detailed per-guess data (track, artist, genre, guess, found_artist/title/both, time_ms) |
| `songs_cache` | Cached tracks (id, name, artist, genres JSONB, chart_source, rank, source, plus AI columns: `ai_genres`, `ai_tags`, `ai_confidence`, `ai_processed_at`, `ai_version`) |
| `songs_played` | Play history for recency weighting (song_id, played_at) |
| `friendships` | Friend requests and accepted friendships |
| `ai_classification_queue` | Queue for tracking AI processing status and errors per track |

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
| `007_ai_enrichment.js` | Add AI metadata columns to `songs_cache` and create the `ai_classification_queue` table |

---

## API Routes

### Game

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/genres` | No | List available genres (27) |
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
├── ai-worker/             # AI processing pipeline
│   ├── src/
│   │   ├── index.js       # Orchestrator (batch and watch modes)
│   │   ├── db.js          # Queries for fetching and saving classifications
│   │   └── classifier-metadata.js  # Ollama LLM connection
│   └── scripts/
│       ├── sync-pull.js   # Pulls uncached songs from server to local DB
│       ├── sync-push.js   # Pushes classified songs back to server
│       ├── clean-genres.js # Standardizes raw predicted genres via Ollama
│       └── deduplicate.js  # Removes semantic duplicates (remasters, live edits) via Ollama
├── backend/
│   ├── .env.example
│   └── src/
│       ├── index.js           # Express server, routes, admin endpoints
│       ├── game.js            # GameRoom class, scoring, skip votes
│       ├── deezer.js          # Genre charts, DB-first caching, GENRES
│       ├── db.js              # Re-exports repositories & connection helper exports (backward compatibility)
│       ├── db/                # Modular database module
│       │   ├── connection.js  # Pool initialization, retry logic, and query wrappers
│       │   ├── migrationRunner.js # Dynamic migrations executor
│       │   └── repositories/  # Domain-specific database query files
│       │       ├── userRepository.js # User stats and global leaderboard v2
│       │       ├── gameRepository.js # Game creation, finish, lobby players, and round scoring
│       │       ├── songRepository.js # Song cache, play logs, and AI enrichment checks
│       │       └── curatedRepository.js # Curated playlist song additions, verification, and stats
│       ├── auth.js            # Discord OAuth + JWT + guild gating
│       └── migrations/
│           ├── 001_initial.js
│           ├── 002_indexes.js
│           ├── 003_games_and_rounds.js
│           ├── 004_song_cache.js
│           ├── 005_cleanup_ghost_users.js
│           ├── 006_genres_array.js
│           └── 007_ai_enrichment.js
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