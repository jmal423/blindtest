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

- **4 audio sources** — Spotify previews, Deezer (free, no auth), YouTube full songs, Auto (best available)
- **Real-time multiplayer** — Socket.io for live game state, no polling
- **Smart scoring** — Points for artist, title, or both with time bonuses and streaks
- **16 genres + Top 100** — Pop, Rock, Hip-Hop, R&B, Electronic, Jazz, Classical, Country, Metal, Indie, Soul, Blues, Reggae, Latin, Dance, and the global Top 100 chart
- **Rank-based track selection** — Deezer popularity rank sorts tracks so mainstream songs play first
- **Skip vote system** — Host/admin skips instantly, players vote (majority wins)
- **Track history sidebar** — Always-visible history shows played tracks with Deezer rank (`Artist · #42,150`)
- **Multi-language** — English, Français, Português, Español — switch from main menu, settings, or header
- **Volume control** — Mute button + slider in game header, `M` key shortcut
- **Guest login** — No Discord required, play instantly
- **Admin panel** — Live rooms, user management, genre tester with rank display, database monitoring

---

## Architecture

```
┌──────────────┐  HTTP/JSON  ┌──────────────────────┐
│   Next.js 16  │ ◄────────► │   Express 5           │
│   Frontend    │             │   Backend             │
│   (Vercel)    │  Socket.io  │   (Railway)           │
└──────────────┘ Б──Б──Б──Б─Б─└───────┬───────────────┘
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
Round 1: 3-2-1-GO → Play track → Players guess → Show answer → Round 2+ (directly play)
       ↓
Game Over → Podium → Play Again / Main Menu
```

- Round timer starts immediately, no playback delay
- Skip votes show live tally (`Vote Skip 2/3` → `Voted 3/3`)
- Preview sources (Deezer/Spotify) center the round window within the 30s clip

---

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
| `SPOTIFY_CLIENT_ID` | No* | Spotify app credentials |
| `SPOTIFY_CLIENT_SECRET` | No* | Spotify app credentials |
| `YOUTUBE_API_KEY` | No | YouTube Data API key (scraping fallback works without it) |
| `DISCORD_CLIENT_ID` | No | Discord OAuth2 application ID |
| `DISCORD_CLIENT_SECRET` | No | Discord OAuth2 secret |
| `DISCORD_ALLOWED_GUILD_ID` | No | Restrict to a specific Discord server |
| `ADMIN_DISCORD_IDS` | No | Comma-separated Discord IDs for admin role |
| `JWT_SECRET` | Yes | Token signing secret (generate a random string) |
| `DATABASE_URL` | No | PostgreSQL URL (uses SQLite if unset) |
| `SQLITE_PATH` | No | Custom SQLite file path |
| `FRONTEND_URL` | No | CORS origin + OAuth redirect base |
| `PORT` | No | `3001` |

*Spotify is only needed if using Spotify as audio source. Deezer works without any keys.

**Frontend (`.env.local`):**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:3001`) |

---

## Audio Sources

| Source | Auth | Quality | Reliability | Notes |
|--------|------|---------|-------------|-------|
| **Deezer** (default) | None (free) | 30s preview | High | Uses genre charts, sorted by global popularity rank |
| **Spotify** | Client Credentials | 30s preview | Rate limited (429) | Recommendations + search fallback |
| **YouTube** | API key or scraping | Full song | Quota limited | Scraping fallback works without key |
| **Auto** | — | Best available | Falls through all | Tries Spotify → Deezer → YouTube |

---

## Languages

| Flag | Language | Code |
|------|----------|------|
| 🇬🇧 | English | `en` |
| 🇫🇷 | Français | `fr` |
| 🇧🇷 | Português | `pt` |
| 🇪🇸 | Español | `es` |

Switch from:
- **Main menu** — flag buttons below the guest login form
- **Header menu** — flag buttons in the profile dropdown
- **Settings modal** — Language section with all 4 flags

Language is persisted to `localStorage`. All UI text, feedback messages, labels, and buttons are translated (~150 keys per locale).

---

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
| `game_state` | Server → Client | Full state update (state, players, settings, track info) |
| `submit_guess` | Client → Server | Submit artist/title guess |
| `skip_round` | Client → Server | Vote to skip (host/admin skips instantly) |
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

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | DB connectivity, uptime, table counts |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/stats` | Admin | User/room/round counts |
| `GET` | `/api/admin/db-status` | Admin | DB type, row counts, connectivity |
| `GET` | `/api/admin/rooms` | Admin | Active room list |
| `GET` | `/api/admin/users` | Admin | All users |
| `PUT` | `/api/admin/users/:id/role` | Admin | Change user role |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete user + data |
| `DELETE` | `/api/admin/users/:id/scores` | Admin | Wipe user scores |
| `POST` | `/api/admin/test/spotify` | Admin | Test Spotify API connectivity |
| `POST` | `/api/admin/test/genre` | Admin | Test genre fetch (count param) |
| `POST` | `/api/admin/test/deezer` | Admin | Test Deezer API connectivity |
| `POST` | `/api/admin/test/deezer/genre` | Admin | Test genre fetch with rank (count param) |

