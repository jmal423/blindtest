#!/bin/bash

# Configuration
BACKEND_PORT=3005
FRONTEND_PORT=3000

echo "=========================================="
echo "   BlindTest Safe Redeploy & Run Script   "
echo "=========================================="

# 1. Git pull
echo "[1/4] Pulling latest updates from Git..."
git pull origin main

# 2. Clean up ports (avoid EADDRINUSE)
kill_port() {
  local PORT=$1
  local PID
  # Try fuser first (more reliable on Linux)
  if command -v fuser &> /dev/null; then
    fuser -k "${PORT}/tcp" 2>/dev/null && echo "  -> Port $PORT killed via fuser"
  fi
  # Also try lsof as fallback (macOS)
  if command -v lsof &> /dev/null; then
    PID=$(lsof -t -i:$PORT 2>/dev/null)
    if [ ! -z "$PID" ]; then
      echo "  -> Found process $PID on port $PORT. Killing it..."
      kill -9 $PID 2>/dev/null
    fi
  fi
  # Retry loop: wait up to 5s for port to be free
  for i in 1 2 3 4 5; do
    if command -v fuser &> /dev/null; then
      fuser "${PORT}/tcp" &>/dev/null || { echo "  -> Port $PORT is free."; return 0; }
    elif command -v lsof &> /dev/null; then
      lsof -t -i:$PORT &>/dev/null || { echo "  -> Port $PORT is free."; return 0; }
    fi
    sleep 1
  done
  echo "  -> WARNING: Port $PORT still in use after 5s, trying harder..."
  if command -v fuser &> /dev/null; then fuser -k -9 "${PORT}/tcp" 2>/dev/null; fi
}
echo "[2/4] Clearing ports..."
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# 3. Build the frontend (Next.js production build)
echo "[3/5] Building frontend Next.js application..."
echo "  -> Using Node $(node -v) in $(pwd)"
npm run build

# 4. Check for PM2 processes
if command -v pm2 &> /dev/null; then
  echo "[4/5] PM2 detected. Checking running apps..."
  PM2_STATUS=$(pm2 list --mini 2>/dev/null)
  if [[ "$PM2_STATUS" == *"online"* ]]; then
    echo "  -> Active PM2 processes detected. Restarting all PM2 services..."
    pm2 restart all
    echo "=========================================="
    echo " Redeploy complete! PM2 services restarted."
    echo "=========================================="
    exit 0
  fi
fi

# 5. Standard startup
echo "[5/5] Starting dev servers concurrently..."
npm run dev
