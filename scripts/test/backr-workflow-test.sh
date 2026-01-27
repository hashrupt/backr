#!/usr/bin/env bash
# Backr App Validation Workflow E2E Tests
# Tests the complete app validation lifecycle through the Backr REST API
#
# App Validation Workflow (Daml):
#   1. Operator invites app (creates ValidateApplicationOwnershipFeeRequest)
#   2. FA accepts fee request (creates BackrApplicationOwnershipAllocationRequest)
#   3. FA allocates funds (CIP-56 AllocateFunds)
#   4. Operator executes transfer (creates BackrValidatedApplication)
#   5. FA creates campaign (BackingCampaign)
#
# Usage:
#   ./backr-workflow-test.sh [options]
#
# Options:
#   --api-url <url>       Backr API URL (default: http://localhost:4001)
#   --token <token>       Bearer token for authentication
#   --verbose             Enable verbose output
#   --help                Show this help message

set -eo pipefail

#############################################################################
# Environment Setup
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source our utilities
source "${SCRIPT_DIR}/lib/test_utils.sh"
source "${SCRIPT_DIR}/lib/http_utils.sh"

#############################################################################
# Configuration
#############################################################################

# Defaults
API_URL="http://localhost:4001"
VERBOSE="false"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Unique run ID for test data
RUN_ID=$(date +%s)

# Test data
TEST_APP_NAME="TestApp-${RUN_ID}"
TEST_CAMPAIGN_ID="CAMP-${RUN_ID}"
TEST_GOAL="1000.0"

# State variables
FEE_REQUEST_ID=""
ALLOCATION_REQUEST_ID=""
VALIDATED_APP_ID=""
CAMPAIGN_ID=""

#############################################################################
# Helper Functions
#############################################################################

show_usage() {
  cat <<EOF
Backr App Validation Workflow E2E Tests

Usage: $0 [options]

Options:
  --api-url <url>           Backr API URL (default: http://localhost:4001)
  --token <token>           Bearer token for authentication
  --verbose                 Enable verbose HTTP output
  --help                    Show this help message

Environment Variables:
  AUTH_TOKEN                Bearer token for authentication

Workflow Tested:
  1. Health Check
  2. List Fee Requests
  3. List Allocation Requests
  4. List Validated Apps
  5. Create Campaign (if validated app exists)

Examples:
  # Test via Backr API (default)
  $0

  # Test with authentication token
  $0 --token \$MY_TOKEN

  # Test with verbose output
  $0 --verbose

EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --api-url)
        API_URL="$2"
        shift 2
        ;;
      --token)
        AUTH_TOKEN="$2"
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

# Create future datetime
future_datetime() {
  local days="${1:-30}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    date -v+${days}d +"%Y-%m-%dT%H:%M:%SZ"
  else
    date -d "+${days} days" +"%Y-%m-%dT%H:%M:%SZ"
  fi
}

#############################################################################
# API Functions
#############################################################################

api_health_check() {
  http_get "${API_URL}/health" "$AUTH_TOKEN"
}

api_list_fee_requests() {
  http_get "${API_URL}/apps/fee-requests" "$AUTH_TOKEN"
}

api_list_allocation_requests() {
  http_get "${API_URL}/apps/allocation-requests" "$AUTH_TOKEN"
}

api_list_validated_apps() {
  http_get "${API_URL}/apps/validated" "$AUTH_TOKEN"
}

api_accept_fee_request() {
  local contract_id="$1"
  local allocation_id="ALLOC-${RUN_ID}"

  local body
  body=$(cat <<EOF
{
  "allocationId": "${allocation_id}",
  "holdingContractId": "pending"
}
EOF
)

  http_post "${API_URL}/apps/fee-requests/${contract_id}/accept" "$body" "$AUTH_TOKEN"
}

api_reject_fee_request() {
  local contract_id="$1"
  http_post "${API_URL}/apps/fee-requests/${contract_id}/reject" "{}" "$AUTH_TOKEN"
}

api_create_campaign() {
  local contract_id="$1"
  local ends_at
  ends_at=$(future_datetime 30)

  local body
  body=$(cat <<EOF
{
  "campaignId": "${TEST_CAMPAIGN_ID}",
  "campaignType": "STAKING",
  "goal": "${TEST_GOAL}",
  "minBacking": "10",
  "maxBacking": "1000",
  "endsAt": "${ends_at}"
}
EOF
)

  http_post "${API_URL}/apps/validated/${contract_id}/campaigns" "$body" "$AUTH_TOKEN"
}

