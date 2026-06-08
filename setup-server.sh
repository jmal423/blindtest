#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# BlindTest Server Setup Script
# Run this on a fresh Ubuntu Server 26.04 install
# 
# Usage: curl -sL https://raw.githubusercontent.com/jmal423/blindtest/main/setup-server.sh | sudo bash -s -- --db-password=YOUR_PASSWORD --domain=api.yourdomain.com
# 
# Or: git clone https://github.com/jmal423/blindtest.git && cd blindtest && sudo bash setup-server.sh --db-password=YOUR_PASSWORD
# ============================================================

# --- Parse args ---
DB_PASSWORD="blindtest_pwd"
DOMAIN=""
SKIP_CLOUDFLARE=false
SKIP_NODE=false

for arg in "$@"; do
  case $arg in
    --db-password=*) DB_PASSWORD="${arg#*=}" ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
    --skip-cloudflare) SKIP_CLOUDFLARE=true ;;
    --skip-node) SKIP_NODE=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

echo "=========================================="
echo "  BlindTest Server Setup"
echo "  DB Password: ****"
echo "  Domain: ${DOMAIN:-not set (no Cloudflare tunnel)}"
echo "=========================================="

# --- System update ---
echo ""
echo "[1/8] Updating system..."
apt update && apt upgrade -y
apt install -y curl git ufw software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# --- Firewall ---
echo ""
echo "[2/8] Configuring firewall..."
ufw allow OpenSSH
ufw --force enable

# --- PostgreSQL ---
echo ""
echo "[3/8] Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

sudo -u postgres psql <<EOF
CREATE USER blindtest WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE blindtest OWNER blindtest;
EOF

DETECTED_RAM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$DETECTED_RAM" -le 2048 ]; then
  PG_SHARED="128MB"
  PG_CACHE="256MB"
  PG_WORK="4MB"
elif [ "$DETECTED_RAM" -le 4096 ]; then
  PG_SHARED="256MB"
  PG_CACHE="768MB"
  PG_WORK="8MB"
elif [ "$DETECTED_RAM" -le 8192 ]; then
  PG_SHARED="512MB"
  PG_CACHE="1536MB"
  PG_WORK="16MB"
else
  PG_SHARED="1GB"
  PG_CACHE="3GB"
  PG_WORK="32MB"
fi

PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main/conf.d"
mkdir -p "$PG_CONF_DIR"

tee "$PG_CONF_DIR/blindtest.conf" > /dev/null <<EOF
shared_buffers = ${PG_SHARED}
effective_cache_size = ${PG_CACHE}
work_mem = ${PG_WORK}
maintenance_work_mem = 128MB
max_connections = 50
listen_addresses = 'localhost'
EOF

systemctl restart postgresql
systemctl enable postgresql

# --- Node.js ---
if [ "$SKIP_NODE" = false ]; then
  echo ""
  echo "[4/8] Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
  node -v
  npm -v
else
  echo ""
  echo "[4/8] Skipping Node.js (already installed)"
  node -v 2>/dev/null || { echo "Node.js not found! Remove --skip-node or install manually."; exit 1; }
fi

# --- App ---
echo ""
echo "[5/8] Setting up BlindTest app..."

APP_DIR="/opt/blindtest"
REPO_DIR="/home/$(logname 2>/dev/null || echo 'deploy')/blindtest"

# Clone if not already present
if [ ! -d "$REPO_DIR" ]; then
  cd /home/$(logname 2>/dev/null || echo 'deploy')
  git clone https://github.com/jmal423/blindtest.git
fi

# Create app directory and link
mkdir -p "$APP_DIR/app"
cp -r "$REPO_DIR/backend"/* "$APP_DIR/app/"
cd "$APP_DIR/app"
npm install --production

# --- .env ---
echo ""
echo "[6/8] Creating .env file..."

cat > "$APP_DIR/app/.env" <<EOF
DISCORD_CLIENT_ID=1512963941511332021
DISCORD_CLIENT_SECRET=L_sgWn3Ai_F94W569hOWplteodL7egQb
ADMIN_DISCORD_IDS=400699215208251403
JWT_SECRET=90af38de659e8a10a116a93f7fdf91076b2b986cf62ab7e3e97631df685a71cc
FRONTEND_URL=https://blindtest-wheat.vercel.app
PORT=3001
DATABASE_URL=postgresql://blindtest:${DB_PASSWORD}@localhost:5432/blindtest
DISCORD_ALLOWED_GUILD_ID=1364880507636023379
NODE_ENV=production
EOF

chmod 600 "$APP_DIR/app/.env"

# --- Systemd service ---
echo ""
echo "[7/8] Creating systemd service..."

DEPLOY_USER=$(logname 2>/dev/null || echo 'root')

tee /etc/systemd/system/blindtest.service > /dev/null <<EOF
[Unit]
Description=BlindTest Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${DEPLOY_USER}
WorkingDirectory=${APP_DIR}/app
ExecStart=$(which node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable blindtest
systemctl start blindtest

echo "Waiting for service to start..."
sleep 3

if systemctl is-active --quiet blindtest; then
  echo "✓ BlindTest backend is running!"
else
  echo "✗ Service failed to start. Check logs:"
  journalctl -u blindtest -n 30
  exit 1
fi

# --- Cloudflare Tunnel ---
echo ""
echo "[8/8] Setting up Cloudflare Tunnel..."

if [ "$SKIP_CLOUDFLARE" = false ] && [ -n "$DOMAIN" ]; then
  curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list
  apt update && apt install -y cloudflared

  echo ""
  echo "=========================================="
  echo "  Cloudflare Tunnel Setup Required"
  echo "=========================================="
  echo ""
  echo "Run these commands as the deploy user:"
  echo ""
  echo "  cloudflared tunnel login"
  echo "  cloudflared tunnel create blindtest"
  echo ""
  echo "  # Then edit ~/.cloudflared/config.yml with the tunnel ID"
  echo "  # (see SERVER_SETUP.md for details)"
  echo ""
  echo "  cloudflared tunnel route dns <TUNNEL_ID> ${DOMAIN}"
  echo "  sudo cloudflared service install"
  echo ""
  echo "=========================================="
else
  echo "Skipping Cloudflare Tunnel setup."
  echo "To expose the server later, see SERVER_SETUP.md"
fi

# --- Done ---
echo ""
echo "=========================================="
echo "  ✓ Setup Complete!"
echo "=========================================="
echo ""
echo "Backend is running on http://localhost:3001"
echo "Test: curl http://localhost:3001/api/health"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status blindtest    # Check status"
echo "  sudo journalctl -u blindtest -f    # View logs"
echo "  sudo systemctl restart blindtest    # Restart"
echo ""
if [ -z "$DOMAIN" ]; then
  echo "⚠  Backend is only accessible locally."
  echo "   To expose to the internet, set up Cloudflare Tunnel."
  echo "   See SERVER_SETUP.md for instructions."
fi