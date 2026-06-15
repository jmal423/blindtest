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
- **Popularity-weighted shuffle** — Tracks with higher Deezer rank (more popular) are selected more often, not random
- **Difficulty tracking** — Tracks with <10% find rate after 5+ plays auto-demote (set unverified)
- **Song cache with recency weighting** — Fetched tracks persist in DB; recently played songs are exponentially less likely to reappear
- **Real-time multiplayer** — Socket.io for live game state, no polling
- **Smart scoring** — Artist 3pts, title 3pts, both 4pts combo + speed + streak bonuses
- **36 genres** — Global music taxonomy across Portuguese, Brazilian, US, UK, French, Spanish, Global regions
- **Artist mode** — Pick specific artists instead of genres; tracks filtered by primary artist only
- **Skip vote system** — Host/admin skips instantly, players vote (majority wins)
- **Track history sidebar** — Reversed (last played on top), skipped tracks shown with ⏭ + strikethrough + dimmed
- **Chat clears per round** — `chat_clear` socket event wipes stale messages each round
- **Leaderboard** — Global ranking with wins, avatars, clickable player detail panels
- **Persistent stats** — Discord-authenticated players; games, points, perfects, best genre, avg speed
- **Discord OAuth2 + Activity** — Guild-gated login, Rich Presence with party tracking, native invite support, embedded activity SDK
- **Multi-language** — English, Français, Português, Español (persisted in localStorage)
- **Volume control** — Default 20%, mute + slider, `M` key shortcut
- **4 themes** — Dark (default), Light, Neon Noir, Retro, Terminal — user-selectable in settings
- **Player flag system** — Players flag songs as Wrong Genre / Wrong Song / Audio Issue; 3 unique flags auto-demotes the track
- **Admin panel** — Live rooms, user management, genre tester, song cache stats, database monitoring, flagged song review
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
┌──────────────┐             ┌──────────────┐
│  Next.js 16  │  HTTP/JSON  │  Express 5   │
│  Frontend    │ ◄────────►  │  Backend     │
│  (Port 3000) │  Socket.io  │  (Port 3005) │
└──────────────┘ ─────────── └───────┬──────┘
                                ┌────┴──────┐
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

### Backend Scripts

```bash
cd backend

# Sync difficulty data (run daily via cron)
node scripts/sync-difficulty.js

# View artist tracks in cache
node scripts/list-artist-tracks.js
node scripts/list-artist-tracks.js "Ariana Grande"

# Clean misattributed artist tracks
node scripts/clean-artist-cache.js
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
| `ADMIN_DISCORD_IDS` | No | Comma-separated Discord IDs for admin role |
| `JWT_SECRET` | Yes | Token signing secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FRONTEND_URL` | No | CORS origin + OAuth redirect base |
| `PORT` | No | `3005` (Defaults to `3005`) |

**Frontend (`.env.local`):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | Discord application ID (for embedded activity SDK) |

### Discord Activity Setup

The app supports Discord's Embedded App SDK for voice channel activities. Required configuration:
1. Enable "Activities" on your Discord Developer Portal application
2. Set `NEXT_PUBLIC_DISCORD_CLIENT_ID` in the frontend `.env.local`
3. Configure OAuth2 redirect URLs for the activity
4. Required OAuth scopes: `identify`, `rpc.activities.write`, `activities.write`, `relationships.read`

---

## Audio Source

| Source | Auth | Quality | Notes |
|--------|------|---------|-------|
| **Deezer** | None (free) | 30s preview | Genre charts by popularity rank; album genres enriched via `/album/{id}` |

### Genre Pipeline & AI Enrichment

The pipeline upgrades raw Deezer tracks into a curated, accuracy-weighted genre library.

