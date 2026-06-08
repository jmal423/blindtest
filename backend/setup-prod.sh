#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/blindtest"
BACKEND_DIR="$REPO_DIR/backend"
DB_NAME="blindtest"
DB_USER="blindtest_user"

echo "=== Step 1: Fix repo ownership ==="
sudo chown -R $USER:$USER "$REPO_DIR"
echo "Done."

echo "=== Step 2: Create PostgreSQL database and user ==="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'blindtest_pass';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo "Done."

echo "=== Step 3: Create .env ==="
cat > "$BACKEND_DIR/.env" << 'ENVEOF'
# === Database (PostgreSQL) ===
DATABASE_URL=postgresql://blindtest_user:blindtest_pass@localhost:5432/blindtest

# === Audio source: Deezer (free, no API key needed) ===
# No API keys required for music

# === Authentication (Discord OAuth2) ===
DISCORD_CLIENT_ID=1512963941511332021
DISCORD_CLIENT_SECRET=L_sgWn3Ai_F94W569hOWplteodL7egQb
JWT_SECRET=90af38de659e8a10a116a93f7fdf91076b2b986cf62ab7e3e97631df685a71cc

# === Discord guild gating ===
DISCORD_ALLOWED_GUILD_ID=1364880507636023379

# === Admin users by Discord ID ===
ADMIN_DISCORD_IDS=400699215208251403

# === Server ===
PORT=3001

# === Frontend URL (for CORS, OAuth redirects) ===
FRONTEND_URL=https://blindtest-wheat.vercel.app
ENVEOF
echo "Done."

echo "=== Step 4: npm install ==="
cd "$BACKEND_DIR"
npm install --production
echo "Done."

echo "=== Step 5: Create systemd service ==="
sudo tee /etc/systemd/system/blindtest-backend.service > /dev/null << 'SERVICEOF'
[Unit]
Description=BlindTest Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=jalfaiat
WorkingDirectory=/home/jalfaiat/blindtest/backend
ExecStart=/usr/bin/node /home/jalfaiat/blindtest/backend/src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEOF
echo "Done."

echo "=== Step 6: Start backend ==="
sudo systemctl daemon-reload
sudo systemctl enable blindtest-backend
sudo systemctl start blindtest-backend
sleep 2
sudo systemctl status blindtest-backend --no-pager
echo "Done."

echo ""
echo "=== Setup complete! ==="
echo "Check logs with: sudo journalctl -u blindtest-backend -f"
echo "Check status with: sudo systemctl status blindtest-backend"
