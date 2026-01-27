#!/bin/bash
# =============================================================================
# Start Ledger Script for Backr
# =============================================================================
# Starts the Canton quickstart ledger without cleaning existing data.
#
# Usage:
#   ./start_ledger.sh [--wait] [--no-wait]
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../config/load_env.sh" local

WAIT_FOR_SERVICES=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --wait) WAIT_FOR_SERVICES=true; shift ;;
    --no-wait) WAIT_FOR_SERVICES=false; shift ;;
    -h|--help)
      echo "Usage: $0 [--wait] [--no-wait]"
      echo "Starts the Canton quickstart ledger."
      exit 0
      ;;
    *) shift ;;
  esac
done

check_service() {
  local url="$1"
  local expected="$2"
  curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "$expected"
}

wait_for_services() {
  local max=60 attempt=1
  echo "Waiting for services..."
  while [ $attempt -le $max ]; do
    local ready=true
    check_service "http://keycloak.localhost:8082/realms/AppProvider" "200" || ready=false
    check_service "http://localhost:3975/v2/state/ledger-end" "401" || ready=false

    if $ready; then
      echo -e "${GREEN}Services ready${NC}"
      return 0
    fi
    sleep 5
    ((attempt++))
  done
  echo -e "${RED}Timeout waiting for services${NC}"
  return 1
}

echo -e "${CYAN}Starting Canton Ledger...${NC}"

if [ ! -d "$CANTON_QUICKSTART_DIR" ]; then
  echo -e "${RED}Canton quickstart not found: $CANTON_QUICKSTART_DIR${NC}"
  echo ""
  echo "Please set CANTON_QUICKSTART_DIR in scripts/config/.env.local"
  echo "or clone cn-quickstart to ~/code/cn-quickstart"
  exit 1
fi

cd "$CANTON_QUICKSTART_DIR"

# Check if already running
if check_service "http://localhost:3975/v2/state/ledger-end" "401"; then
  echo -e "${GREEN}Ledger already running${NC}"
  exit 0
fi

# Start using make
echo "Running: make start"
make start 2>&1

if $WAIT_FOR_SERVICES; then
  wait_for_services
fi

echo -e "${GREEN}Ledger started${NC}"