1. **Discovery & Caching**: Tracks are fetched from Deezer charts (`/chart/{genreId}/tracks`) and custom playlists. Album metadata (`/album/{id}`) captures album-level genres via the `ALBUM_GENRE_ALIASES` mapping, stored in `songs_cache.genres`.
2. **AI Classification with Confidence**: The `ai-worker` classifies unprocessed tracks using Ollama. Each classification outputs a **confidence score (0–1)**:
   - 0.9–1.0: Clear match (well-known artist in this genre)
   - 0.7–0.9: Good match (genre fits the sound/style)
   - 0.5–0.7: Moderate (could fit multiple genres)
   - Below 0.5: Unsure (ambiguous data)
3. **Auto-Curation by Threshold**: The `auto-curate.js` script imports classified tracks into `curated_songs`:
   - **≥85% confidence**: Auto-verified (plays in games immediately)
   - **50–85%**: Imported as unverified (appears in admin review queue)
   - **<50%**: Skipped (not imported)
4. **Database-First Playback**: The backend queries `curated_songs` first, then `songs_cache`. Expired preview URLs are refreshed from Deezer in parallel batches. Only when the cache is insufficient does the system fetch fresh tracks, queuing them for AI processing.

**Bulk cache fill**: `npm run fill-cache` fetches from all 36 Deezer genre charts + curated playlists to populate the cache before classification.

---

## AI Worker Scripts & Automation

The `ai-worker` contains pipeline management scripts inside `ai-worker/scripts/`:

### 1. Full Pipeline (desktop)
```bash
cd ai-worker
npm run pipeline         # fill-cache → classify → auto-curate
```
Boot your desktop, run this. It fetches tracks from Deezer charts, classifies them with confidence scores, and imports high-confidence tracks into the game.

### 2. Fill Cache
* `npm run fill-cache`: Fetches tracks from all 36 Deezer genre charts + custom playlists into `songs_cache`. Run before classification to ensure the AI has data to work with.

### 3. Classification
* `npm run batch` (or `npm run classify`): Classifies unprocessed `songs_cache` tracks via Ollama. Stores `ai_genres`, `ai_confidence`, `ai_version`.
* `npm run watch`: Watch mode — polls for new tracks and classifies them in real-time.

### 4. Auto-Curation
* `npm run auto-curate`: Imports AI-classified tracks into `curated_songs`. Uses confidence thresholds (≥85% auto-verified, 50-85% needs review).

### 5. Artist Population
* `npm run populate-artists`: Fetches top tracks from Deezer for all artists in `artist-groups.json`. Caches them in `songs_cache` with `chart_source='artist'`.

### 6. Sync (old pipeline, for remote workers)
* `npm run sync-pull`: Pulls unprocessed songs from remote DB to local.
* `npm run sync-push`: Pushes classified songs back to remote.
* `npm run run`: Chains sync-pull → classify → sync-push.

### 7. Genre Cleanup
* `npm run clean-genres`: Normalizes raw genre predictions via Ollama.

### 8. Deduplication
* `npm run deduplicate`: Removes semantic duplicates (remasters, live edits) via Ollama.

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

Organized using the Repository Pattern with automatic pool connection retries and dynamic schema migrations on startup.

| Table | Purpose |
|-------|---------|
| `users` | Discord OAuth users (id, discord_id, username, avatar, role) |
| `games` | Game sessions (id, code, genres JSON, rounds, status, timestamps) |
| `game_players` | Players per game (player_id, player_name, score, position) |
| `round_results_v2` | Detailed per-guess data (track, artist, genre, guess, found_artist/title/both, time_ms) |
| `songs_cache` | Cached tracks with genre, AI metadata, played/found counts |
| `curated_songs` | Curated/verified song library (genre, played_count, verified status) |
| `songs_played` | Play history for recency weighting (song_id, played_at) |
| `song_flags` | Player flag reports with reason + rate limiting |
| `artists` | Artist registry with Deezer IDs for artist mode |
| `friendships` | Friend requests and accepted friendships |
| `ai_classification_queue` | Queue for tracking AI processing status and errors per track |

### Migrations (run automatically on startup)

