# OptiPlex Server Setup Guide

Ubuntu Server 26.04 LTS on OptiPlex i5 — full headless setup for blindtest backend + PostgreSQL.

## Step 1: Create Install USB

On your Mac:
```bash
# Download Ubuntu Server 26.04 LTS from:
# https://ubuntu.com/download/server

# Find your USB drive
diskutil list

# Flash it (replace /dev/diskN with your USB drive)
diskutil unmountDisk /dev/diskN
sudo dd if=ubuntu-26.04-live-server-amd64.iso of=/dev/diskN bs=4m status=progress
```

Or use **Balena Etcher** (easier): https://etcher.balena.io/

## Step 2: Install Ubuntu Server

1. Plug USB into OptiPlex, power on
2. Press F12 (or F2/F8 depending on model) to boot from USB
3. Install Ubuntu Server:
   - Language: English
   - Network: Wired (ethernet) — should auto-configure via DHCP
   - **Hostname**: `blindtest`
   - **Username**: `deploy` (or your preference)
   - **SSH**: Enable (install OpenSSH server)
   - **No** extra snaps/packages
4. Reboot, remove USB

## Step 3: Connect

```bash
# Find the IP from your router, or:
ssh deploy@blindtest.local

# If that doesn't work, scan your network:
# nmap -sn 192.168.1.0/24
# Look for the hostname "blindtest"
```

## Step 4: Initial Setup

```bash
# Update everything
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y curl git ufw

# Configure firewall
sudo ufw allow OpenSSH
sudo ufw enable
```

## Step 5: Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # v22.x
npm -v
```

## Step 6: Install PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql <<EOF
CREATE USER blindtest WITH PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD';
CREATE DATABASE blindtest OWNER blindtest;
EOF

# Tune for the OptiPlex (adjust based on your RAM)
# For 4GB RAM:
sudo tee /etc/postgresql/16/main/conf.d/blindtest.conf > /dev/null <<'EOF'
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 16MB
maintenance_work_mem = 128MB
max_connections = 50
listen_addresses = 'localhost'
EOF

# For 8GB+ RAM:
# shared_buffers = 1GB, effective_cache_size = 3GB, work_mem = 32MB

sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

## Step 7: Clone and Configure

```bash
cd /home/deploy
git clone https://github.com/jmal423/blindtest.git
cd blindtest/backend
npm install --production

# Create .env file
cat > .env <<'EOF'
DISCORD_CLIENT_ID=1512963941511332021
DISCORD_CLIENT_SECRET=L_sgWn3Ai_F94W569hOWplteodL7egQb
ADMIN_DISCORD_IDS=400699215208251403
JWT_SECRET=90af38de659e8a10a116a93f7fdf91076b2b986cf62ab7e3e97631df685a71cc
FRONTEND_URL=https://blindtest-wheat.vercel.app
PORT=3001
DATABASE_URL=postgresql://blindtest:CHANGE_ME_TO_A_STRONG_PASSWORD@localhost:5432/blindtest
DISCORD_ALLOWED_GUILD_ID=1364880507636023379
EOF

# CHANGE THE PASSWORD in both .env and the PostgreSQL command above!
```

## Step 8: Create Systemd Service

```bash
sudo tee /etc/systemd/system/blindtest.service > /dev/null <<'EOF'
[Unit]
Description=BlindTest Backend
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/blindtest/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable blindtest
sudo systemctl start blindtest
sudo systemctl status blindtest
```

## Step 9: Expose to Internet with Cloudflare Tunnel

This replaces Railway — free, automatic HTTPS, no port forwarding.

### 9a. Install cloudflared

```bash
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared -y
```

### 9b. Create tunnel

```bash
# Login (opens browser to authorize)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create blindtest
# Note the tunnel ID from output!

# Configure
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: <PASTE_TUNNEL_ID>
credentials-file: /home/deploy/.cloudflared/<PASTE_TUNNEL_ID>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# Add DNS record (requires a domain on Cloudflare)
cloudflared tunnel route dns <TUNNEL_ID> api.yourdomain.com

# Test
cloudflared tunnel run blindtest
# Should show "Connection ... registered" — Ctrl+C when confirmed
```

### 9c. Run as service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### No domain? Use a free trycloudflare.com tunnel for testing:

```bash
cloudflared tunnel --url http://localhost:3001
# Gives you a URL like https://random-words.trycloudflare.com
# URL changes on each restart — not for production
```

## Step 10: Update Discord OAuth

1. Go to https://discord.com/developers/applications
2. Select your app → OAuth2 → General
3. Add redirect: `https://api.yourdomain.com/api/auth/discord/callback`
4. Save

## Step 11: Update Vercel Environment

In Vercel dashboard → your project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://api.yourdomain.com
```

Then redeploy.

## Deploying Updates

### Manual (simplest)
```bash
ssh deploy@blindtest
cd blindtest
git pull
cd backend
npm install
sudo systemctl restart blindtest
```

### Auto-deploy (optional, see below)

## Auto-Deploy with GitHub Webhook

Add this to the blindtest backend:

Then add a GitHub webhook:
1. GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://api.yourdomain.com/api/deploy?token=YOUR_SECRET`
3. Content type: application/json
4. Events: Just push events

## Useful Commands

```bash
# Check app status
sudo systemctl status blindtest

# View live logs
sudo journalctl -u blindtest -f

# View last 100 logs
sudo journalctl -u blindtest -n 100

# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -d blindtest -c "SELECT COUNT(*) FROM users;"

# Check memory
free -h

# Check disk
df -h

# Restart everything
sudo systemctl restart postgresql blindtest

# Test the API
curl http://localhost:3001/api/health
```

## Cost Summary

| Component | Where | Monthly Cost |
|-----------|-------|-------------|
| Frontend | Vercel Free | €0 |
| Backend | OptiPlex | €0 (existing hw) |
| Database | OptiPlex | €0 |
| HTTPS/Domain | Cloudflare Tunnel | €0 |
| Electricity | ~30W idle | ~€2-3/mo |
| **Total** | | **~€3/mo** |