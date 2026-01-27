#!/usr/bin/env bash
# Backr Canton JSON API v2 Direct Tests
# Tests the Backr DAML contracts directly via Canton JSON API
#
# This is the lowest-level test that verifies DAML contracts work correctly
# before testing the REST API layer or UI layer.
#
# Usage:
#   ./json-api-test.sh [options]
#
# Options:
#   --participant <url>   Canton participant URL (default: http://localhost:3975)
#   --verbose             Enable verbose output
#   --help                Show this help message

set -eo pipefail

#############################################################################
# Environment Setup
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source utilities
source "${SCRIPT_DIR}/lib/test_utils.sh"
source "${SCRIPT_DIR}/lib/http_utils.sh"
source "${PROJECT_ROOT}/scripts/keycloak/utils.sh"

#############################################################################
# Configuration
#############################################################################

# Defaults - Canton Quickstart local
PARTICIPANT_URL="${PARTICIPANT_URL:-http://localhost:3975}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak.localhost:8082}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-AppProvider}"
VALIDATOR_CLIENT_ID="${VALIDATOR_CLIENT_ID:-app-provider-validator}"
VALIDATOR_CLIENT_SECRET="${VALIDATOR_CLIENT_SECRET:-AL8648b9SfdTFImq7FV56Vd0KHifHBuC}"
VERBOSE="false"

# Test state
OPERATOR_TOKEN=""
FA_TOKEN=""
OPERATOR_PARTY=""
FA_PARTY=""
OPERATOR_CONTRACT_ID=""
FEE_REQUEST_CONTRACT_ID=""
ALLOCATION_REQUEST_CONTRACT_ID=""
VALIDATED_APP_CONTRACT_ID=""

# Unique run ID
RUN_ID=$(date +%s)

#############################################################################
# Helper Functions
#############################################################################

show_usage() {
  cat <<EOF
Backr Canton JSON API v2 Direct Tests

Usage: $0 [options]

Options:
  --participant <url>     Canton participant URL (default: http://localhost:3975)
  --verbose               Enable verbose HTTP output
  --help                  Show this help message

Environment Variables:
  PARTICIPANT_URL         Canton participant URL
  KEYCLOAK_URL            Keycloak URL
  KEYCLOAK_REALM          Keycloak realm (default: AppProvider)
  VALIDATOR_CLIENT_SECRET Validator service account secret

Tests:
  1. Get ledger offset
  2. Query Operator contract
  3. Query ValidateApplicationOwnershipFeeRequest contracts
  4. Query BackrApplicationOwnershipAllocationRequest contracts
  5. Query BackrValidatedApplication contracts
  6. Query BackingCampaign contracts

Examples:
  # Run with defaults (Canton Quickstart local)
  $0

  # Run with verbose output
  $0 --verbose

EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --participant)
        PARTICIPANT_URL="$2"
        shift 2
        ;;
      --verbose)
        VERBOSE="true"
        export HTTP_VERBOSE="true"
        shift
        ;;
      --help|-h)
        show_usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        show_usage
        exit 1
        ;;
    esac
  done
}

# Get service account token for operator operations
get_operator_token() {
  local token_url="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"

  OPERATOR_TOKEN=$(get_service_token \
    "$VALIDATOR_CLIENT_ID" \
    "$VALIDATOR_CLIENT_SECRET" \
    "$token_url" 2>/dev/null)

  if [ -z "$OPERATOR_TOKEN" ] || [ "$OPERATOR_TOKEN" = "null" ]; then
    return 1
  fi
  return 0
}

# Decode JWT to get party ID
decode_jwt_party() {
  local token="$1"
  local payload
  payload=$(echo "$token" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null || echo "")

  if [ -z "$payload" ]; then
    return 1
  fi

  # Try to get party from different claims
  local party
  party=$(echo "$payload" | jq -r '.sub // empty' 2>/dev/null)

  if [ -z "$party" ]; then
    return 1
  fi

  echo "$party"
}

# Get user's primary party from Canton
get_user_party() {
  local token="$1"
  local user_id
  user_id=$(decode_jwt_party "$token")

  if [ -z "$user_id" ]; then
    return 1
  fi

  # If already looks like a party ID (contains ::), use directly
  if [[ "$user_id" == *"::"* ]]; then
    echo "$user_id"
    return 0
  fi

  # Query Canton user management
  local response
  response=$(curl -s -X GET "${PARTICIPANT_URL}/v2/users/${user_id}" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" 2>/dev/null)

  local party
  party=$(echo "$response" | jq -r '.user.primaryParty // empty' 2>/dev/null)

  if [ -n "$party" ]; then
    echo "$party"
    return 0
  fi

  return 1
}

# Get ledger end offset
get_ledger_offset() {
  local token="$1"
  local response
  response=$(curl -s -X GET "${PARTICIPANT_URL}/v2/state/ledger-end" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" 2>/dev/null)

  echo "$response" | jq -r '.offset // "0"' 2>/dev/null
}

# Query active contracts by template
query_contracts() {
  local token="$1"
  local party="$2"
  local template_id="$3"
  local offset
  offset=$(get_ledger_offset "$token")

  # Canton v2 format with filtersByParty
  local body
  body=$(cat <<EOF
{
  "verbose": true,
  "activeAtOffset": "$offset",
  "filter": {
    "filtersByParty": {
      "$party": {
        "cumulative": [{
          "identifierFilter": {
            "TemplateFilter": {
              "value": {
                "templateId": "#backr:${template_id}",
                "includeCreatedEventBlob": false
              }
            }
          }
        }]
      }
    }
  }
}
EOF
)

  local response
  response=$(curl -s -X POST "${PARTICIPANT_URL}/v2/state/active-contracts" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null)

  echo "$response"
}

# Count contracts from query response
count_contracts() {
  local response="$1"

  # Handle array response (Canton v2)
  if echo "$response" | jq -e 'type == "array"' > /dev/null 2>&1; then
    echo "$response" | jq '[.[] | select(.contractEntry.JsActiveContract)] | length' 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Extract contract IDs from query response
extract_contract_ids() {
  local response="$1"

  if echo "$response" | jq -e 'type == "array"' > /dev/null 2>&1; then
    echo "$response" | jq -r '.[].contractEntry.JsActiveContract.createdEvent.contractId // empty' 2>/dev/null
  fi
}

# Check participant health
check_participant_health() {
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" "${PARTICIPANT_URL}/v2/state/ledger-end" \
    -H "Authorization: Bearer $OPERATOR_TOKEN" \
    -H "Content-Type: application/json" 2>/dev/null)

  [ "$response" = "200" ]
}

#############################################################################
# Test Cases
#############################################################################

test_get_tokens() {
  test_begin "Get Authentication Tokens"

  if get_operator_token; then
    test_pass "Got operator service account token"

    OPERATOR_PARTY=$(get_user_party "$OPERATOR_TOKEN")
    if [ -n "$OPERATOR_PARTY" ]; then
      test_info "Operator party: ${OPERATOR_PARTY:0:40}..."
    else
      test_warn "Could not determine operator party ID"
    fi
  else
    test_fail "Failed to get operator token"
    test_info "Check VALIDATOR_CLIENT_SECRET is correct"
    return 1
  fi
}

test_ledger_offset() {
  test_begin "Get Ledger Offset"

  local offset
  offset=$(get_ledger_offset "$OPERATOR_TOKEN")

  if [ -n "$offset" ] && [ "$offset" != "null" ]; then
    test_pass "Got ledger offset"
    test_info "Current offset: $offset"
  else
    test_fail "Could not get ledger offset"
  fi
}

test_query_operator() {
  test_begin "Query Operator Contract"

  if [ -z "$OPERATOR_PARTY" ]; then
    test_skip "No operator party - skipping"
    return
  fi

  local response
  response=$(query_contracts "$OPERATOR_TOKEN" "$OPERATOR_PARTY" "Backr.Operator:Operator")

  local count
  count=$(count_contracts "$response")

  if [ "$count" != "0" ]; then
    test_pass "Found Operator contract(s)"
    test_info "Operator contracts: $count"

    OPERATOR_CONTRACT_ID=$(extract_contract_ids "$response" | head -1)
    if [ -n "$OPERATOR_CONTRACT_ID" ]; then
      test_info "Contract ID: ${OPERATOR_CONTRACT_ID:0:40}..."
    fi
  else
    test_info "No Operator contract found"
    test_info "This is expected if setup hasn't been run yet"
  fi
}

test_query_fee_requests() {
  test_begin "Query Fee Request Contracts"

  if [ -z "$OPERATOR_PARTY" ]; then
    test_skip "No operator party - skipping"
    return
  fi

  local response
  response=$(query_contracts "$OPERATOR_TOKEN" "$OPERATOR_PARTY" "Backr.FeeRequest:ValidateApplicationOwnershipFeeRequest")

  local count
  count=$(count_contracts "$response")

  test_pass "Queried fee requests"
  test_info "Fee request contracts: $count"

  if [ "$count" != "0" ]; then
    FEE_REQUEST_CONTRACT_ID=$(extract_contract_ids "$response" | head -1)
    test_info "First contract ID: ${FEE_REQUEST_CONTRACT_ID:0:40}..."
  fi
}

test_query_allocation_requests() {
  test_begin "Query Allocation Request Contracts"

  if [ -z "$OPERATOR_PARTY" ]; then
    test_skip "No operator party - skipping"
    return
  fi

  local response
  response=$(query_contracts "$OPERATOR_TOKEN" "$OPERATOR_PARTY" "Backr.AllocationRequest:BackrApplicationOwnershipAllocationRequest")

  local count
  count=$(count_contracts "$response")

  test_pass "Queried allocation requests"
  test_info "Allocation request contracts: $count"

  if [ "$count" != "0" ]; then
    ALLOCATION_REQUEST_CONTRACT_ID=$(extract_contract_ids "$response" | head -1)
    test_info "First contract ID: ${ALLOCATION_REQUEST_CONTRACT_ID:0:40}..."
  fi
}

test_query_validated_apps() {
  test_begin "Query Validated Application Contracts"

  if [ -z "$OPERATOR_PARTY" ]; then
    test_skip "No operator party - skipping"
    return
  fi

  local response
  response=$(query_contracts "$OPERATOR_TOKEN" "$OPERATOR_PARTY" "Backr.ValidatedApp:BackrValidatedApplication")

  local count
  count=$(count_contracts "$response")

  test_pass "Queried validated applications"
  test_info "Validated app contracts: $count"

  if [ "$count" != "0" ]; then
    VALIDATED_APP_CONTRACT_ID=$(extract_contract_ids "$response" | head -1)
    test_info "First contract ID: ${VALIDATED_APP_CONTRACT_ID:0:40}..."
  fi
}

test_query_campaigns() {
  test_begin "Query Campaign Contracts"

  if [ -z "$OPERATOR_PARTY" ]; then
    test_skip "No operator party - skipping"
    return
  fi

  local response
  response=$(query_contracts "$OPERATOR_TOKEN" "$OPERATOR_PARTY" "Backr.Campaign:BackingCampaign")

  local count
  count=$(count_contracts "$response")

  test_pass "Queried campaigns"
  test_info "Campaign contracts: $count"

  if [ "$count" != "0" ]; then
    local campaign_id
    campaign_id=$(extract_contract_ids "$response" | head -1)
    test_info "First contract ID: ${campaign_id:0:40}..."
  fi
}

#############################################################################
# Summary Report
#############################################################################

print_contract_summary() {
  echo ""
  echo "========================================"
  echo "Contract Summary"
  echo "========================================"
  echo ""
  echo "Operator:            ${OPERATOR_CONTRACT_ID:-(none)}"
  echo "Fee Requests:        ${FEE_REQUEST_CONTRACT_ID:-(none)}"
  echo "Allocation Requests: ${ALLOCATION_REQUEST_CONTRACT_ID:-(none)}"
  echo "Validated Apps:      ${VALIDATED_APP_CONTRACT_ID:-(none)}"
  echo ""
}

#############################################################################
# Main Execution
#############################################################################

run_tests() {
  # Authentication
  test_get_tokens || return 1

  # Ledger queries
  test_ledger_offset

  # Contract queries
  test_query_operator
  test_query_fee_requests
  test_query_allocation_requests
  test_query_validated_apps
  test_query_campaigns

  # Summary
  print_contract_summary
}

main() {
  parse_args "$@"

  # Check dependencies
  if ! command -v curl &> /dev/null; then
    echo "Error: curl is required but not installed"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    exit 1
  fi

  # Initialize test suite
  test_init "Backr Canton JSON API v2 Direct Tests"

  test_info "Participant URL: $PARTICIPANT_URL"
  test_info "Keycloak URL: $KEYCLOAK_URL"
  test_info "Realm: $KEYCLOAK_REALM"
  test_info "Run ID: $RUN_ID"
  echo ""

  # Check participant availability
  test_info "Checking Canton participant..."
  if ! get_operator_token; then
    test_error "Cannot authenticate with Keycloak"
    echo ""
    echo "Please ensure:"
    echo "  1. Canton Quickstart is running: cd ~/code/cn-quickstart/quickstart && make start"
    echo "  2. Keycloak is accessible: curl $KEYCLOAK_URL/realms/$KEYCLOAK_REALM"
    echo ""
    exit 1
  fi

  if ! check_participant_health; then
    test_error "Canton participant is not responding"
    echo ""
    echo "Please ensure Canton Quickstart is running:"
    echo "  cd ~/code/cn-quickstart/quickstart && make start"
    echo ""
    exit 1
  fi

  test_info "Canton participant is healthy"
  echo ""

  run_tests

  # Print summary and exit
  test_summary
  exit $?
}

# Run main
main "$@"
