# Raspberry Pi Deployment Guide

## Overview

Host the blindtest backend on your Pi 2 Model B (1GB RAM, ARMv7, 8GB SD).

> **Recommendation**: Get a 16GB+ SD card when you can. 8GB will work but 
> leaves very little free space.

## Step 1: Flash Raspberry Pi OS Lite

1. Download **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Choose OS → **Raspberry Pi OS (Legacy, 32-bit) Lite** (Bullseye, no desktop)
3. Choose your 8GB SD card
4. Before writing, click the gear icon and:
   - Set hostname: `blindtest`
   - Enable SSH → Use password auth
   - Set username: `pi` / password: pick one you'll remember
   - Configure wireless LAN → enter your WiFi
   - Set locale → Europe/Paris (or your timezone)
5. Write the image
6. Boot the Pi and wait ~2 minutes for first boot

## Step 2: Connect and Update

```bash
ssh pi@blindtest.local
# or: ssh pi@<PI_IP_ADDRESS>

# Update system
sudo apt update && sudo apt upgrade -y

# Add swap (1GB RAM is tight)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Step 3: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # should show v20.x
```

## Step 4: Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER blindtest WITH PASSWORD 'blindtest_pwd';
CREATE DATABASE blindtest OWNER blindtest;
EOF
```

### Tune PostgreSQL for low memory

```bash
sudo tee /etc/postgresql/13/main/conf.d/lowmem.conf > /dev/null <<'EOF'
shared_buffers = 128MB
effective_cache_size = 256MB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 20
EOF

sudo systemctl restart postgresql
```

## Step 5: Clone and Build the App

```bash
cd /home/pi
git clone https://github.com/jmal423/blindtest.git
cd blindtest
```

## Step 6: Configure Environment

```bash
cat > backend/.env <<'EOF'
DISCORD_CLIENT_ID=1512963941511332021
DISCORD_CLIENT_SECRET=L_sgWn3Ai_F94W569hOWplteodL7egQb
ADMIN_DISCORD_IDS=400699215208251403
JWT_SECRET=90af38de659e8a10a116a93f7fdf91076b2b986cf62ab7e3e97631df685a71cc
FRONTEND_URL=https://blindtest-wheat.vercel.app
PORT=3001
DATABASE_URL=postgresql://blindtest:blindtest_pwd@localhost:5432/blindtest
DISCORD_ALLOWED_GUILD_ID=1364880507636023379
EOF
```

## Step 7: Install Dependencies and Run

```bash
cd /home/pi/blindtest/backend
npm install
npm start
```

The server should start on port 3001. Test it:
```bash
curl http://localhost:3001/api/health
```

## Step 8: Create a Systemd Service (auto-start on boot)

```bash
sudo tee /etc/systemd/system/blindtest.service > /dev/null <<'EOF'
[Unit]
Description=BlindTest Backend
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/blindtest/backend
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

This is the easiest free way to make your Pi accessible from Vercel without 
opening router ports.

### Option A: Cloudflare Tunnel (recommended, free)

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Add a domain to Cloudflare (or use one you already have)
3. Install cloudflared on the Pi:

```bash
sudo apt install -y cloudflared
cloudflared tunnel login
# This will give you a URL — open it in your browser to authorize

# Create a tunnel
cloudflared tunnel create blindtest
# Note the tunnel ID from the output

# Configure the tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<'EOF'
tunnel: <TUNNEL_ID_FROM_ABOVE>
credentials-file: /home/pi/.cloudflared/<TUNNEL_ID_FROM_ABOVE>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# Add DNS record
cloudflared tunnel route dns <TUNNEL_ID_FROM_ABOVE> api.yourdomain.com

# Test it
cloudflared tunnel run blindtest
```

4. Set up cloudflared as a service:

```bash
sudo cloudflared service install
```

5. Update your Vercel env vars:
   - `NEXT_PUBLIC_API_URL` → `https://api.yourdomain.com`

6. Update your Discord OAuth redirect:
   - In Discord Developer Portal, add `https://api.yourdomain.com/api/auth/discord/callback`
   - Update `FRONTEND_URL` in your `.env` if needed

### Option B: Quick tunnel (for testing, URL changes each restart)

```bash
cloudflared tunnel --url http://localhost:3001
# This gives you a temporary URL like https://xxx.trycloudflare.com
# Good for testing, not for production (URL changes on restart)
```

### Option C: ngrok (alternative, similar setup)

```bash
# Sign up at ngrok.com, get authtoken
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
ngrok config add-authtoken <YOUR_TOKEN>
ngrok http 3001
```

## Step 10: Update Discord OAuth Settings

1. Go to https://discord.com/developers/applications
2. Select your app
3. Under OAuth2 → General → Redirects, add:
   - `https://api.yourdomain.com/api/auth/discord/callback`
4. Copy the new URL

## Step 11: Update Vercel Environment

In Vercel dashboard → your project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://api.yourdomain.com
```

Redeploy Vercel after changing env vars.

## Managing the App

```bash
# Check status
sudo systemctl status blindtest

# View logs
sudo journalctl -u blindtest -f

# Restart after code changes
cd /home/pi/blindtest
git pull
cd backend
npm install
sudo systemctl restart blindtest

# Check PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -d blindtest -c "SELECT COUNT(*) FROM users;"
```

## Memory-Saving Tips

The Pi 2 has only 1GB RAM. If things get slow:

```bash
# Check memory usage
free -h

# Reduce Node.js heap to 256MB
# Edit /etc/systemd/system/blindtest.service:
# ExecStart=/usr/bin/node --max-old-space-size=256 src/index.js
```

## Troubleshooting

- **Can't connect via SSH**: Check Pi IP in your router's DHCP table
- **PostgreSQL won't start**: Check `sudo journalctl -u postgresql`
- **App crashes on start**: Check `sudo journalctl -u blindtest`
- **Out of disk space**: `df -h` to check, `sudo apt clean` to free space
- **Out of memory**: `dmesg | grep -i oom` to check for OOM kills