---

## Scoring

- **Artist correct:** +50 pts
- **Title correct:** +50 pts
- **Both correct:** +100 bonus
- **Time bonus:** Up to +150 pts (faster = more)
- **Streak bonus:** Multiplier for consecutive correct answers

Fuzzy matching handles typos, punctuation, and "(feat. ...)" suffixes.

---

## Database

### Local development
SQLite with `better-sqlite3` — zero config, auto-created at `backend/data.db`.

### Production (Railway)
Add the PostgreSQL plugin to your Railway project. `DATABASE_URL` is auto-set. The backend auto-detects PostgreSQL and uses it with connection pooling, retries, and health checks.

### Migrations
Migrations run automatically on startup from `backend/src/migrations/`:
- `001_initial.js` — Tables (users, game_scores, friendships, round_results)
- `002_indexes.js` — Performance indexes on user_id, game_id, genre, played_at

See `DEPLOY.md` for full deployment guide.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, motion (Framer Motion), Socket.io |
| Backend | Express 5, Socket.io, better-sqlite3 / pg |
| Audio | Spotify Web API, Deezer API (free), YouTube Data API / scraping |
| Auth | Discord OAuth2 + JWT, Guest tokens |
| i18n | Custom JSON-based (en, fr, pt, es), persisted in localStorage |
| Database | PostgreSQL (production) / SQLite (local), migration system |
| Deployment | Vercel (frontend) + Railway (backend + PostgreSQL) |

---

## Project Structure

```
blindtest/
├── DEPLOY.md                  # Railway + Vercel deployment guide
├── backend/
│   ├── .env.example           # All environment variables documented
│   ├── railway.json           # Railway deployment config
│   └── src/
│       ├── index.js           # Express server, routes, admin endpoints
│       ├── game.js            # GameRoom class, game logic, scoring, skip votes
│       ├── spotify.js         # Spotify client credentials + genre search
│       ├── deezer.js          # Deezer genre charts + artist top tracks, rank sorting
│       ├── youtube.js         # YouTube Data API + scraping fallback
│       ├── db.js              # Database abstraction (PostgreSQL / SQLite), migrations, retry
│       ├── auth.js            # Discord OAuth + JWT middleware
│       └── migrations/
│           ├── 001_initial.js # Core tables
│           └── 002_indexes.js # Performance indexes
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Home (create/join/login with language switcher)
│   │   ├── game/[code]/
│   │   │   ├── page.tsx       # Game room (WaitingRoom → Playing → Podium)
│   │   │   ├── Chat.tsx       # Timestamped chat with system messages
│   │   │   ├── DebugOverlay.tsx # Collapsible sections: track, audio, players, settings
│   │   │   ├── Podium.tsx     # Endgame rankings
│   │   │   └── TrackHistory.tsx # Sidebar overlay
│   │   ├── admin/page.tsx     # Admin (System, Users, Rooms, Leaderboard, API with genre tester)
│   │   ├── login/page.tsx     # Discord + guest login
│   │   ├── profile/page.tsx   # Profile stats, friends, game history
│   │   ├── settings/page.tsx  # Account settings
│   │   └── components/
│   │       ├── AudioPlayer.tsx        # YouTube iframe + HTML5 audio
│   │       ├── Header.tsx             # Profile dropdown with language switcher
│   │       ├── SettingsModal.tsx       # Volume, auto-focus, motion, theme, language
│   │       ├── LanguageSwitcher.tsx    # Flag button grid
│   │       └── LanguageInitializer.tsx # Sets <html lang> from settings
│   ├── context/
│   │   ├── SettingsContext.tsx  # Volume, accessibility, theme, language
│   │   └── AuthContext.tsx      # Auth state
│   ├── lib/
│   │   ├── api.ts            # All API + WebSocket functions
│   │   ├── useTranslation.ts # i18n hook (t, language, setLanguage)
│   │   ├── useSound.ts       # Sound effect hook
│   │   └── debug-context.tsx
│   └── locales/
│       ├── en.json           # ~150 English keys
│       ├── fr.json           # ~150 French keys
│       ├── pt.json           # ~150 Portuguese keys
│       └── es.json           # ~150 Spanish keys
└── README.md
```

---

## License

MIT
