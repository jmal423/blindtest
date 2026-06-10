# AI Worker Handoff

## Context
BlindTest music guessing game. An AI enrichment worker that runs on a powerful desktop (Arch Linux) and classifies tracks stored in the `songs_cache` table. Writes results back to PostgreSQL running on the OptiPlex server.

## Architecture
```
Desktop (Arch Linux)                    OptiPlex (server)
┌─────────────────────┐                ┌──────────────────┐
│  ai-worker/ (Node)  │ ──Direct SQL──>│ PostgreSQL        │
│  Ollama (LLM server)│                │ songs_cache       │
│  Python (audio)     │                │ backend (Express) │
└─────────────────────┘                └──────────────────┘
```

## Files Created
- `backend/src/migrations/007_ai_enrichment.js` — DB migration (AI columns + queue table)
- `ai-worker/package.json` — Node.js project (type: module)
- `ai-worker/.env.example` — Config template
- `ai-worker/src/config.js` — Config loader
- `ai-worker/src/db.js` — Direct PostgreSQL queries (fetch unprocessed tracks, write results)
- `ai-worker/src/genres.js` — Genre list + LLM prompt builder
- `ai-worker/src/classifier-metadata.js` — Ollama-based LLM classification
- `ai-worker/src/classifier-audio.js` — Optional audio analysis via Python subprocess
- `ai-worker/src/index.js` — Orchestrator (batch + watch modes)

## Backend Changes (on OptiPlex)
- `backend/src/db.js`:
  - `getCachedTracksByGenre()` now also matches against `ai_genres @> ?::jsonb`
  - Added `getAiEnrichmentStats()`, `getAiGenreDistribution()`, `getUnprocessedTracks()`
- `backend/src/index.js`:
  - Added `GET /api/admin/ai/stats` (admin-only)

## Todo (for next opencode instance)

### 1. Install Ollama on Arch
```bash
# From AUR
yay -S ollama
# Or direct
curl -fsSL https://ollama.com/install.sh | sh
# Start and pull a model
ollama serve
ollama pull llama3.2
```

### 2. Set up ai-worker
```bash
cd blindtest/ai-worker
cp .env.example .env
# Edit .env — set DATABASE_URL to point to OptiPlex PostgreSQL
# Also set OLLAMA_URL=http://127.0.0.1:11434 and verify the model name
npm install
```

### 3. Run the migration on the OptiPlex backend
The migration `007_ai_enrichment.js` will auto-apply on next backend restart (migrations run at startup in `db.js`).

### 4. Run the worker (recommended)

Make sure SSH tunnel to OptiPlex is open first:
```bash
ssh -L 5433:localhost:5432 jalfaiat@192.168.1.49
```

Then run everything with one command:
```bash
cd ~/blindtest/ai-worker && npm run run
```

This does: pull new tracks from OptiPlex → classify locally → push results back.

Or step by step:
```bash
npm run sync-pull   # pull new/changed tracks from OptiPlex (incremental)
npm run classify    # classify all unprocessed tracks (local DB — fast)
npm run sync-push   # push AI results back to OptiPlex
```

The sync-pull is **incremental** — first run pulls everything, subsequent runs only pull tracks that changed or are new (by `fetched_at` / `ai_processed_at` timestamps, plus any missing IDs).

### 5. Optional: Audio analysis setup
```bash
pip install numpy librosa onnxruntime
# Download a MUSICNN model in ONNX format to ai-worker/models/musicnn.onnx
# Set AUDIO_CLASSIFICATION_ENABLED=true in .env
```

### 6. Remaining work
- [ ] Test the migration applies cleanly on OptiPlex
- [ ] Test the worker processes tracks via Ollama
- [ ] Verify backend track selection includes ai_genres results
- [ ] Add a frontend admin tab for AI monitoring (optional)
- [ ] Add `custom_genre` endpoint that uses LLM + tag matching for free-text genre queries

## DB Schema (new columns on songs_cache)
| Column | Type | Purpose |
|--------|------|---------|
| `ai_genres` | JSONB `[]` | AI-predicted genre labels (same 30 genres) |
| `ai_tags` | JSONB `[]` | Free-form descriptive tags from LLM |
| `ai_audio_genres` | JSONB `[]` | Audio analysis results |
| `ai_confidence` | JSONB `{}` | Per-genre confidence scores |
| `ai_processed_at` | TIMESTAMPTZ | When last AI-enriched |
| `ai_version` | TEXT | Model version tag |