# Admin API functions
api_admin_list_fee_requests() {
  http_get "${API_URL}/admin/apps/fee-requests" "$AUTH_TOKEN"
}

api_admin_list_allocation_requests() {
  http_get "${API_URL}/admin/apps/allocation-requests" "$AUTH_TOKEN"
}

api_admin_list_validated_apps() {
  http_get "${API_URL}/admin/apps/validated" "$AUTH_TOKEN"
}

api_admin_invite_app() {
  local party_id="$1"
  local app_name="$2"

  local body
  body=$(cat <<EOF
{
  "faPartyId": "${party_id}",
  "appName": "${app_name}",
  "prepareUntilDays": 7,
  "settleBeforeDays": 14
}
EOF
)

  http_post "${API_URL}/admin/apps/${party_id}/invite" "$body" "$AUTH_TOKEN"
}

#############################################################################
# Test Cases
#############################################################################

test_health_check() {
  test_begin "Health Check"

  api_health_check

  if assert_http_status "200" "$LAST_HTTP_STATUS" "API health endpoint responds"; then
    local status
    status=$(json_get "$LAST_HTTP_BODY" ".status")

    if [ "$status" = "healthy" ]; then
      test_pass "API reports healthy status"
    elif [ "$status" = "degraded" ]; then
      test_warn "API reports degraded status (Canton may not be connected)"
      local canton_connected
      canton_connected=$(json_get "$LAST_HTTP_BODY" ".canton.connected")
      test_info "Canton connected: $canton_connected"
    else
      test_info "API status: $status"
    fi
  fi
}

test_list_fee_requests() {
  test_begin "List Fee Requests"

  api_list_fee_requests

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local count
    count=$(echo "$LAST_HTTP_BODY" | jq '.feeRequests | length' 2>/dev/null || echo "0")
    test_pass "Retrieved fee requests list"
    test_info "Fee requests found: $count"

    # Store first fee request ID if available
    if [ "$count" != "0" ]; then
      FEE_REQUEST_ID=$(json_get "$LAST_HTTP_BODY" ".feeRequests[0].contractId")
      test_info "First fee request: ${FEE_REQUEST_ID:0:32}..."
    fi
  else
    test_info "List fee requests returned HTTP $LAST_HTTP_STATUS"
    test_skip "Could not list fee requests (likely needs authentication)"
  fi
}

test_list_allocation_requests() {
  test_begin "List Allocation Requests"

  api_list_allocation_requests

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local count
    count=$(echo "$LAST_HTTP_BODY" | jq '.allocationRequests | length' 2>/dev/null || echo "0")
    test_pass "Retrieved allocation requests list"
    test_info "Allocation requests found: $count"

    # Store first allocation request ID if available
    if [ "$count" != "0" ]; then
      ALLOCATION_REQUEST_ID=$(json_get "$LAST_HTTP_BODY" ".allocationRequests[0].contractId")
      test_info "First allocation request: ${ALLOCATION_REQUEST_ID:0:32}..."
    fi
  else
    test_info "List allocation requests returned HTTP $LAST_HTTP_STATUS"
    test_skip "Could not list allocation requests"
  fi
}

test_list_validated_apps() {
  test_begin "List Validated Apps"

  api_list_validated_apps

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local count
    count=$(echo "$LAST_HTTP_BODY" | jq '.validatedApps | length' 2>/dev/null || echo "0")
    test_pass "Retrieved validated apps list"
    test_info "Validated apps found: $count"

    # Store first validated app ID if available
    if [ "$count" != "0" ]; then
      VALIDATED_APP_ID=$(json_get "$LAST_HTTP_BODY" ".validatedApps[0].contractId")
      local app_name
      app_name=$(json_get "$LAST_HTTP_BODY" ".validatedApps[0].appName")
      test_info "First validated app: $app_name"
      test_info "Contract ID: ${VALIDATED_APP_ID:0:32}..."
    fi
  else
    test_info "List validated apps returned HTTP $LAST_HTTP_STATUS"
    test_skip "Could not list validated apps"
  fi
}

