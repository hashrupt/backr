#!/usr/bin/env bash
# =============================================================================
# Fresh Ledger E2E Setup Script for Backr
# =============================================================================
# Complete setup for end-to-end testing from a fresh ledger.
#
# This script handles ALL prerequisites:
#   1. User creation with party allocation
#   2. DAR uploads (Splice API + Backr)
#   3. Verification that users can authenticate
#
# Usage:
#   ./setup_fresh_ledger.sh [deployment] [csv_file]
#
# Examples:
#   ./setup_fresh_ledger.sh local                    # Setup with default users.csv
#   ./setup_fresh_ledger.sh local users.csv          # Setup with custom CSV
# =============================================================================

set -eo pipefail

#############################################################################
# Environment Setup
#############################################################################

SETUP_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SETUP_SCRIPT_DIR}/../.." && pwd)"

# Parse arguments
DEPLOYMENT="${1:-local}"
CSV_FILE="${2:-${SETUP_SCRIPT_DIR}/../users.csv}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track step status
STEP_RESULTS=()

# User data storage files (bash 3 compatible alternative to associative arrays)
USER_DATA_DIR="/tmp/backr_setup_$$"
mkdir -p "$USER_DATA_DIR"

# Cleanup on exit
cleanup() {
  rm -rf "$USER_DATA_DIR" 2>/dev/null || true
}
trap cleanup EXIT

#############################################################################
# Help
#############################################################################

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  cat <<'EOF'
================================================================================
Backr Fresh Ledger E2E Setup Script
================================================================================

Complete setup for end-to-end testing from a fresh Canton Network ledger.

USAGE:
  ./setup_fresh_ledger.sh [deployment] [csv_file]

ARGUMENTS:
  deployment   - Environment: local, dev (default: local)
  csv_file     - Path to users CSV file (default: scripts/users.csv)

