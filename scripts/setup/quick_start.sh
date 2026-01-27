#!/bin/bash
# =============================================================================
# Quick Start Script for Backr
# =============================================================================
# One-command setup for local development. Starts ledger, uploads DARs,
# and starts the API + frontend.
#
# Usage:
#   ./quick_start.sh [--fresh] [--skip-ledger]
#
# Options:
#   --fresh        Refresh ledger (stop, clean, restart)
#   --skip-ledger  Skip ledger startup (assume it's already running)
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKR_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Options
FRESH_LEDGER=false
SKIP_LEDGER=false
SKIP_SERVICES=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

#############################################################################
# Parse Arguments
#############################################################################

while [[ $# -gt 0 ]]; do
  case $1 in
    --fresh)
      FRESH_LEDGER=true
      shift
      ;;
    --skip-ledger)
      SKIP_LEDGER=true
      shift
      ;;
    --skip-services)
      SKIP_SERVICES=true
      shift
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--fresh] [--skip-ledger] [--skip-services]

Quick Start Script - One-command setup for Backr local development.

Options:
  --fresh          Refresh ledger (stop, clean, restart)
  --skip-ledger    Skip ledger startup (assume it's already running)
  --skip-services  Skip starting API and Web (just setup)
  -h, --help       Show this help message

This script will:
  1. Start the Canton ledger (unless --skip-ledger)
  2. Install dependencies
  3. Upload DAR files
  4. Start the API server
  5. Start the frontend

EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

#############################################################################
# Main
#############################################################################

echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}                    BACKR QUICK START                          ${NC}"
echo -e "${CYAN}================================================================${NC}"
echo ""

cd "$BACKR_ROOT"

# Step 1: Ledger
if [ "$SKIP_LEDGER" = false ]; then
  echo -e "${BLUE}[1/5] Starting Canton Ledger...${NC}"
  echo "  Checking if ledger is running..."
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3975/v2/state/ledger-end 2>/dev/null | grep -q "401"; then
    echo -e "  ${GREEN}+ Ledger already running${NC}"
  else
    echo "  Starting ledger..."
    if [ -f "$SCRIPT_DIR/start_ledger.sh" ]; then
      "$SCRIPT_DIR/start_ledger.sh" --wait 2>/dev/null || {
        echo -e "  ${YELLOW}! Could not start ledger automatically${NC}"
        echo "  Please start Canton Quickstart manually:"
        echo "    cd ~/code/cn-quickstart/quickstart && make start"
        exit 1
      }
    else
      echo -e "  ${YELLOW}! start_ledger.sh not found${NC}"
      echo "  Please start Canton Quickstart manually"
      exit 1
    fi
  fi
else
  echo -e "${BLUE}[1/5] Skipping ledger startup${NC}"
fi

# Step 2: Install dependencies
echo ""
echo -e "${BLUE}[2/5] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  pnpm install
else
  echo -e "  ${GREEN}+ Dependencies already installed${NC}"
fi

# Step 3: Upload DARs
echo ""
echo -e "${BLUE}[3/5] Uploading DARs...${NC}"
"$SCRIPT_DIR/upload_dars.sh" local || {
  echo -e "  ${YELLOW}! DAR upload had issues (continuing anyway)${NC}"
}

# Step 4 & 5: Start services
if [ "$SKIP_SERVICES" = false ]; then
  echo ""
  echo -e "${BLUE}[4/5] Starting Backr API...${NC}"

  # Start API in background
  echo "  Starting API server..."
  cd "$BACKR_ROOT"
  pnpm --filter @backr/api dev &
  API_PID=$!

  # Wait a moment for API to start
  sleep 3

  echo ""
  echo -e "${BLUE}[5/5] Starting Backr Web...${NC}"

  # Start frontend in background
  echo "  Starting frontend..."
  pnpm --filter @backr/web dev &
  WEB_PID=$!

  # Wait a moment
  sleep 3

  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}                    BACKR IS RUNNING!                          ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo ""
  echo "  Frontend:  http://localhost:5173"
  echo "  API:       http://localhost:4001"
  echo "  API Docs:  http://localhost:4001/docs"
  echo ""
  echo "  Keycloak:  http://keycloak.localhost:8082"
  echo "  Wallet:    http://wallet.localhost:3000"
  echo ""
  echo "  Press Ctrl+C to stop all services"
  echo ""

  # Wait for processes
  wait $API_PID $WEB_PID
else
  echo ""
  echo -e "${BLUE}[4/5] Skipping API startup${NC}"
  echo -e "${BLUE}[5/5] Skipping Web startup${NC}"

  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}                    SETUP COMPLETE!                            ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo ""
  echo "To start services manually:"
  echo "  pnpm --filter @backr/api dev"
  echo "  pnpm --filter @backr/web dev"
  echo ""
fi
