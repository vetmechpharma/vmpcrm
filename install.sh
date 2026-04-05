#!/bin/bash
# ============================================================================
# VMP CRM - VPS Installation & Management Script
# For Ubuntu 22.04 / 24.04
# Usage: sudo bash install.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
CRM_DIR="/opt/vmpcrm"
REPO_URL=""
DOMAIN=""
ADMIN_EMAIL=""
ADMIN_PASS=""
MONGO_PORT=27017
BACKEND_PORT=8001
FRONTEND_PORT=3000
NGINX_INSTALLED=false
PROGRESS_FILE="/tmp/vmpcrm_install_progress.json"

# ============================================================================
# Helper functions
# ============================================================================

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

update_progress() {
    local step="$1"
    local status="$2"
    local message="$3"
    local percent="$4"
    echo "{\"step\":\"$step\",\"status\":\"$status\",\"message\":\"$message\",\"percent\":$percent,\"timestamp\":\"$(date -Iseconds)\"}" > "$PROGRESS_FILE"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (sudo bash install.sh)"
        exit 1
    fi
}

# ============================================================================
# Requirements Check
# ============================================================================

check_requirements() {
    log_step "Checking System Requirements"
    local all_ok=true
    local results="{"

    # OS Check
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "ubuntu" && ("$VERSION_ID" == "22.04" || "$VERSION_ID" == "24.04") ]]; then
            log_ok "OS: Ubuntu $VERSION_ID"
            results+="\"os\":{\"status\":\"ok\",\"version\":\"Ubuntu $VERSION_ID\"},"
        else
            log_warn "OS: $PRETTY_NAME (Ubuntu 22.04/24.04 recommended)"
            results+="\"os\":{\"status\":\"warn\",\"version\":\"$PRETTY_NAME\"},"
        fi
    fi

    # RAM Check (minimum 1GB)
    local total_ram=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -ge 1024 ]; then
        log_ok "RAM: ${total_ram}MB (minimum 1024MB)"
        results+="\"ram\":{\"status\":\"ok\",\"value\":\"${total_ram}MB\"},"
    else
        log_error "RAM: ${total_ram}MB (minimum 1024MB required)"
        results+="\"ram\":{\"status\":\"fail\",\"value\":\"${total_ram}MB\"},"
        all_ok=false
    fi

    # Disk Check (minimum 5GB free)
    local free_disk=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$free_disk" -ge 5 ]; then
        log_ok "Disk: ${free_disk}GB free (minimum 5GB)"
        results+="\"disk\":{\"status\":\"ok\",\"value\":\"${free_disk}GB free\"},"
    else
        log_error "Disk: ${free_disk}GB free (minimum 5GB required)"
        results+="\"disk\":{\"status\":\"fail\",\"value\":\"${free_disk}GB free\"},"
        all_ok=false
    fi

    # Check installed software
    for cmd in node npm python3 pip3 mongod nginx git; do
        if command -v $cmd &>/dev/null; then
            local ver=$($cmd --version 2>&1 | head -1)
            log_ok "$cmd: $ver"
            results+="\"$cmd\":{\"status\":\"ok\",\"version\":\"$ver\"},"
        else
            log_warn "$cmd: Not installed"
            results+="\"$cmd\":{\"status\":\"missing\",\"version\":\"not installed\"},"
        fi
    done

    # Port availability
    for port in $BACKEND_PORT $FRONTEND_PORT 80 443; do
        if ! ss -tlnp | grep -q ":$port "; then
            log_ok "Port $port: Available"
            results+="\"port_$port\":{\"status\":\"ok\"},"
        else
            log_warn "Port $port: In use"
            results+="\"port_$port\":{\"status\":\"in_use\"},"
        fi
    done

    results="${results%,}}"
    echo "$results" > /tmp/vmpcrm_requirements.json

    if $all_ok; then
        log_ok "All critical requirements met!"
        return 0
    else
        log_error "Some requirements not met. Installation may fail."
        return 1
    fi
}

# ============================================================================
# Software Installation
# ============================================================================

