#!/bin/bash
# =============================================================================
# Refresh Ledger Script for Backr
# =============================================================================
# Stops, cleans, and restarts the Canton quickstart ledger.
# This gives a completely fresh ledger state for testing.
#
# Usage:
#   ./refresh_ledger.sh [--wait] [--no-wait]
#
# Prerequisites:
#   - Canton quickstart must be set up at CANTON_QUICKSTART_DIR
#   - Docker must be running
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment (if config exists)
if [ -f "$SCRIPT_DIR/../config/load_env.sh" ]; then
  source "$SCRIPT_DIR/../config/load_env.sh" local 2>/dev/null || true
fi

# Default Canton Quickstart location
CANTON_QUICKSTART_DIR="${CANTON_QUICKSTART_DIR:-$HOME/code/cn-quickstart/quickstart}"

# Use Java 17 for Gradle compatibility (JVM 25 has issues with Gradle 8.x)
if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME=$(/usr/libexec/java_home -v 17)
fi

# Default: wait for services
WAIT_FOR_SERVICES=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

#############################################################################
# Help
#############################################################################

show_help() {
  cat <<EOF
Usage: $0 [--wait] [--no-wait]

Refresh Ledger Script - Stops, cleans, and restarts the Canton quickstart ledger.

Options:
  --wait      Wait for services to be ready after starting (default)
  --no-wait   Don't wait for services, just start them
  -h, --help  Show this help message

This script will:
  1. Stop the Canton quickstart services (make stop)
  2. Clean all ledger data (make clean-all)
  3. Start fresh services (make start)
  4. Wait for Keycloak, Participant, and Wallet to be ready

Canton quickstart directory: $CANTON_QUICKSTART_DIR

EOF
  exit 0
}

#############################################################################
# Parse Arguments
#############################################################################

while [[ $# -gt 0 ]]; do
  case $1 in
    --wait)
      WAIT_FOR_SERVICES=true
      shift
      ;;
    --no-wait)
      WAIT_FOR_SERVICES=false
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
done

#############################################################################
# Utility Functions
#############################################################################

print_header() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Backr - Refresh Ledger${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_step() {
  local step="$1"
  local description="$2"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  STEP $step: $description${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_service() {
  local name="$1"
  local url="$2"
  local expected_codes="$3"

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [[ ",$expected_codes," == *",$http_code,"* ]]; then
    echo -e "  ${GREEN}✓${NC} $name: ready (HTTP $http_code)"
    return 0
  else
    echo -e "  ${YELLOW}○${NC} $name: not ready (HTTP $http_code)"
    return 1
  fi
}

wait_for_services() {
  local max_attempts=60
  local attempt=1
  local sleep_interval=5

  echo ""
  echo "Waiting for services to be ready (max ${max_attempts} attempts, ${sleep_interval}s interval)..."
  echo ""

  while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$max_attempts:"

    local keycloak_ready=false
    local participant_ready=false
    local wallet_ready=false

    # Check Keycloak
    if check_service "Keycloak" "http://keycloak.localhost:8082/realms/AppProvider" "200"; then
      keycloak_ready=true
    fi

    # Check Participant (401 = requires auth, means it's running)
    if check_service "Participant" "http://localhost:3975/v2/state/ledger-end" "401"; then
      participant_ready=true
    fi

    # Check Wallet
    if check_service "Wallet" "http://wallet.localhost:3000/api/validator/v0/wallet/balance" "200,401,404"; then
      wallet_ready=true
    fi

    if $keycloak_ready && $participant_ready && $wallet_ready; then
      echo ""
      echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
      echo -e "${GREEN}  All services are ready!${NC}"
      echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
      return 0
    fi

    echo ""
    sleep $sleep_interval
    ((attempt++))
  done

  echo ""
  echo -e "${RED}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  Timeout waiting for services${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════════════════${NC}"
  return 1
}

#############################################################################
# Main Steps
#############################################################################

step_1_stop() {
  print_step "1" "Stop Canton Services"

  echo "Running: make stop"
  echo ""

  cd "$CANTON_QUICKSTART_DIR"
  if make stop 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Services stopped${NC}"
  else
    echo ""
    echo -e "${YELLOW}⚠ Stop command completed (may have already been stopped)${NC}"
  fi
}

step_2_clean() {
  print_step "2" "Clean All Ledger Data"

  echo "Running: make clean-all"
  echo "This removes all ledger state and data..."
  echo ""

  cd "$CANTON_QUICKSTART_DIR"
  if make clean-all 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Ledger data cleaned${NC}"
  else
    echo ""
    echo -e "${RED}✗ Clean failed${NC}"
    return 1
  fi
}

step_3_start() {
  print_step "3" "Start Fresh Services"

  echo "Running: make start"
  echo "This starts all Canton services with fresh state..."
  echo ""

  cd "$CANTON_QUICKSTART_DIR"
  if make start 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Services started${NC}"
  else
    echo ""
    echo -e "${RED}✗ Start failed${NC}"
    return 1
  fi
}

step_4_wait() {
  print_step "4" "Wait for Services"

  if $WAIT_FOR_SERVICES; then
    wait_for_services
  else
    echo "Skipping wait (--no-wait specified)"
    echo ""
    echo -e "${YELLOW}Services are starting in the background.${NC}"
    echo "You can check their status manually:"
    echo "  curl -s http://keycloak.localhost:8082/realms/AppProvider"
    echo "  curl -s http://localhost:3975/v2/state/ledger-end"
    echo "  curl -s http://wallet.localhost:3000/api/validator/v0/wallet/balance"
  fi
}

#############################################################################
# Main
#############################################################################

main() {
  print_header

  echo "Canton Quickstart: $CANTON_QUICKSTART_DIR"
  echo "Wait for services: $WAIT_FOR_SERVICES"

  # Verify Canton quickstart directory exists
  if [ ! -d "$CANTON_QUICKSTART_DIR" ]; then
    echo ""
    echo -e "${RED}Error: Canton quickstart directory not found: $CANTON_QUICKSTART_DIR${NC}"
    echo ""
    echo "Please set CANTON_QUICKSTART_DIR environment variable or create scripts/config/load_env.sh"
    exit 1
  fi

  if [ ! -f "$CANTON_QUICKSTART_DIR/Makefile" ]; then
    echo ""
    echo -e "${RED}Error: Makefile not found in Canton quickstart directory${NC}"
    exit 1
  fi

  # Execute steps
  step_1_stop
  step_2_clean
  step_3_start
  step_4_wait

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Ledger Refresh Complete${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Upload DARs:  ./scripts/setup/upload_dars.sh"
  echo "  2. Run tests:    ./scripts/test/json-api-test.sh"
  echo ""
}

main "$@"
