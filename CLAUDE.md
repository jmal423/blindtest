# Blindtest Project

## Stack
- **Frontend**: Next.js (React)
- **Backend**: Python (FastAPI)
- **Database**: SQLite
- **Infra**: Docker Compose
- **Search**: Meilisearch

## Commands
- `docker compose up -d` — start everything
- `./redeploy.sh` — full redeploy from the `main` branch
- `./setup-beta.sh` — beta setup script

## Project Structure
- `frontend/` — Next.js app
- `backend/` — FastAPI app
- `docker-compose.yml` — service orchestration
- `scratch/` — experimental / scratch files

## Local LLM Setup (opencode)
- Default model: `ollama/qwen3.5-local` (32k context, tool-calling enabled)
- To switch models: run `/models` in opencode TUI
- Available local models: qwen3.5-local, qwen2.5:14b, qwen2.5:32b, deepseek-coder-v2

## Agent Skills (from addyosmani/agent-skills)
The `.opencode/skills/` directory contains reusable skill definitions:
- `/spec` — spec-driven-development: Define what to build
- `/plan` — planning-and-task-breakdown: Break into tasks
- `/build` — incremental-implementation + test-driven-development
- `/test` — test-driven-development: Write tests first
- `/review` — code-review-and-quality: Review before merge
- `/ship` — shipping-and-launch: Validate and release