install_dependencies() {
    log_step "Installing System Dependencies"
    update_progress "dependencies" "running" "Updating system packages..." 5

    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git build-essential software-properties-common ufw

    # Node.js 20.x LTS
    update_progress "nodejs" "running" "Installing Node.js 20.x..." 15
    if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        npm install -g yarn pm2
    fi
    log_ok "Node.js $(node -v) installed"

    # Python 3.11+ with venv support
    update_progress "python" "running" "Installing Python & venv..." 25
    PYTHON_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0.0")
    PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "0")
    if [ "$PYTHON_MINOR" -lt 10 ]; then
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update -y
        apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
    else
        # Install venv for whatever Python 3.x version is present
        apt-get install -y python3-venv python3-dev python3-pip "python${PYTHON_VER}-venv" 2>/dev/null || \
        apt-get install -y python3-venv python3-dev python3-pip
    fi
    log_ok "Python $(python3 --version) installed with venv"

    # MongoDB 7.x
    update_progress "mongodb" "running" "Installing MongoDB 7.x..." 35
    if ! command -v mongod &>/dev/null; then
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        apt-get update
        apt-get install -y mongodb-org
    fi
    systemctl enable mongod
    systemctl start mongod
    log_ok "MongoDB installed and running"

    # Nginx
    update_progress "nginx" "running" "Installing Nginx..." 45
    if ! command -v nginx &>/dev/null; then
        apt-get install -y nginx
    fi
    systemctl enable nginx
    log_ok "Nginx installed"

    # Certbot for SSL
    update_progress "certbot" "running" "Installing Certbot..." 50
    apt-get install -y certbot python3-certbot-nginx
    log_ok "Certbot installed"
}

# ============================================================================
# Application Setup
# ============================================================================

setup_application() {
    log_step "Setting Up VMP CRM Application"
    update_progress "app_setup" "running" "Cloning application..." 55

    # Create app directory
    mkdir -p "$CRM_DIR"

    if [ -n "$REPO_URL" ]; then
        # Clone from Git
        if [ -d "$CRM_DIR/.git" ]; then
            cd "$CRM_DIR" || { log_error "Cannot enter $CRM_DIR"; exit 1; }
            git pull origin main
        else
            git clone "$REPO_URL" "$CRM_DIR"
        fi
    elif [ -f "/tmp/vmpcrm_upload.tar.gz" ]; then
        # Extract uploaded archive
        tar -xzf /tmp/vmpcrm_upload.tar.gz -C "$CRM_DIR"
    else
        log_error "No source specified. Provide REPO_URL or upload a tar.gz"
        exit 1
    fi

    cd "$CRM_DIR"

    # Backend setup
    update_progress "backend" "running" "Installing backend dependencies..." 60
    cd "$CRM_DIR/backend"

    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate

    # Create backend .env if not exists
    if [ ! -f .env ]; then
        cat > .env << ENVEOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="CRM_VETMECH"
CORS_ORIGINS="*"
JWT_SECRET="$(openssl rand -hex 32)"
ENVEOF
    fi
    log_ok "Backend dependencies installed"

    # Frontend setup
    update_progress "frontend" "running" "Installing frontend dependencies..." 70
    cd "$CRM_DIR/frontend"
    yarn install --production=false
    
    # Set backend URL in .env
    if [ -n "$DOMAIN" ]; then
        # Check if domain is an IP address
        if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "REACT_APP_BACKEND_URL=http://$DOMAIN" > .env
        else
            echo "REACT_APP_BACKEND_URL=https://$DOMAIN" > .env
        fi
    fi
    
    yarn build
    log_ok "Frontend built successfully"
}

# ============================================================================
# Nginx & SSL Configuration
# ============================================================================

configure_nginx() {
    log_step "Configuring Nginx & SSL"
    update_progress "nginx_config" "running" "Configuring Nginx..." 80

    cat > /etc/nginx/sites-available/vmpcrm << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend (React build)
    location / {
        root $CRM_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
NGINXEOF

    ln -sf /etc/nginx/sites-available/vmpcrm /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    log_ok "Nginx configured"

    # SSL with Let's Encrypt
    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
        update_progress "ssl" "running" "Setting up SSL certificate..." 85
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$ADMIN_EMAIL" --redirect || {
            log_warn "SSL setup failed. You can retry with: sudo certbot --nginx -d $DOMAIN"
        }
    fi
}

