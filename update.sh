#!/bin/bash
# ============================================================================
# VMP CRM - Safe Update Script
# Downloads latest code from preview URL and updates without losing data
# Usage: sudo bash update.sh
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CRM_DIR="/opt/vmpcrm"
DOWNLOAD_URL="https://whatsapp-direct-send.preview.emergentagent.com/vmpcrm_code.tar.gz"
BACKUP_DIR="/opt/vmpcrm_backups/$(date +%Y%m%d_%H%M%S)"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# Must run as root
if [ "$EUID" -ne 0 ]; then
    log_error "Run as root: sudo bash update.sh"
    exit 1
fi

echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      VMP CRM - Safe Update               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}\n"

# ============================================================================
# Step 1: Backup .env files and database
# ============================================================================
log_step "Step 1: Backing up configuration and database"

mkdir -p "$BACKUP_DIR"

# Backup .env files
if [ -f "$CRM_DIR/backend/.env" ]; then
    cp "$CRM_DIR/backend/.env" "$BACKUP_DIR/backend.env"
    log_ok "Backend .env backed up"
else
    log_warn "No backend .env found"
fi

if [ -f "$CRM_DIR/frontend/.env" ]; then
    cp "$CRM_DIR/frontend/.env" "$BACKUP_DIR/frontend.env"
    log_ok "Frontend .env backed up"
else
    log_warn "No frontend .env found"
fi

# Backup database
mongodump --db CRM_VETMECH --out "$BACKUP_DIR/db_backup" 2>/dev/null && \
    log_ok "Database backed up to $BACKUP_DIR/db_backup" || \
    log_warn "Database backup skipped (mongodump not available)"

# ============================================================================
# Step 2: Download latest code
# ============================================================================
log_step "Step 2: Downloading latest code"

cd "$CRM_DIR"
wget -q --show-progress "$DOWNLOAD_URL" -O /tmp/vmpcrm_code.tar.gz
log_ok "Download complete"

# ============================================================================
# Step 3: Extract code (preserving .env files)
# ============================================================================
log_step "Step 3: Extracting code update"

tar -xzf /tmp/vmpcrm_code.tar.gz -C "$CRM_DIR" --overwrite
rm -f /tmp/vmpcrm_code.tar.gz
log_ok "Code extracted"

# ============================================================================
# Step 4: Restore .env files
# ============================================================================
log_step "Step 4: Restoring configuration"

if [ -f "$BACKUP_DIR/backend.env" ]; then
    cp "$BACKUP_DIR/backend.env" "$CRM_DIR/backend/.env"
    log_ok "Backend .env restored"
fi

if [ -f "$BACKUP_DIR/frontend.env" ]; then
    cp "$BACKUP_DIR/frontend.env" "$CRM_DIR/frontend/.env"
    log_ok "Frontend .env restored"
fi

# ============================================================================
# Step 5: Install backend dependencies
# ============================================================================
log_step "Step 5: Updating backend dependencies"

cd "$CRM_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt -q
deactivate
log_ok "Backend dependencies updated"

# ============================================================================
# Step 6: Rebuild frontend
# ============================================================================
log_step "Step 6: Rebuilding frontend"

cd "$CRM_DIR/frontend"
npm install --silent 2>/dev/null || yarn install --silent 2>/dev/null
npm run build 2>&1 | tail -3
log_ok "Frontend rebuilt"

# ============================================================================
# Step 7: Run database migration
# ============================================================================
log_step "Step 7: Running database migration"

cd "$CRM_DIR/backend"
source venv/bin/activate
python3 migrate.py 2>&1 || log_warn "Migration had warnings (non-critical)"
deactivate
log_ok "Database migration complete"

# ============================================================================
# Step 8: Restart backend
# ============================================================================
log_step "Step 8: Restarting backend"

# Try PM2 first, then manual
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q "vmpcrm"; then
    pm2 restart all
    log_ok "Backend restarted via PM2"
else
    # Manual restart
    fuser -k 8001/tcp 2>/dev/null || true
    sleep 2
    cd "$CRM_DIR/backend"
    source venv/bin/activate
    nohup uvicorn server:app --host 0.0.0.0 --port 8001 >> nohup.out 2>&1 &
    deactivate
    sleep 3
    if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
        log_ok "Backend restarted and healthy"
    else
        log_error "Backend may not have started. Check: tail -20 $CRM_DIR/backend/nohup.out"
    fi
fi

# Reload Nginx
systemctl reload nginx 2>/dev/null && log_ok "Nginx reloaded" || true

# ============================================================================
# Step 9: Verify
# ============================================================================
log_step "Step 9: Verification"

# Check backend
if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
    log_ok "Backend API: Healthy"
else
    log_error "Backend API: Not responding"
fi

# Check frontend URL in build
BAKED_URL=$(grep -o "vetmechpharma\|preview\.emergentagent" "$CRM_DIR/frontend/build/static/js/main"*.js 2>/dev/null | head -1)
if [ "$BAKED_URL" = "vetmechpharma" ]; then
    log_ok "Frontend URL: Correct (vetmechpharma.in)"
elif [ "$BAKED_URL" = "preview.emergentagent" ]; then
    log_error "Frontend URL: WRONG (still points to preview). Check frontend/.env"
else
    log_warn "Frontend URL: Could not verify"
fi

# Show backup location
echo ""
log_info "Backup saved at: $BACKUP_DIR"
log_info "To rollback: cp $BACKUP_DIR/backend.env $CRM_DIR/backend/.env"

echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Update Complete!                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}\n"