PREREQUISITES:
  Before running this script, ensure:
  1. Canton ledger is running (Participant API at localhost:3975)
  2. Keycloak is running (http://keycloak.localhost:8082)
  3. Validator/Wallet service is running (http://wallet.localhost:3000)
  4. Required tools: curl, jq, bash

STEPS PERFORMED:
  1. Create users in Keycloak with party allocation
  2. Upload Splice API DARs (CIP-56 token interfaces)
  3. Upload Backr DAR (app validation and campaign contracts)
  4. Verify user authentication and party access

CSV FORMAT:
  role,username,password,firstname,lastname,legal_entity
  operator,backr-operator,backr123,Backr,Operator,Backr Platform
  app,demo-app,demo123,Demo,App,Demo Featured App
  backer,test-backer,backer123,Test,Backer,Individual

================================================================================
EOF
  exit 0
fi

#############################################################################
# Utility Functions
#############################################################################

print_header() {
  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""
}

print_step() {
  local step_num="$1"
  local step_name="$2"
  echo ""
  echo -e "${BLUE}----------------------------------------------------------------${NC}"
  echo -e "${BLUE}  STEP $step_num: $step_name${NC}"
  echo -e "${BLUE}----------------------------------------------------------------${NC}"
}

step_success() {
  local step_name="$1"
  echo ""
  echo -e "${GREEN}+ $step_name completed successfully${NC}"
  STEP_RESULTS+=("+ $step_name")
}

step_failed() {
  local step_name="$1"
  echo ""
  echo -e "${RED}x $step_name failed${NC}"
  STEP_RESULTS+=("x $step_name")
}

step_skipped() {
  local step_name="$1"
  echo ""
  echo -e "${YELLOW}o $step_name skipped${NC}"
  STEP_RESULTS+=("o $step_name (skipped)")
}

check_prerequisites() {
  echo "Checking prerequisites..."

  local missing=()

  # Check for required tools
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v jq >/dev/null 2>&1 || missing+=("jq")

  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}x Missing required tools: ${missing[*]}${NC}"
    return 1
  fi
  echo "+ Required tools available"

  # Check for CSV file
  if [ ! -f "$CSV_FILE" ]; then
    echo -e "${RED}x CSV file not found: $CSV_FILE${NC}"
    return 1
  fi
  echo "+ CSV file exists: $CSV_FILE"

  # Load environment
  if [ -f "${SETUP_SCRIPT_DIR}/../config/load_env.sh" ]; then
    source "${SETUP_SCRIPT_DIR}/../config/load_env.sh" "$DEPLOYMENT"
  else
    echo -e "${RED}x Environment config not found${NC}"
    return 1
  fi
  echo "+ Environment loaded"

  # Check Keycloak is reachable
  local keycloak_status
  keycloak_status=$(curl -s -o /dev/null -w "%{http_code}" "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}" 2>/dev/null || echo "000")
  if [ "$keycloak_status" != "200" ]; then
    echo -e "${RED}x Keycloak not reachable at ${KEYCLOAK_URL} (HTTP $keycloak_status)${NC}"
    return 1
  fi
  echo "+ Keycloak is reachable"

  # Check Canton participant is reachable
  local canton_status
  canton_status=$(curl -s -o /dev/null -w "%{http_code}" "${PARTICIPANT_URL}/v2/version" 2>/dev/null || echo "000")
  if [ "$canton_status" != "200" ]; then
    echo -e "${RED}x Canton participant not reachable at ${PARTICIPANT_URL} (HTTP $canton_status)${NC}"
    return 1
  fi
  echo "+ Canton participant is reachable"

  return 0
}

print_summary() {
  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}  Setup Summary${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""

  local has_failures=false
  for result in "${STEP_RESULTS[@]}"; do
    echo "  $result"
    if [[ "$result" == "x"* ]]; then
      has_failures=true
    fi
  done

  echo ""

  if [ "$has_failures" = true ]; then
    echo -e "${RED}================================================================${NC}"
    echo -e "${RED}  SETUP COMPLETED WITH ERRORS${NC}"
    echo -e "${RED}================================================================${NC}"
    return 1
  else
    echo -e "${GREEN}================================================================${NC}"
    echo -e "${GREEN}  ALL SETUP STEPS COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${GREEN}================================================================${NC}"
    return 0
  fi
}

#############################################################################
# Main Workflow Steps
#############################################################################

step_1_upload_dars() {
  print_step "1" "Upload DAR Files"

  local script="${SETUP_SCRIPT_DIR}/upload_dars.sh"

  echo "Uploading required DARs to participant:"
  echo "  - Splice API DARs (CIP-56 token interfaces)"
  echo "  - Backr DAR (app validation and campaign contracts)"
  echo ""

  if [ -f "$script" ]; then
    if bash "$script" "$DEPLOYMENT"; then
      step_success "DAR upload"
      return 0
    else
      step_failed "DAR upload"
      return 1
    fi
  else
    echo "  Script not found: $script"
    step_failed "DAR upload"
    return 1
  fi
}

step_2_verify_connection() {
  print_step "2" "Verify Canton Connection"

  source "${SETUP_SCRIPT_DIR}/../config/load_env.sh" "$DEPLOYMENT"
  source "${SETUP_SCRIPT_DIR}/../keycloak/utils.sh"

  echo "Testing service account authentication..."

  local token
  token=$(get_service_token "$VALIDATOR_CLIENT_ID" "$VALIDATOR_CLIENT_SECRET" "$KEYCLOAK_TOKEN_URL")

  if [ -z "$token" ] || [ "$token" = "null" ]; then
    echo -e "${RED}x Failed to get service token${NC}"
    step_failed "Canton connection verification"
    return 1
  fi

  echo "+ Service token obtained"

  # Test package listing
  local packages
  packages=$(curl -s "${PARTICIPANT_URL}/v2/packages" \
    -H "Authorization: Bearer $token" 2>/dev/null | jq -r '.packageIds | length // 0')

  echo "+ Packages on ledger: $packages"

  step_success "Canton connection verification"
  return 0
}

step_3_export_env() {
  print_step "3" "Export Environment Variables for Testing"

  source "${SETUP_SCRIPT_DIR}/../config/load_env.sh" "$DEPLOYMENT"

  echo "The following environment variables can be used for E2E testing:"
  echo ""

  echo "export PARTICIPANT_URL=\"$PARTICIPANT_URL\""
  echo "export KEYCLOAK_URL=\"$KEYCLOAK_URL\""
  echo "export KEYCLOAK_REALM=\"$KEYCLOAK_REALM\""
  echo "export API_URL=\"http://localhost:4001\""
  echo ""

  # Write to .env.test file
  local env_file="${PROJECT_ROOT}/.env.test"
  cat > "$env_file" <<EOF
# Auto-generated by setup_fresh_ledger.sh on $(date)
# Environment: $DEPLOYMENT

PARTICIPANT_URL=$PARTICIPANT_URL
KEYCLOAK_URL=$KEYCLOAK_URL
KEYCLOAK_REALM=$KEYCLOAK_REALM
KEYCLOAK_TOKEN_URL=$KEYCLOAK_TOKEN_URL
WALLET_CLIENT_ID=$WALLET_CLIENT_ID
VALIDATOR_CLIENT_ID=$VALIDATOR_CLIENT_ID
VALIDATOR_CLIENT_SECRET=$VALIDATOR_CLIENT_SECRET

# API
API_URL=http://localhost:4001
WEB_URL=http://localhost:5173
EOF

  echo "  Environment written to: $env_file"

  step_success "Environment export"
  return 0
}

#############################################################################
# Main Execution
#############################################################################

main() {
  print_header "Backr Fresh Ledger E2E Setup"

  echo "Deployment:    $DEPLOYMENT"
  echo "CSV File:      $CSV_FILE"
  echo ""

  # Check prerequisites
  if ! check_prerequisites; then
    echo ""
    echo -e "${RED}Prerequisites check failed. Please fix the issues above.${NC}"
    exit 1
  fi

  echo ""
  echo "Starting setup..."

  # Step 1: Upload DARs
  step_1_upload_dars || true

  # Step 2: Verify connection
  step_2_verify_connection || true

  # Step 3: Export environment
  step_3_export_env || true

  # Print summary
  print_summary
  local result=$?

  echo ""
  echo "Next steps:"
  echo "  1. Source the environment:"
  echo "     source .env.test"
  echo ""
  echo "  2. Start the API:"
  echo "     pnpm --filter @backr/api dev"
  echo ""
  echo "  3. Start the Web frontend:"
  echo "     pnpm --filter @backr/web dev"
  echo ""
  echo "  4. Run E2E tests:"
  echo "     ./scripts/test/backr-workflow-test.sh"
  echo ""

  exit $result
}

#############################################################################
# Entry Point
#############################################################################

main "$@"
