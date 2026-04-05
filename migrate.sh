#!/bin/bash
# ============================================================================
# VMP CRM - Database Migration Script (Standalone)
# Non-destructive: Only adds new collections, indexes, fields, and defaults.
# Safe to run multiple times (idempotent).
#
# Usage:
#   sudo bash migrate.sh                    # Auto-detect venv and .env
#   sudo bash migrate.sh --mongo-url "mongodb://localhost:27017" --db-name "CRM_VETMECH"
# ============================================================================

set -e

GREEN='\033[92m'
YELLOW='\033[93m'
BLUE='\033[94m'
RED='\033[91m'
NC='\033[0m'

CRM_DIR="/opt/vmpcrm"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "\n${BLUE}━━━ VMP CRM Database Migration ━━━${NC}\n"

# Determine the backend directory
if [ -f "$SCRIPT_DIR/backend/migrate.py" ]; then
    BACKEND_DIR="$SCRIPT_DIR/backend"
elif [ -f "$CRM_DIR/backend/migrate.py" ]; then
    BACKEND_DIR="$CRM_DIR/backend"
elif [ -f "$SCRIPT_DIR/migrate.py" ]; then
    BACKEND_DIR="$SCRIPT_DIR"
else
    echo -e "${RED}[ERROR]${NC} Cannot find migrate.py. Run from the CRM root directory."
    exit 1
fi

echo -e "${BLUE}[INFO]${NC} Backend directory: $BACKEND_DIR"

# Activate venv if available
if [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
    source "$BACKEND_DIR/venv/bin/activate"
    echo -e "${GREEN}[OK]${NC} Virtual environment activated"
elif [ -f "$CRM_DIR/backend/venv/bin/activate" ]; then
    source "$CRM_DIR/backend/venv/bin/activate"
    echo -e "${GREEN}[OK]${NC} Virtual environment activated"
fi

# Run migration
cd "$BACKEND_DIR"
python3 migrate.py "$@"

EXIT_CODE=$?

# Deactivate venv
if command -v deactivate &>/dev/null; then
    deactivate 2>/dev/null || true
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}[OK]${NC} Migration completed successfully!"
    echo -e "${YELLOW}[NOTE]${NC} Restart the backend service to pick up any changes:"
    echo -e "  pm2 restart vmpcrm-backend"
else
    echo -e "\n${RED}[ERROR]${NC} Migration failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE
