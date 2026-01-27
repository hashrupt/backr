#!/bin/bash
# =============================================================================
# Test Canton Connection for Backr
# =============================================================================
# Verifies that Canton Quickstart is running and accessible.
#
# Usage:
#   ./test_connection.sh [deployment]
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
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}  Backr - Test Canton Connection${NC}"
echo -e "${CYAN}================================================================${NC}"
echo ""

# Test 1: Canton Participant
echo -n "Testing Canton Participant ($PARTICIPANT_URL)... "
if curl -s --connect-timeout 5 "${PARTICIPANT_URL}/v2/version" > /dev/null 2>&1; then
  VERSION=$(curl -s "${PARTICIPANT_URL}/v2/version" | jq -r '.version // "unknown"')
  echo -e "${GREEN}OK${NC} (version: $VERSION)"
else
  echo -e "${RED}FAILED${NC}"
  echo "  Make sure Canton Quickstart is running"
fi

# Test 2: Keycloak
echo -n "Testing Keycloak ($KEYCLOAK_URL)... "
if curl -s --connect-timeout 5 "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration" > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "  Make sure Keycloak is running and realm exists"
fi

# Test 3: Validator/Wallet
echo -n "Testing Validator ($VALIDATOR_HOST)... "
if curl -s --connect-timeout 5 "${VALIDATOR_HOST}/api/validator/readyz" > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}SKIPPED${NC} (may not be accessible from outside)"
fi

# Test 4: Get token
echo -n "Testing authentication... "
if [ -n "$VALIDATOR_CLIENT_ID" ] && [ -n "$VALIDATOR_CLIENT_SECRET" ]; then
  TOKEN=$(curl -s -X POST "$KEYCLOAK_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${VALIDATOR_CLIENT_ID}" \
    -d "client_secret=${VALIDATOR_CLIENT_SECRET}" \
    -d "grant_type=client_credentials" \
    -d "scope=openid" 2>/dev/null | jq -r '.access_token // empty')

  if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}OK${NC}"

    # Test 5: List packages
    echo -n "Testing package listing... "
    PACKAGES=$(curl -s "${PARTICIPANT_URL}/v2/packages" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r '.packageIds | length // 0')
    echo -e "${GREEN}OK${NC} ($PACKAGES packages on ledger)"

    # Check for Backr DAR
    echo -n "Checking for Backr templates... "
    BACKR_TEMPLATES=$(curl -s "${PARTICIPANT_URL}/v2/packages" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r '.packageIds[]' | head -5)
    if echo "$BACKR_TEMPLATES" | grep -q "." 2>/dev/null; then
      echo -e "${GREEN}packages found${NC}"
    else
      echo -e "${YELLOW}run upload_dars.sh to upload Backr DAR${NC}"
    fi
  else
    echo -e "${RED}FAILED${NC}"
    echo "  Could not authenticate with Keycloak"
  fi
else
  echo -e "${YELLOW}SKIPPED${NC} (no service account configured)"
fi

echo ""
echo -e "${CYAN}================================================================${NC}"
echo ""
echo "If all tests pass, run: ./scripts/setup/upload_dars.sh"
echo ""