# ============================================================================
# Process Management (PM2)
# ============================================================================

setup_pm2() {
    log_step "Setting Up Process Manager"
    update_progress "pm2" "running" "Configuring PM2..." 90

    # Create PM2 ecosystem file
    cat > "$CRM_DIR/ecosystem.config.js" << PM2EOF
module.exports = {
  apps: [
    {
      name: 'vmpcrm-backend',
      cwd: '$CRM_DIR/backend',
      script: 'venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port $BACKEND_PORT',
      interpreter: 'none',
      env: {
        PATH: '$CRM_DIR/backend/venv/bin:' + process.env.PATH,
      },
      max_restarts: 10,
      watch: false,
    },
  ],
};
PM2EOF

    pm2 delete all 2>/dev/null || true
    pm2 start "$CRM_DIR/ecosystem.config.js"
    pm2 save
    pm2 startup systemd -u root --hp /root 2>/dev/null || true
    log_ok "PM2 process manager configured"
}

# ============================================================================
# Firewall Setup
# ============================================================================

setup_firewall() {
    log_step "Configuring Firewall"
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw --force enable
    log_ok "Firewall configured (SSH + HTTP/HTTPS allowed)"
}

# ============================================================================
# Update Application (Non-Destructive)
# ============================================================================

update_application() {
    log_step "Updating VMP CRM Application"
    update_progress "update" "running" "Updating application..." 10

    cd "$CRM_DIR"

    # Backup current state
    local backup_dir="/opt/vmpcrm_backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    mongodump --db CRM_VETMECH --out "$backup_dir/db_backup" 2>/dev/null || true
    log_ok "Database backed up to $backup_dir"

    if [ -n "$REPO_URL" ] || [ -d .git ]; then
        # Git-based update
        update_progress "update" "running" "Pulling latest code..." 30
        git stash 2>/dev/null || true
        git pull origin main
        git stash pop 2>/dev/null || true
    elif [ -f "/tmp/vmpcrm_upload.tar.gz" ]; then
        # Archive-based update - preserve .env and database
        update_progress "update" "running" "Extracting update package..." 30
        cp backend/.env /tmp/vmpcrm_backend_env_backup
        cp frontend/.env /tmp/vmpcrm_frontend_env_backup 2>/dev/null || true
        tar -xzf /tmp/vmpcrm_upload.tar.gz -C "$CRM_DIR" --overwrite
        cp /tmp/vmpcrm_backend_env_backup backend/.env
        cp /tmp/vmpcrm_frontend_env_backup frontend/.env 2>/dev/null || true
    fi

    # Update backend dependencies
    update_progress "update" "running" "Updating backend dependencies..." 50
    cd "$CRM_DIR/backend"
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate

    # Rebuild frontend
    update_progress "update" "running" "Rebuilding frontend..." 70
    cd "$CRM_DIR/frontend"
    yarn install
    yarn build

    # Restart services
    update_progress "update" "running" "Restarting services..." 90
    pm2 restart all
    systemctl reload nginx

    update_progress "update" "complete" "Update completed successfully!" 100
    log_ok "Application updated successfully!"
    log_ok "Database and settings preserved."
}

# ============================================================================
# Web Installer (serves status page)
# ============================================================================

