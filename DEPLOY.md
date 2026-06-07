# BlindTest Deployment Guide

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────┐
│  Vercel          │  HTTP   │  Railway                     │
│  Next.js frontend│◄───────►│  Node.js + Socket.io backend │
│  (port 443)      │         │  + PostgreSQL database       │
└─────────────────┘         └──────────────────────────────┘
```

- **Frontend:** Vercel (Next.js with App Router, static + SSR)
- **Backend:** Railway (Express + Socket.io, persistent server)
- **Database:** Railway PostgreSQL plugin (auto-provisioned)

---

## Railway Setup (Backend + Database)

### 1. Create a Railway account
Go to https://railway.app and sign up with GitHub.

### 2. Add PostgreSQL
1. In your Railway project, click **New** → **Database** → **PostgreSQL**
2. Railway auto-sets the `DATABASE_URL` environment variable
3. No code changes needed — the backend already supports PostgreSQL

### 3. Deploy the backend
1. Connect your GitHub repo to Railway
2. Set root directory to `backend/`
3. Railway auto-detects Node.js from `package.json`
4. `railway.json` is already configured (start command, restart policy)
5. Deploy — Railway will run `npm install` and `node src/index.js`

### 4. Environment variables (set in Railway dashboard)
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
JWT_SECRET=generate-a-random-string-here
FRONTEND_URL=https://your-app.vercel.app
PORT=3001
# DATABASE_URL is auto-set by Railway PostgreSQL
```

### 5. Optional: Discord OAuth
```
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_ALLOWED_GUILD_ID=optional_guild_id
ADMIN_DISCORD_IDS=your_discord_id
```

### 6. Optional: YouTube API
```
YOUTUBE_API_KEY=your_youtube_api_key
```

---

## Vercel Setup (Frontend)

### 1. Deploy the frontend
1. Go to https://vercel.com and import your GitHub repo
2. Set root directory to `frontend/`
3. Framework: Next.js (auto-detected)
4. Deploy

### 2. Environment variables (set in Vercel dashboard)
```
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

Replace `https://your-app.railway.app` with your Railway backend URL (shown in Railway dashboard under "Domains").

---

## Local Development

```bash
# Backend (uses SQLite automatically)
cd backend
cp .env.example .env
# Edit .env with your Spotify credentials
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

For local dev:
- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:3000`
- Database: SQLite file at `backend/data.db` (auto-created, zero config)

To test PostgreSQL locally:
```bash
# Set in backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/blindtest
```

---

## Database Migrations

Migrations run automatically on server startup. Files in `backend/src/migrations/` are applied in order:

```
001_initial.js   — Tables (users, game_scores, friendships, round_results)
002_indexes.js   — Performance indexes
```

- A `_migrations` table tracks which migrations have been applied
- Already-applied migrations are skipped
- New migrations are added as numbered files and run on next deploy

---

## Health Check

`GET /api/health` — public, no auth

```json
{
  "ok": true,
  "uptime": 3600,
  "database": {
    "connected": true,
    "type": "PostgreSQL",
    "tables": { "users": 42, "game_scores": 156, "round_results": 823, "friendships": 12 }
  }
}
```

Use this for Railway health checks or uptime monitoring.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| DB empty | Make sure `DATABASE_URL` is set on Railway (PostgreSQL plugin auto-sets it) |
| SQLite on Railway | Don't use SQLite on Railway — add the PostgreSQL plugin |
| `better-sqlite3` build fails | This package compiles native code. Railway's Nixpacks handles it. On Vercel, don't use SQLite |
| Socket.io disconnects | Only backend on Railway supports Socket.io. Set Vercel `NEXT_PUBLIC_API_URL` to Railway URL |
| Cold starts | Vercel frontend may cold start (1-2s). Railway backend stays warm |
