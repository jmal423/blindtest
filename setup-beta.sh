#!/bin/bash
set -e

BETA_DIR="../beta-blindtest"
BACKEND_PORT=3006
FRONTEND_PORT=3002
REPO_URL="git@github.com:jmal423/blindtest.git"

echo "=========================================="
echo "   Setting up Beta Instance"
echo "=========================================="

if [ -d "$BETA_DIR" ]; then
  echo "Beta directory already exists at $BETA_DIR"
  echo "Run 'cd $BETA_DIR && git pull origin main' to update."
  exit 1
fi

echo "[1/4] Cloning repo to $BETA_DIR..."
git clone "$REPO_URL" "$BETA_DIR"

cd "$BETA_DIR"

echo "[2/4] Installing dependencies..."
(cd backend && npm install)
(cd frontend && npm install)

echo "[3/4] Creating beta-start.sh..."
cat > beta-start.sh << 'BETA_SCRIPT'
#!/bin/bash
set -e

cd "$(dirname "$0")"

BACKEND_PORT=3006
FRONTEND_PORT=3002

cleanup() {
  echo ""
  echo "Shutting down beta instance..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit
}
trap cleanup INT TERM

echo "=========================================="
echo "   Starting Beta Instance"
echo "   Backend: http://127.0.0.1:$BACKEND_PORT"
echo "   Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "=========================================="

PORT=$BACKEND_PORT HOST=127.0.0.1 npm run dev --prefix backend &
BACKEND_PID=$!

NEXT_PUBLIC_API_URL=http://127.0.0.1:$BACKEND_PORT npm run dev --prefix frontend -- -p $FRONTEND_PORT &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

wait
BETA_SCRIPT

chmod +x beta-start.sh

echo "[4/4] Done!"
echo ""
echo "To start beta, run:"
echo "  cd $BETA_DIR && ./beta-start.sh"
echo ""
echo "Access at:"
echo "  http://127.0.0.1:$FRONTEND_PORT"