setup_web_installer() {
    # Create a temporary installer page accessible at domain.com/install
    mkdir -p /var/www/vmpcrm-installer
    cat > /var/www/vmpcrm-installer/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VMP CRM - Installation</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .container { max-width: 680px; margin: 0 auto; padding: 40px 20px; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-size: 28px; color: #38bdf8; margin-bottom: 8px; }
  .header p { color: #94a3b8; font-size: 14px; }
  .card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #334155; }
  .card h2 { font-size: 16px; color: #f1f5f9; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .req-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #334155; }
  .req-row:last-child { border: none; }
  .req-label { color: #cbd5e1; font-size: 14px; }
  .req-value { font-size: 13px; padding: 4px 12px; border-radius: 20px; font-weight: 500; }
  .ok { background: #065f46; color: #34d399; }
  .warn { background: #78350f; color: #fbbf24; }
  .fail { background: #7f1d1d; color: #f87171; }
  .missing { background: #1e1b4b; color: #a5b4fc; }
  .progress-bar { background: #334155; border-radius: 8px; height: 8px; overflow: hidden; margin: 12px 0; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #818cf8); border-radius: 8px; transition: width 0.5s ease; }
  .step { padding: 8px 0; font-size: 13px; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
  .step.active { color: #38bdf8; }
  .step.done { color: #34d399; }
  .step.error { color: #f87171; }
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-primary { background: #3b82f6; color: #fff; }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { background: #475569; cursor: not-allowed; }
  .btn-danger { background: #dc2626; color: #fff; }
  .btn-outline { background: transparent; border: 1px solid #475569; color: #e2e8f0; }
  .btn-outline:hover { border-color: #38bdf8; color: #38bdf8; }
  .form-group { margin-bottom: 16px; }
  .form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .form-group input, .form-group select { width: 100%; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; }
  .form-group input:focus { outline: none; border-color: #38bdf8; }
  .actions { display: flex; gap: 12px; margin-top: 20px; }
  .log-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: 'Fira Code', monospace; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; color: #94a3b8; margin-top: 12px; }
  .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; }
  .status-badge.running { background: #1e3a5f; color: #38bdf8; }
  .status-badge.complete { background: #065f46; color: #34d399; }
  .status-badge.error { background: #7f1d1d; color: #f87171; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .pulse { animation: pulse 1.5s infinite; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>VMP CRM Installer</h1>
    <p>Automated deployment for Ubuntu 22.04 / 24.04</p>
  </div>

  <!-- Requirements Section -->
  <div class="card" id="req-card">
    <h2>System Requirements</h2>
    <div id="requirements">
      <p style="color:#94a3b8;font-size:13px;">Click "Check Requirements" to scan your system.</p>
    </div>
    <div class="actions">
      <button class="btn btn-outline" onclick="checkRequirements()">Check Requirements</button>
    </div>
  </div>

  <!-- Configuration Section -->
  <div class="card" id="config-card">
    <h2>Configuration</h2>
    <div class="form-group">
      <label>Domain Name *</label>
      <input type="text" id="domain" placeholder="crm.yourdomain.com" />
    </div>
    <div class="form-group">
      <label>Admin Email *</label>
      <input type="email" id="admin_email" placeholder="admin@example.com" />
    </div>
    <div class="form-group">
      <label>Admin Password *</label>
      <input type="password" id="admin_pass" placeholder="Strong password" />
    </div>
    <div class="form-group">
      <label>Source</label>
      <select id="source_type">
        <option value="git">Git Repository</option>
        <option value="upload">Upload Archive (.tar.gz)</option>
      </select>
    </div>
    <div class="form-group" id="git-url-group">
      <label>Git Repository URL</label>
      <input type="text" id="repo_url" placeholder="https://github.com/user/repo.git" />
    </div>
    <div class="form-group" id="upload-group" style="display:none;">
      <label>Upload Archive</label>
      <input type="file" id="archive_file" accept=".tar.gz,.tgz" />
    </div>
    <div class="actions">
      <button class="btn btn-primary" id="install-btn" onclick="startInstall()">Install VMP CRM</button>
      <button class="btn btn-outline" id="update-btn" onclick="startUpdate()">Update Existing</button>
    </div>
  </div>

  <!-- Progress Section -->
  <div class="card" id="progress-card" style="display:none;">
    <h2>Installation Progress</h2>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
    <div id="progress-steps"></div>
    <div class="log-box" id="log-box"></div>
  </div>
</div>

<script>
const sourceType = document.getElementById('source_type');
sourceType.addEventListener('change', () => {
  document.getElementById('git-url-group').style.display = sourceType.value === 'git' ? 'block' : 'none';
  document.getElementById('upload-group').style.display = sourceType.value === 'upload' ? 'block' : 'none';
});

async function checkRequirements() {
  const el = document.getElementById('requirements');
  el.innerHTML = '<p class="pulse" style="color:#38bdf8">Checking system requirements...</p>';
  try {
    const res = await fetch('/install/api/check-requirements');
    const data = await res.json();
    let html = '';
    for (const [key, val] of Object.entries(data)) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const statusClass = val.status === 'ok' ? 'ok' : val.status === 'warn' ? 'warn' : val.status === 'missing' ? 'missing' : 'fail';
      const display = val.version || val.value || val.status;
      html += '<div class="req-row"><span class="req-label">' + label + '</span><span class="req-value ' + statusClass + '">' + display + '</span></div>';
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<p style="color:#f87171">Failed to check requirements. Make sure the installer API is running.</p>';
  }
}

async function startInstall() {
  const domain = document.getElementById('domain').value;
  const email = document.getElementById('admin_email').value;
  const pass = document.getElementById('admin_pass').value;
  if (!domain || !email || !pass) { alert('Please fill all required fields'); return; }

  document.getElementById('progress-card').style.display = 'block';
  document.getElementById('install-btn').disabled = true;
  const logBox = document.getElementById('log-box');

  try {
    const body = { domain, admin_email: email, admin_password: pass, source_type: sourceType.value, repo_url: document.getElementById('repo_url').value };
    const res = await fetch('/install/api/start-install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { pollProgress(); }
    else { logBox.textContent = 'Failed to start installation: ' + (await res.text()); }
  } catch (e) { logBox.textContent = 'Error: ' + e.message; }
}

async function startUpdate() {
  if (!confirm('This will update the application while preserving the database. Continue?')) return;
  document.getElementById('progress-card').style.display = 'block';
  document.getElementById('update-btn').disabled = true;
  try {
    const res = await fetch('/install/api/start-update', { method: 'POST' });
    if (res.ok) { pollProgress(); }
  } catch (e) { document.getElementById('log-box').textContent = 'Error: ' + e.message; }
}

let pollTimer;
async function pollProgress() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/install/api/progress');
      const data = await res.json();
      document.getElementById('progress-fill').style.width = data.percent + '%';
      const stepsEl = document.getElementById('progress-steps');
      stepsEl.innerHTML = '<div class="step active">' + data.message + '</div>';
      if (data.log) { document.getElementById('log-box').textContent = data.log; }
      if (data.percent >= 100 || data.status === 'complete') {
        clearInterval(pollTimer);
        stepsEl.innerHTML = '<div class="step done">Installation complete! Redirecting...</div>';
        setTimeout(() => { window.location.href = 'https://' + document.getElementById('domain').value; }, 3000);
      } else if (data.status === 'error') {
        clearInterval(pollTimer);
        stepsEl.innerHTML = '<div class="step error">Installation failed: ' + data.message + '</div>';
        document.getElementById('install-btn').disabled = false;
      }
    } catch (e) {}
  }, 2000);
}
</script>
</body>
</html>
HTMLEOF

    # Create Nginx config for installer
    cat > /etc/nginx/sites-available/vmpcrm-installer << INSTEOF
server {
    listen 80 default_server;
    server_name _;

    location / {
        root /var/www/vmpcrm-installer;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /install/api/ {
        proxy_pass http://127.0.0.1:9090/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
INSTEOF

    ln -sf /etc/nginx/sites-available/vmpcrm-installer /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
}

# ============================================================================
# Installer API (lightweight Python HTTP server)
# ============================================================================

create_installer_api() {
    cat > /opt/vmpcrm-installer-api.py << 'PYEOF'
"""Lightweight installer API for web-based installation progress."""
import json
import subprocess
import threading
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

PROGRESS_FILE = "/tmp/vmpcrm_install_progress.json"
LOG_FILE = "/tmp/vmpcrm_install.log"

class InstallerHandler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.path == '/check-requirements':
            subprocess.run(['bash', '/opt/vmpcrm/install.sh', '--check-only'], capture_output=True)
            try:
                with open('/tmp/vmpcrm_requirements.json') as f:
                    data = f.read()
            except:
                data = '{"error": "Check failed"}'
            self.respond(200, data)

        elif self.path == '/progress':
            try:
                with open(PROGRESS_FILE) as f:
                    progress = json.load(f)
                log_text = ''
                if os.path.exists(LOG_FILE):
                    with open(LOG_FILE) as lf:
                        log_text = lf.read()[-5000:]
                progress['log'] = log_text
                self.respond(200, json.dumps(progress))
            except:
                self.respond(200, json.dumps({"step": "waiting", "status": "idle", "message": "Waiting...", "percent": 0}))
        else:
            self.respond(404, '{"error":"not found"}')

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len).decode() if content_len else '{}'
        config = json.loads(body) if body else {}

        if self.path == '/start-install':
            domain = config.get('domain', '')
            email = config.get('admin_email', '')
            password = config.get('admin_password', '')
            repo = config.get('repo_url', '')
            t = threading.Thread(target=run_install, args=(domain, email, password, repo))
            t.daemon = True
            t.start()
            self.respond(200, '{"status":"started"}')

        elif self.path == '/start-update':
            t = threading.Thread(target=run_update)
            t.daemon = True
            t.start()
            self.respond(200, '{"status":"started"}')
        else:
            self.respond(404, '{"error":"not found"}')

    def respond(self, code, body):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body.encode())

def run_install(domain, email, password, repo):
    cmd = f'bash /opt/vmpcrm/install.sh --install --domain="{domain}" --email="{email}" --password="{password}" --repo="{repo}" 2>&1 | tee {LOG_FILE}'
    subprocess.run(['bash', '-c', cmd])

def run_update():
    cmd = f'bash /opt/vmpcrm/install.sh --update 2>&1 | tee {LOG_FILE}'
    subprocess.run(['bash', '-c', cmd])

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 9090), InstallerHandler)
    print("Installer API running on port 9090")
    server.serve_forever()
PYEOF
    log_ok "Installer API created"
}

# ============================================================================
# Main Flow
# ============================================================================

main() {
    check_root

    # Fix getcwd errors from deleted directories
    cd /root 2>/dev/null || cd /tmp

    # Parse arguments
    local ACTION=""
    for arg in "$@"; do
        case $arg in
            --check-only)   ACTION="check" ;;
            --install)      ACTION="install" ;;
            --update)       ACTION="update" ;;
            --domain=*)     DOMAIN="${arg#*=}" ;;
            --email=*)      ADMIN_EMAIL="${arg#*=}" ;;
            --password=*)   ADMIN_PASS="${arg#*=}" ;;
            --repo=*)       REPO_URL="${arg#*=}" ;;
            --setup-web)    ACTION="setup-web" ;;
        esac
    done

    case $ACTION in
        check)
            check_requirements
            ;;
        install)
            echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
            echo -e "${CYAN}║      VMP CRM - Full Installation         ║${NC}"
            echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}\n"

            check_requirements || true
            install_dependencies
            setup_application
            configure_nginx
            setup_pm2
            setup_firewall

            update_progress "complete" "complete" "Installation completed!" 100

            echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║   Installation Complete!                 ║${NC}"
            echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
            echo -e "${GREEN}║  URL: https://$DOMAIN${NC}"
            echo -e "${GREEN}║  Admin: $ADMIN_EMAIL${NC}"
            echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
            ;;
        update)
            update_application
            ;;
        setup-web)
            setup_web_installer
            create_installer_api
            nohup python3 /opt/vmpcrm-installer-api.py &>/dev/null &
            log_ok "Web installer available at http://YOUR_IP/install"
            ;;
        *)
            # Interactive mode
            echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
            echo -e "${CYAN}║      VMP CRM - Server Management         ║${NC}"
            echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}\n"
            echo "Usage:"
            echo "  sudo bash install.sh --check-only        Check requirements"
            echo "  sudo bash install.sh --install \\          Full installation"
            echo "       --domain=crm.example.com \\"
            echo "       --email=admin@example.com \\"
            echo "       --password=YourPass \\"
            echo "       --repo=https://github.com/user/repo"
            echo "  sudo bash install.sh --update             Update without losing data"
            echo "  sudo bash install.sh --setup-web          Setup web installer UI"
            echo ""
            echo "Quick Start:"
            echo "  1. Run: sudo bash install.sh --setup-web"
            echo "  2. Open: http://YOUR_SERVER_IP in browser"
            echo "  3. Follow the web installer wizard"
            ;;
    esac
}

main "$@"