| File | Description |
|------|-------------|
| `001–009` | Core tables, games, song cache, AI enrichment, curated songs |
| `010_artist_index.js` | Indexes on artist columns for artist mode |
| `011_artists_table.js` | Artists table + artist_id on songs_cache/curated_songs |
| `012_ai_classification_queue.js` | AI processing queue table |
| `013_songs_cache_played_count.js` | played_count + found_count columns for difficulty tracking |
| `014_songs_cache_difficulty.js` | Difficulty indexes |
| `015_song_flags.js` | Player flag reports table |

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
| `flag_song` | Client → Server | Flag song with reason (`{songId, reason}`) |
| `flag_result` | Server → Client | Flag result (`{flags, demoted, needed}`) |
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
| `GET` | `/api/admin/curated/stats` | Admin | Curated songs stats by genre |
| `GET` | `/api/admin/curated/by-genre` | Admin | Curated songs filtered by genre |
| `GET` | `/api/admin/curated/unverified` | Admin | Unverified songs awaiting review |
| `GET` | `/api/admin/curated/discovery` | Admin | Discovery candidates from songs_cache |
| `POST` | `/api/admin/curated/import` | Admin | Import songs_cache tracks into curated |
| `POST` | `/api/admin/curated/verify` | Admin | Set song verified status |
| `POST` | `/api/admin/curated/update-genre` | Admin | Update song genre |
| `GET` | `/api/admin/ai/search` | Admin | Search AI-enriched tracks |
| `GET` | `/api/admin/ai/recent` | Admin | Recent AI-classified tracks |
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
│   │   ├── classifier-metadata.js  # Ollama LLM classification with confidence
│   │   └── genres.js      # Genre taxonomy prompt builder
│   ├── training/          # LoRA fine-tuning scripts
│   │   └── train.py       # Unsloth-based LoRA trainer for genre classification
│   └── scripts/
│       ├── fill-cache-from-charts.js  # Fill songs_cache from Deezer charts + playlists
│       ├── populate-artists.js        # Fetch + cache artist tracks from Deezer
│       ├── auto-curate.js             # Import classified tracks with confidence threshold
│       ├── sync-pull.js   # Pulls uncached songs from server to local DB
│       ├── sync-push.js   # Pushes classified songs back to server
│       ├── clean-genres.js # Standardizes raw predicted genres via Ollama
│       └── deduplicate.js  # Removes semantic duplicates (remasters, live edits) via Ollama
├── backend/
│   ├── .env.example
│   ├── scripts/               # Utility scripts (run from backend dir)
│   │   ├── sync-difficulty.js # Sync played/found counts, auto-demote bad songs
│   │   ├── clean-artist-cache.js  # Remove misattributed artist tracks
│   │   └── list-artist-tracks.js  # View artist tracks in cache
│   └── src/
│       ├── index.js           # Express server, routes, admin endpoints, socket handlers
│       ├── game.js            # GameRoom class, scoring, skip votes, weighted shuffle
│       ├── deezer.js          # Genre charts, DB-first caching, GENRES, artist track fetching
│       ├── genres-config.js   # Genre taxonomy definition (36 genres, 7 regions)
│       ├── artist-groups.json # Artist groupings for artist mode
│       ├── db.js              # Re-exports all repositories (barrel)
│       ├── db/                # Modular database layer
│       │   ├── connection.js  # Pool init, retry logic, query helpers (`?` → `$N`)
│       │   ├── migrationRunner.js # Auto-migrations executor
│       │   └── repositories/
│       │       ├── userRepository.js     # Stats, leaderboard
│       │       ├── gameRepository.js     # Games, rounds, players
│       │       ├── songRepository.js     # Cache, play logs, AI enrichment, difficulty
│       │       ├── curatedRepository.js  # Curated songs, verification, genre management
│       │       └── flagRepository.js     # Player flag reports
│       ├── auth.js            # Discord OAuth + JWT + guild gating
│       └── migrations/
│           ├── 001–010        # Core tables, AI enrichment, curated songs, artist indexes
│           ├── 011_artists_table.js
│           ├── 012_ai_classification_queue.js
│           ├── 013_songs_cache_played_count.js
│           ├── 014_songs_cache_difficulty.js
│           └── 015_song_flags.js
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