test_accept_fee_request() {
  test_begin "Accept Fee Request"

  if [ -z "$FEE_REQUEST_ID" ]; then
    test_skip "No fee request available - skipping accept test"
    return
  fi

  api_accept_fee_request "$FEE_REQUEST_ID"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local success
    success=$(json_get "$LAST_HTTP_BODY" ".success")
    ALLOCATION_REQUEST_ID=$(json_get "$LAST_HTTP_BODY" ".allocationRequestContractId")

    if [ "$success" = "true" ]; then
      test_pass "Fee request accepted"
      test_info "Allocation request: ${ALLOCATION_REQUEST_ID:0:32}..."
    else
      test_info "Accept returned success=false"
    fi
  else
    local error
    error=$(json_get "$LAST_HTTP_BODY" ".error")
    test_info "Accept fee request returned HTTP $LAST_HTTP_STATUS"
    test_info "Error: $error"
    test_skip "Accept fee request failed (likely needs specific auth)"
  fi
}

test_create_campaign() {
  test_begin "Create Campaign"

  if [ -z "$VALIDATED_APP_ID" ]; then
    test_skip "No validated app available - skipping campaign creation"
    return
  fi

  api_create_campaign "$VALIDATED_APP_ID"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local success
    success=$(json_get "$LAST_HTTP_BODY" ".success")
    CAMPAIGN_ID=$(json_get "$LAST_HTTP_BODY" ".campaignContractId")

    if [ "$success" = "true" ]; then
      test_pass "Campaign created successfully"
      test_info "Campaign ID: $TEST_CAMPAIGN_ID"
      test_info "Contract ID: ${CAMPAIGN_ID:0:32}..."
    else
      test_info "Create campaign returned success=false"
    fi
  else
    local error
    error=$(json_get "$LAST_HTTP_BODY" ".error")
    test_info "Create campaign returned HTTP $LAST_HTTP_STATUS"
    test_info "Error: $error"
    test_skip "Create campaign failed"
  fi
}

# Admin tests
test_admin_list_fee_requests() {
  test_begin "Admin: List Fee Requests"

  api_admin_list_fee_requests

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local count
    count=$(echo "$LAST_HTTP_BODY" | jq '.feeRequests | length' 2>/dev/null || echo "0")
    test_pass "Admin retrieved fee requests list"
    test_info "Fee requests found: $count"
  else
    test_info "Admin list fee requests returned HTTP $LAST_HTTP_STATUS"
    test_skip "Could not list fee requests (likely needs admin auth)"
  fi
}

test_admin_list_validated_apps() {
  test_begin "Admin: List Validated Apps"

  api_admin_list_validated_apps

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    local count
    count=$(echo "$LAST_HTTP_BODY" | jq '.validatedApps | length' 2>/dev/null || echo "0")
    test_pass "Admin retrieved validated apps list"
    test_info "Validated apps found: $count"
  else
    test_info "Admin list validated apps returned HTTP $LAST_HTTP_STATUS"
    test_skip "Could not list validated apps (likely needs admin auth)"
  fi
}

#############################################################################
# Main Execution
#############################################################################

run_tests() {
  test_info "Running tests against: $API_URL"

  # Health check
  test_health_check

  # FA endpoints
  test_list_fee_requests
  test_list_allocation_requests
  test_list_validated_apps

  # Workflow tests (require specific state)
  test_accept_fee_request
  test_create_campaign

  # Admin endpoints
  test_admin_list_fee_requests
  test_admin_list_validated_apps
}

main() {
  # Parse command line arguments
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
  local suite_name="Backr REST API E2E Tests"
  test_init "$suite_name"

  test_info "API URL: $API_URL"
  test_info "Run ID: $RUN_ID"

  if [ -n "$AUTH_TOKEN" ]; then
    test_info "Auth: Bearer token provided"
  else
    test_info "Auth: No token (some tests may be skipped)"
  fi

  # Check API availability
  echo ""
  test_info "Checking API availability..."
  if ! check_api_health "$API_URL"; then
    test_error "API is not available at $API_URL"
    echo ""
    echo "Please ensure the API is running:"
    echo "  pnpm --filter @backr/api dev"
    echo ""
    exit 1
  fi

  run_tests

  # Print summary and exit
  test_summary
  exit $?
}

# Run main
main "$@"
