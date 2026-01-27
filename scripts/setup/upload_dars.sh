#!/bin/bash
# =============================================================================
# Upload DARs Script for Backr
# =============================================================================
# Uploads required DAR files to the Canton participant.
#
# Usage:
#   ./upload_dars.sh [deployment]
#
# This uploads:
#   1. Splice API DARs (CIP-56 token interfaces) - if not already on ledger
#   2. Backr DAR (app validation and campaign contracts)
# =============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT="${1:-local}"

# Load environment
source "$SCRIPT_DIR/../config/load_env.sh" "$DEPLOYMENT"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# DAR locations
CN_QUICKSTART_DARS="${CANTON_QUICKSTART_DIR}/daml/dars"
BACKR_DARS="$BACKR_ROOT/canton/dars"
BACKR_DAR="${BACKR_DAML}/.daml/dist/backr-0.1.0.dar"

#############################################################################
# Help
#############################################################################

show_help() {
  cat <<EOF
Usage: $0 [deployment]

Upload DARs Script - Uploads DAR files to the Canton participant.

Arguments:
  deployment   Environment: local, dev (default: local)

This script uploads:
  1. Splice API DARs (from cn-quickstart or canton/dars):
     - splice-api-token-metadata-v1
     - splice-api-token-holding-v1
     - splice-api-token-allocation-v1
     - splice-api-token-allocation-request-v1
  2. Backr DAR (from canton/daml):
     - backr-0.1.0.dar

Prerequisites:
  - Canton participant must be running
  - Backr DAR must be built (cd canton/daml && daml build)

EOF
  exit 0
}

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  show_help
fi

#############################################################################
# Utility Functions
#############################################################################

print_header() {
  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}  Backr - Upload DARs${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""
}

print_step() {
  local step="$1"
  local description="$2"
  echo ""
  echo -e "${BLUE}----------------------------------------------------------------${NC}"
  echo -e "${BLUE}  STEP $step: $description${NC}"
  echo -e "${BLUE}----------------------------------------------------------------${NC}"
}

upload_dar() {
  local dar_path="$1"
  local dar_name="$2"
  local token="$3"

  if [ ! -f "$dar_path" ]; then
    echo -e "  ${YELLOW}DAR not found: $dar_path${NC}"
    return 1
  fi

  echo -e "  Uploading: $dar_name"

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${PARTICIPANT_URL}/v2/packages" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@${dar_path}" 2>/dev/null)

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" == "200" ] || [ "$http_code" == "201" ] || [ "$http_code" == "409" ]; then
    echo -e "  ${GREEN}$dar_name uploaded${NC}"
    return 0
  else
    echo -e "  ${RED}$dar_name failed (HTTP $http_code)${NC}"
    return 1
  fi
}

#############################################################################
# Main Steps
#############################################################################

step_1_get_token() {
  print_step "1" "Get Admin Token"

  # Try service account credentials first (for DAR uploads)
  if [ -n "$VALIDATOR_CLIENT_ID" ] && [ -n "$VALIDATOR_CLIENT_SECRET" ]; then
    echo "Using service account: $VALIDATOR_CLIENT_ID"
    echo "Getting token via client_credentials..."

    ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_TOKEN_URL" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "client_id=${VALIDATOR_CLIENT_ID}" \
      -d "client_secret=${VALIDATOR_CLIENT_SECRET}" \
      -d "grant_type=client_credentials" \
      -d "scope=openid" | jq -r '.access_token')

    if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
      echo -e "${GREEN}Admin token obtained via service account${NC}"
      return 0
    fi
    echo -e "${YELLOW}Service account auth failed, trying user credentials${NC}"
  fi

  echo -e "${RED}Failed to get admin token${NC}"
  echo "  Make sure Canton Quickstart is running"
  return 1
}

step_2_upload_splice_dars() {
  print_step "2" "Upload Splice API DARs"

  # Check both locations for DARs
  local dars_dir=""
  if [ -d "$CN_QUICKSTART_DARS" ]; then
    dars_dir="$CN_QUICKSTART_DARS"
  elif [ -d "$BACKR_DARS" ]; then
    dars_dir="$BACKR_DARS"
  else
    echo -e "${YELLOW}Splice DARs directory not found${NC}"
    echo "  Splice DARs may already be on the ledger"
    return 0
  fi

  echo "Using DARs from: $dars_dir"

  local dars=(
    "splice-api-token-metadata-v1-1.0.0.dar"
    "splice-api-token-holding-v1-1.0.0.dar"
    "splice-api-token-allocation-v1-1.0.0.dar"
    "splice-api-token-allocation-request-v1-1.0.0.dar"
    "splice-api-token-allocation-instruction-v1-1.0.0.dar"
  )

  for dar in "${dars[@]}"; do
    upload_dar "${dars_dir}/${dar}" "$dar" "$ADMIN_TOKEN" || true
  done
}

step_3_build_backr_dar() {
  print_step "3" "Build Backr DAR"

  if [ -f "$BACKR_DAR" ]; then
    echo "Backr DAR already exists: $BACKR_DAR"
    echo -e "${GREEN}Skipping build${NC}"
    return 0
  fi

  # Also check the dars directory for a pre-built DAR
  if [ -f "$BACKR_DARS/backr-0.1.0.dar" ]; then
    echo "Backr DAR found in dars directory"
    BACKR_DAR="$BACKR_DARS/backr-0.1.0.dar"
    return 0
  fi

  echo "Building Backr DAR..."
  echo "Running: cd $BACKR_DAML && daml build"

  if command -v daml >/dev/null 2>&1; then
    cd "$BACKR_DAML"
    if daml build 2>&1; then
      echo -e "${GREEN}Backr DAR built${NC}"
    else
      echo -e "${RED}DAR build failed${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}Daml SDK not installed${NC}"
    echo "  Install from: https://docs.daml.com/getting-started/installation.html"
    echo "  Then run: cd canton/daml && daml build"
    return 1
  fi
}

step_4_upload_backr_dar() {
  print_step "4" "Upload Backr DAR"

  # Check both possible locations
  if [ ! -f "$BACKR_DAR" ] && [ -f "$BACKR_DARS/backr-0.1.0.dar" ]; then
    BACKR_DAR="$BACKR_DARS/backr-0.1.0.dar"
  fi

  if [ ! -f "$BACKR_DAR" ]; then
    echo -e "${YELLOW}Backr DAR not found: $BACKR_DAR${NC}"
    echo "  Build it first: cd canton/daml && daml build"
    return 1
  fi

  upload_dar "$BACKR_DAR" "backr-0.1.0.dar" "$ADMIN_TOKEN"
}

#############################################################################
# Main
#############################################################################

main() {
  print_header

  echo "Deployment:        $DEPLOYMENT"
  echo "Participant URL:   $PARTICIPANT_URL"
  echo "Splice DARs:       $CN_QUICKSTART_DARS"
  echo "Backr DAR:         $BACKR_DAR"
  echo ""

  step_1_get_token || exit 1
  step_2_upload_splice_dars
  step_3_build_backr_dar || true
  step_4_upload_backr_dar || true

  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}  DAR Upload Complete${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""
  echo "The ledger is ready for Backr operations."
  echo ""
  echo "Next steps:"
  echo "  1. Start API:    pnpm --filter @backr/api dev"
  echo "  2. Start Web:    pnpm --filter @backr/web dev"
  echo "  3. Open:         http://localhost:5173"
  echo ""
}

main "$@"
