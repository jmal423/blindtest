# 🎵 BlindTest

**Real-time multiplayer music guessing game.**  
Listen to song snippets, guess the artist and title, compete with friends.

Played live on [blindtest.jl423.xyz](https://blindtest.jl423.xyz) or as a Discord Activity.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Express 5, Socket.io, PostgreSQL 16 |
| Auth | Discord OAuth2 + Discord Embedded App SDK |
| Audio | Deezer preview API (proxied) |
| AI (aux) | Ollama (genre classification pipeline) |
| Infra | Cloudflare Tunnel, Nginx, systemd, Docker (Postgres) |

## Architecture

```
Internet → Cloudflare Tunnel → Nginx (:3002) → Frontend (:3000) / Backend (:3005)
```

- **Frontend:** Next.js app with 20+ pages (lobby, game, admin, profile, leaderboard)
- **Backend:** Express + Socket.io server managing game state, rooms, player scores
- **Database:** PostgreSQL 16 with curated songs, artist links, and migration system
- **Discord Activity:** Embedded app SDK for playing inside Discord voice channels
- **AI Worker:** Separate pipeline that classifies songs by genre using Ollama

## Features

- Genre-based room creation with 29 curated genres across 7 regional groups
- Real-time guessing with Socket.io — scores update as players type
- Artist & title guess tracking with visual feedback
- Skip voting, admin controls, player kick/transfer
- 6 themes: Dark, Light, Neon Noir, Synthwave, Terminal, Fire
- Full i18n: English, French, Portuguese, Spanish
- PWA-ready, Discord Activity integration
- Admin panel for catalog management, user moderation, system metrics

## Development

```bash
# Backend
cd backend
cp .env.example .env     # configure DB, Discord secrets
npm install
npm run dev              # starts Express on :3005

# Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev              # starts Next.js on :3000

# Database (Postgres)
docker compose up -d     # starts PostgreSQL on :5432

# Full stack
npm run dev              # runs both via concurrently
```

## Deployment

```bash
./redeploy.sh            # pulls, builds, restarts services
```

Or manually:
```bash
git pull origin main
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run build
sudo systemctl restart blindtest-backend.service
sudo systemctl restart blindtest-frontend.service
```

## License

Copyright © 2026 BlindTest — All Rights Reserved.

This software and its source code are the intellectual property of the project author. No part of this project may be reproduced, distributed, or transmitted in any form or by any means without prior written permission. Public repository access is granted for portfolio and evaluation purposes only.
