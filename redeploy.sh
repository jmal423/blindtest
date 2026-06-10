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
echo "[2/4] Clearing ports..."
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=""
  if command -v lsof &> /dev/null; then
    PID=$(lsof -t -i:$PORT 2>/dev/null)
  elif command -v ss &> /dev/null; then
    PID=$(ss -lptn "sport = :$PORT" 2>/dev/null | grep -oE "pid=[0-9]+" | head -n 1 | cut -d= -f2)
  fi

  if [ ! -z "$PID" ]; then
    echo "  -> Found process $PID on port $PORT. Killing it..."
    kill -9 $PID 2>/dev/null
  else
    echo "  -> Port $PORT is free."
  fi
done

# 3. Build the frontend (Next.js production build)
echo "[3/5] Building frontend Next.js application..."
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
