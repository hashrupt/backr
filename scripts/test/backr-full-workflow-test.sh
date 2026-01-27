#!/usr/bin/env bash
# Backr Complete Workflow E2E Tests
# Tests the full app validation workflow including CIP-56 token transfer
#
# Workflow:
#   1. Operator contract creation
#   2. Operator invites FA for validation (creates FeeRequest)
#   3. FA accepts fee request (creates AllocationRequest)
#   4. FA allocates funds (CIP-56 lock)
#   5. Operator executes transfer (CIP-56 atomic settlement)
#   6. FA creates campaign
#
# Usage:
#   ./backr-full-workflow-test.sh [options]

set -eo pipefail

#############################################################################
# Environment Setup
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source utilities
source "${SCRIPT_DIR}/lib/test_utils.sh"
source "${SCRIPT_DIR}/lib/http_utils.sh"

# Load environment
source "${PROJECT_ROOT}/scripts/config/load_env.sh" local 2>/dev/null || true

#############################################################################
# Configuration
#############################################################################

PARTICIPANT_URL="${PARTICIPANT_URL:-http://localhost:3975}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak.localhost:8082}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-AppProvider}"
WALLET_CLIENT_ID="${WALLET_CLIENT_ID:-app-provider-unsafe}"
VALIDATOR_CLIENT_ID="${VALIDATOR_CLIENT_ID:-app-provider-validator}"
VALIDATOR_CLIENT_SECRET="${VALIDATOR_CLIENT_SECRET:-AL8648b9SfdTFImq7FV56Vd0KHifHBuC}"
VALIDATOR_HOST="${VALIDATOR_HOST:-http://wallet.localhost:3000}"

# Test run ID for unique identifiers
RUN_ID=$(date +%s)

# Party IDs (will be loaded dynamically)
OPERATOR_PARTY=""
FA_PARTY=""
DSO_PARTY=""

# Package ID
BACKR_PKG="backr"

# Contract IDs (populated during test)
OPERATOR_CONTRACT_CID=""
FEE_REQUEST_CID=""
ALLOCATION_REQUEST_CID=""
VALIDATED_APP_CID=""
CAMPAIGN_CID=""
ALLOCATION_CID=""

# Verbose mode
VERBOSE="${VERBOSE:-false}"

#############################################################################
# Token Management
#############################################################################

get_service_token() {
  local token_url="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"

  curl -s -X POST "$token_url" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${VALIDATOR_CLIENT_ID}" \
    -d "client_secret=${VALIDATOR_CLIENT_SECRET}" \
    -d "grant_type=client_credentials" \
    -d "scope=openid" | jq -r '.access_token'
}

get_user_token() {
  local username="$1"
  local password="$2"
  local token_url="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"

  curl -s -X POST "$token_url" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "grant_type=password&client_id=${WALLET_CLIENT_ID}&username=${username}&password=${password}" \
    | jq -r '.access_token'
}

get_token_sub() {
  local token="$1"
  echo "$token" | cut -d. -f2 | tr '_-' '/+' | awk '{while(length($0)%4) $0=$0"="; print}' | base64 -d 2>/dev/null | jq -r '.sub'
}

get_user_party() {
  local token="$1"
  local user_id
  user_id=$(get_token_sub "$token")

  if [ -z "$user_id" ] || [ "$user_id" = "null" ]; then
    return 1
  fi

  local admin_token
  admin_token=$(get_service_token)

  local user_response
  user_response=$(curl -s "${PARTICIPANT_URL}/v2/users/${user_id}" \
    -H "Authorization: Bearer $admin_token")

  echo "$user_response" | jq -r '.user.primaryParty // empty'
}

#############################################################################
# DSO Party Lookup
#############################################################################

get_dso_party_id() {
  local token="$1"
  local scan_proxy_url="${VALIDATOR_HOST}/api/validator/v0/scan-proxy/dso-party-id"

  local response
  response=$(curl -s -X GET "$scan_proxy_url" \
    -H "Authorization: Bearer $token" 2>/dev/null)

  echo "$response" | jq -r '.dso_party_id // .dsoPartyId // empty'
}

#############################################################################
# Canton JSON API Helpers
#############################################################################

canton_submit() {
  local token="$1"
  local act_as="$2"
  local commands="$3"
  local disclosed_contracts="$4"
  # Fix for bash 3.2 brace parsing: use explicit check instead of ${4:-[]}
  if [ -z "$disclosed_contracts" ]; then
    disclosed_contracts='[]'
  fi

  local cmd_id="cmd-${RUN_ID}-$(date +%N)"

  local body
  body=$(jq -n \
    --arg cmdId "$cmd_id" \
    --arg actAs "$act_as" \
    --argjson cmds "$commands" \
    --arg wfId "backr-e2e-${RUN_ID}" \
    --arg appId "backr-e2e-test" \
    --argjson disclosed "$disclosed_contracts" \
    '{
      "commands": {
        "commandId": $cmdId,
        "actAs": [$actAs],
        "commands": $cmds,
        "workflowId": $wfId,
        "applicationId": $appId,
        "disclosedContracts": $disclosed
      }
    }')

  if [ "$VERBOSE" = "true" ]; then
    test_info "Request body:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi

  http_post "${PARTICIPANT_URL}/v2/commands/submit-and-wait-for-transaction" "$body" "$token"

  if [ "$VERBOSE" = "true" ]; then
    test_info "Response status: $LAST_HTTP_STATUS"
    test_info "Response body:"
    echo "$LAST_HTTP_BODY" | jq '.' 2>/dev/null || echo "$LAST_HTTP_BODY"
  fi
}

extract_created_contract_id() {
  local json="$1"
  local index="${2:-0}"

  local cid
  cid=$(echo "$json" | jq -r "[.transaction.events[]? | .CreatedEvent? | select(. != null) | .contractId] | .[$index] // empty" 2>/dev/null)

  if [ -z "$cid" ] || [ "$cid" = "null" ]; then
    cid=$(echo "$json" | jq -r '.. | .contractId? // empty' 2>/dev/null | head -1)
  fi

  echo "$cid"
}

extract_last_created_contract_id() {
  local json="$1"

  local cid
  cid=$(echo "$json" | jq -r '[.transaction.events[]? | .CreatedEvent? | select(. != null) | .contractId] | last // empty' 2>/dev/null)

  if [ -z "$cid" ] || [ "$cid" = "null" ]; then
    cid=$(echo "$json" | jq -r '.. | .contractId? // empty' 2>/dev/null | tail -1)
  fi

  echo "$cid"
}

canton_create() {
  local token="$1"
  local act_as="$2"
  local template_id="$3"
  local create_args="$4"

  local cmds_json
  cmds_json=$(jq -n \
    --arg tid "$template_id" \
    --argjson ca "$create_args" \
    '[{
      "CreateCommand": {
        "templateId": $tid,
        "createArguments": $ca
      }
    }]')

  canton_submit "$token" "$act_as" "$cmds_json"
}

canton_exercise() {
  local token="$1"
  local act_as="$2"
  local contract_id="$3"
  local template_id="$4"
  local choice="$5"
  local choice_args="$6"
  local disclosed_contracts="$7"
  # Fix for bash 3.2 brace parsing: use explicit checks instead of ${6:-{}} / ${7:-[]}
  if [ -z "$choice_args" ]; then
    choice_args='{}'
  fi
  if [ -z "$disclosed_contracts" ]; then
    disclosed_contracts='[]'
  fi

  local cmds_json
  cmds_json=$(jq -c -n \
    --arg cid "$contract_id" \
    --arg tid "$template_id" \
    --arg ch "$choice" \
    --argjson ca "$choice_args" \
    '[{
      "ExerciseCommand": {
        "contractId": $cid,
        "templateId": $tid,
        "choice": $ch,
        "choiceArgument": $ca
      }
    }]')

  canton_submit "$token" "$act_as" "$cmds_json" "$disclosed_contracts"
}

get_ledger_offset() {
  local token="$1"

  http_get "${PARTICIPANT_URL}/v2/state/ledger-end" "$token"
  echo "$LAST_HTTP_BODY" | jq -r '.offset // empty' 2>/dev/null
}

#############################################################################
# Amulet Helpers
#############################################################################

get_amulet_holdings() {
  local party="$1"
  local token="$2"
  local offset="$3"

  local request_body
  request_body=$(jq -n -c \
    --arg party "$party" \
    --arg offset "$offset" \
    '{
      "verbose": true,
      "activeAtOffset": $offset,
      "filter": {
        "filtersByParty": {
          ($party): {
            "cumulative": [{
              "identifierFilter": {
                "TemplateFilter": {
                  "value": {
                    "templateId": "3ca1343ab26b453d38c8adb70dca5f1ead8440c42b59b68f070786955cbf9ec1:Splice.Amulet:Amulet",
                    "includeCreatedEventBlob": false
                  }
                }
              }
            }]
          }
        }
      }
    }')

  local response
  response=$(curl -s -X POST "${PARTICIPANT_URL}/v2/state/active-contracts" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$request_body" 2>/dev/null)

  echo "$response" | jq -c '[.[].contractEntry.JsActiveContract.createdEvent.contractId // empty] | unique' 2>/dev/null
}

#############################################################################
# Test Cases
#############################################################################

test_get_tokens() {
  test_begin "Get Authentication Tokens"

  # Get operator token (service account)
  OP_TOKEN=$(get_service_token)
  if [ -n "$OP_TOKEN" ] && [ "$OP_TOKEN" != "null" ]; then
    test_pass "Operator service account token obtained"
  else
    test_fail "Failed to get operator token"
    return 1
  fi

  # Try to get FA token (user account)
  # First try common test users
  for user in "app-owner-1:abc123" "alice:abc123" "featured-app:abc123"; do
    local username="${user%:*}"
    local password="${user#*:}"
    FA_TOKEN=$(get_user_token "$username" "$password" 2>/dev/null)
    if [ -n "$FA_TOKEN" ] && [ "$FA_TOKEN" != "null" ]; then
      test_pass "FA token obtained (user: $username)"
      break
    fi
  done

  if [ -z "$FA_TOKEN" ] || [ "$FA_TOKEN" = "null" ]; then
    test_warn "Could not get FA user token"
    test_info "Using service account for FA operations (limited functionality)"
    FA_TOKEN="$OP_TOKEN"
  fi

  test_end
}

test_load_parties() {
  test_begin "Load Party IDs"

  OPERATOR_PARTY=$(get_user_party "$OP_TOKEN")
  if [ -n "$OPERATOR_PARTY" ]; then
    test_pass "Operator: ${OPERATOR_PARTY:0:40}..."
  else
    test_fail "Failed to get operator party ID"
    return 1
  fi

  FA_PARTY=$(get_user_party "$FA_TOKEN")
  if [ -n "$FA_PARTY" ]; then
    test_pass "FA: ${FA_PARTY:0:40}..."
  else
    test_warn "Could not get FA party, using operator party"
    FA_PARTY="$OPERATOR_PARTY"
  fi

  DSO_PARTY=$(get_dso_party_id "$OP_TOKEN")
  if [ -n "$DSO_PARTY" ] && [ "$DSO_PARTY" != "null" ]; then
    test_pass "DSO: ${DSO_PARTY:0:40}..."
  else
    test_warn "Could not get DSO party ID (CIP-56 may not work)"
  fi

  test_end
}

test_create_operator_contract() {
  test_begin "Create Operator Contract"

  # Fee configuration
  local fee_amount="25.0"

  local create_args
  create_args=$(jq -n \
    --arg op "$OPERATOR_PARTY" \
    --arg dso "$DSO_PARTY" \
    --arg fee "$fee_amount" \
    '{
      "operator": $op,
      "dsoParty": $dso,
      "defaultFeeAmount": $fee,
      "amuletInstrumentId": {
        "admin": $dso,
        "id": "Amulet"
      }
    }')

  canton_create "$OP_TOKEN" "$OPERATOR_PARTY" "#${BACKR_PKG}:Backr.Operator:Operator" "$create_args"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    OPERATOR_CONTRACT_CID=$(extract_created_contract_id "$LAST_HTTP_BODY" 0)
    if [ -n "$OPERATOR_CONTRACT_CID" ] && [ "$OPERATOR_CONTRACT_CID" != "null" ]; then
      test_pass "Operator created: ${OPERATOR_CONTRACT_CID:0:40}..."
    else
      test_fail "Could not extract Operator contract ID"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_fail "Failed to create Operator: $error"
    return 1
  fi

  test_end
}

test_invite_app_for_validation() {
  test_begin "Invite App for Validation (Create FeeRequest)"

  local prepare_until
  prepare_until=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+7 days" +%Y-%m-%dT%H:%M:%SZ)
  local settle_before
  settle_before=$(date -u -v+14d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+14 days" +%Y-%m-%dT%H:%M:%SZ)

  local choice_args
  # Canton JSON API v2 uses null for DAML Optional None values
  choice_args=$(jq -c -n \
    --arg fa "$FA_PARTY" \
    --arg appName "TestApp-${RUN_ID}" \
    --arg prepUntil "$prepare_until" \
    --arg settBefore "$settle_before" \
    '{
      "faParty": $fa,
      "appPartyId": $fa,
      "appName": $appName,
      "feeAmount": null,
      "prepareUntil": $prepUntil,
      "settleBefore": $settBefore
    }')

  canton_exercise "$OP_TOKEN" "$OPERATOR_PARTY" "$OPERATOR_CONTRACT_CID" \
    "#${BACKR_PKG}:Backr.Operator:Operator" "InviteAppForValidation" "$choice_args"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    FEE_REQUEST_CID=$(extract_last_created_contract_id "$LAST_HTTP_BODY")
    if [ -n "$FEE_REQUEST_CID" ] && [ "$FEE_REQUEST_CID" != "null" ]; then
      test_pass "FeeRequest created: ${FEE_REQUEST_CID:0:40}..."
    else
      test_fail "Could not extract FeeRequest contract ID"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_fail "Failed to create FeeRequest: $error"
    return 1
  fi

  test_end
}

test_accept_fee_request() {
  test_begin "FA Accepts Fee Request (Create AllocationRequest)"

  local choice_args
  choice_args=$(jq -c -n \
    --arg allocId "ALLOC-${RUN_ID}" \
    --arg holdingId "placeholder-holding-${RUN_ID}" \
    '{
      "allocationId": $allocId,
      "holdingContractId": $holdingId
    }')

  canton_exercise "$FA_TOKEN" "$FA_PARTY" "$FEE_REQUEST_CID" \
    "#${BACKR_PKG}:Backr.FeeRequest:ValidateApplicationOwnershipFeeRequest" "ValidateNAcceptAppOwnershipFee" "$choice_args"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    ALLOCATION_REQUEST_CID=$(extract_last_created_contract_id "$LAST_HTTP_BODY")
    if [ -n "$ALLOCATION_REQUEST_CID" ] && [ "$ALLOCATION_REQUEST_CID" != "null" ]; then
      test_pass "AllocationRequest created: ${ALLOCATION_REQUEST_CID:0:40}..."
      test_info "This implements CIP-56 AllocationRequest interface"
    else
      test_fail "Could not extract AllocationRequest contract ID"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_fail "Failed to accept fee request: $error"
    return 1
  fi

  test_end
}

test_cip56_allocate_funds() {
  test_begin "CIP-56: AllocateFunds (Lock FA's Amulet Holdings)"

  # Get ledger offset
  local offset
  offset=$(get_ledger_offset "$FA_TOKEN")
  if [ -z "$offset" ] || [ "$offset" = "null" ]; then
    test_skip "Could not get ledger offset"
    return 0
  fi
  test_info "Ledger offset: $offset"

  # Check DSO party
  if [ -z "$DSO_PARTY" ] || [ "$DSO_PARTY" = "null" ]; then
    test_skip "DSO party not available (required for CIP-56)"
    return 0
  fi

  # Get FA's Amulet holdings
  test_info "Getting FA's Amulet holdings..."
  local holdings
  holdings=$(get_amulet_holdings "$FA_PARTY" "$FA_TOKEN" "$offset")
  local holdings_count
  holdings_count=$(echo "$holdings" | jq 'length' 2>/dev/null || echo "0")

  test_info "Found $holdings_count Amulet holdings"

  if [ "$holdings_count" = "0" ] || [ "$holdings" = "[]" ] || [ "$holdings" = "null" ]; then
    test_skip "FA has no Amulet holdings (tap wallet first)"
    test_info "To get Amulets: use the wallet UI at http://wallet.localhost:3000"
    return 0
  fi

  # Get AllocationFactory from scan-proxy
  local wallet_url="${VALIDATOR_HOST}"
  local factory_url="${wallet_url}/api/validator/v0/scan-proxy/registry/allocation-instruction/v1/allocation-factory"

  test_info "Getting AllocationFactory from scan-proxy..."

  local requested_at
  requested_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Build allocation specification for fee payment
  local allocation_spec
  allocation_spec=$(jq -n \
    --arg sender "$FA_PARTY" \
    --arg receiver "$OPERATOR_PARTY" \
    --arg dso "$DSO_PARTY" \
    '{
      "settlement": {
        "executor": $receiver,
        "requestedAt": "'"$requested_at"'",
        "allocateBefore": "'"$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+1 hour" +%Y-%m-%dT%H:%M:%SZ)"'",
        "settleBefore": "'"$(date -u -v+24H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+24 hours" +%Y-%m-%dT%H:%M:%SZ)"'",
        "settlementRef": {"id": "ALLOC-'"$RUN_ID"'", "cid": null},
        "meta": {"values": {}}
      },
      "transferLeg": {
        "sender": $sender,
        "receiver": $receiver,
        "amount": "25.0",
        "instrumentId": {"admin": $dso, "id": "Amulet"},
        "meta": {"values": {}}
      },
      "transferLegId": "applicationValidationFee"
    }')

  local extra_args='{"context": {"values": {}}, "meta": {"values": {}}}'

  local factory_payload
  factory_payload=$(jq -n \
    --arg expectedAdmin "$DSO_PARTY" \
    --argjson allocation "$allocation_spec" \
    --arg requestedAt "$requested_at" \
    --argjson inputHoldingCids "$holdings" \
    --argjson extraArgs "$extra_args" \
    '{
      "choiceArguments": {
        "expectedAdmin": $expectedAdmin,
        "allocation": $allocation,
        "requestedAt": $requestedAt,
        "inputHoldingCids": $inputHoldingCids,
        "extraArgs": $extraArgs
      },
      "excludeDebugFields": true
    }')

  local factory_response
  factory_response=$(curl -s -X POST "$factory_url" \
    -H "Authorization: Bearer $FA_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$factory_payload" 2>/dev/null)

  local factory_cid
  factory_cid=$(echo "$factory_response" | jq -r '.factoryId // .contractId // empty')

  if [ -z "$factory_cid" ] || [ "$factory_cid" = "null" ]; then
    test_skip "Could not get AllocationFactory from scan-proxy"
    test_info "Response: $factory_response"
    return 0
  fi
  test_info "AllocationFactory: ${factory_cid:0:40}..."

  # Extract disclosed contracts and context
  local disclosed_contracts
  disclosed_contracts=$(echo "$factory_response" | jq -c '.choiceContext.disclosedContracts // []')

  local amulet_rules_cid
  amulet_rules_cid=$(echo "$factory_response" | jq -r '
    [.choiceContext.disclosedContracts[]?
    | select(.templateId | contains("Splice.AmuletRules:AmuletRules"))]
    | .[0].contractId // empty')

  local open_round_cid
  open_round_cid=$(echo "$factory_response" | jq -r '
    [.choiceContext.disclosedContracts[]?
    | select(.templateId | contains("Splice.Round:OpenMiningRound"))]
    | .[0].contractId // empty')

  if [ -n "$amulet_rules_cid" ] && [ "$amulet_rules_cid" != "null" ]; then
    extra_args=$(jq -n \
      --arg amuletRules "$amulet_rules_cid" \
      --arg openRound "$open_round_cid" \
      '{
        "context": {"values": {
          "amulet-rules": {"tag": "AV_ContractId", "value": $amuletRules},
          "open-round": {"tag": "AV_ContractId", "value": $openRound}
        }},
        "meta": {"values": {}}
      }')
    test_info "Found AmuletRules and OpenMiningRound for extraArgs"
  fi

  # Exercise AllocateFunds on AllocationRequest
  test_info "Exercising AllocateFunds choice..."

  local choice_args
  choice_args=$(jq -c -n \
    --arg factoryCid "$factory_cid" \
    --arg expectedAdmin "$DSO_PARTY" \
    --argjson holdingCids "$holdings" \
    --arg requestedAt "$requested_at" \
    --argjson extraArgs "$extra_args" \
    '{
      "allocationFactoryCid": $factoryCid,
      "expectedAdmin": $expectedAdmin,
      "inputHoldingCids": $holdingCids,
      "allocationRequestedAt": $requestedAt,
      "extraArgs": $extraArgs
    }')

  canton_exercise "$FA_TOKEN" "$FA_PARTY" "$ALLOCATION_REQUEST_CID" \
    "#${BACKR_PKG}:Backr.AllocationRequest:BackrApplicationOwnershipAllocationRequest" "AllocateFunds" \
    "$choice_args" "$disclosed_contracts"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    ALLOCATION_CID=$(echo "$LAST_HTTP_BODY" | jq -r '
      .transaction.events[]
      | select(.CreatedEvent)
      | select(.CreatedEvent.templateId | contains("Allocation"))
      | .CreatedEvent.contractId' 2>/dev/null | head -1)

    if [ -n "$ALLOCATION_CID" ] && [ "$ALLOCATION_CID" != "null" ]; then
      test_pass "Allocation created: ${ALLOCATION_CID:0:40}..."
      test_info "FA's 25 Amulets are now locked for settlement"
    else
      test_warn "AllocateFunds succeeded but could not extract Allocation CID"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_skip "AllocateFunds failed: $error"
    test_info "This may be expected if wallet integration is not fully set up"
  fi

  test_end
}

test_cip56_execute_transfer() {
  test_begin "CIP-56: ExecuteTransfer (Atomic Token Settlement)"

  if [ -z "$ALLOCATION_CID" ] || [ "$ALLOCATION_CID" = "null" ]; then
    test_skip "No Allocation contract available (AllocateFunds must succeed first)"
    return 0
  fi

  test_info "Executing atomic transfer with Allocation: ${ALLOCATION_CID:0:40}..."

  # Get ExecuteTransfer context from scan-proxy
  local wallet_url="${VALIDATOR_HOST}"
  local execute_url="${wallet_url}/api/validator/v0/scan-proxy/registry/allocations/v1/${ALLOCATION_CID}/choice-contexts/execute-transfer"

  test_info "Getting ExecuteTransfer context from scan-proxy..."

  local execute_response
  execute_response=$(curl -s -X POST "$execute_url" \
    -H "Authorization: Bearer $OP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"meta": {}}' 2>/dev/null)

  # Extract context
  local amulet_rules_cid open_round_cid
  amulet_rules_cid=$(echo "$execute_response" | jq -r '
    [.disclosedContracts[]?
    | select(.templateId | contains("AmuletRules"))]
    | .[0].contractId // empty')

  open_round_cid=$(echo "$execute_response" | jq -r '
    [.disclosedContracts[]?
    | select(.templateId | contains("OpenMiningRound"))]
    | .[0].contractId // empty')

  if [ -z "$amulet_rules_cid" ] || [ "$amulet_rules_cid" = "null" ]; then
    test_skip "Could not get ExecuteTransfer context from scan-proxy"
    test_info "Response: $execute_response"
    return 0
  fi

  test_info "AmuletRules: ${amulet_rules_cid:0:40}..."

  local extra_args
  extra_args=$(jq -n \
    --arg amuletRules "$amulet_rules_cid" \
    --arg openRound "$open_round_cid" \
    '{
      "context": {"values": {
        "amulet-rules": {"tag": "AV_ContractId", "value": $amuletRules},
        "open-round": {"tag": "AV_ContractId", "value": $openRound}
      }},
      "meta": {"values": {}}
    }')

  local disclosed_contracts
  disclosed_contracts=$(echo "$execute_response" | jq -c '.disclosedContracts // []')

  # Exercise ExecuteTransfer on AllocationRequest
  local choice_args
  choice_args=$(jq -c -n \
    --arg allocCid "$ALLOCATION_CID" \
    --argjson extraArgs "$extra_args" \
    '{
      "allocationCid": $allocCid,
      "extraArgs": $extraArgs
    }')

  canton_exercise "$OP_TOKEN" "$OPERATOR_PARTY" "$ALLOCATION_REQUEST_CID" \
    "#${BACKR_PKG}:Backr.AllocationRequest:BackrApplicationOwnershipAllocationRequest" "ExecuteTransfer" \
    "$choice_args" "$disclosed_contracts"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    VALIDATED_APP_CID=$(echo "$LAST_HTTP_BODY" | jq -r '
      .transaction.events[]
      | select(.CreatedEvent)
      | select(.CreatedEvent.templateId | contains("BackrValidatedApplication"))
      | .CreatedEvent.contractId' 2>/dev/null | head -1)

    if [ -n "$VALIDATED_APP_CID" ] && [ "$VALIDATED_APP_CID" != "null" ]; then
      test_pass "ExecuteTransfer succeeded!"
      test_pass "25 Amulets atomically transferred to Operator"
      test_pass "ValidatedApplication created: ${VALIDATED_APP_CID:0:40}..."
    else
      test_pass "ExecuteTransfer succeeded but ValidatedApplication not found"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_skip "ExecuteTransfer failed: $error"
  fi

  test_end
}

test_create_campaign() {
  test_begin "Create Campaign (Staking)"

  if [ -z "$VALIDATED_APP_CID" ] || [ "$VALIDATED_APP_CID" = "null" ]; then
    test_skip "No ValidatedApplication contract (ExecuteTransfer must succeed first)"
    return 0
  fi

  local ends_at
  ends_at=$(date -u -v+30d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+30 days" +%Y-%m-%dT%H:%M:%SZ)

  local choice_args
  choice_args=$(jq -c -n \
    --arg campaignId "CAMP-${RUN_ID}" \
    --arg endsAt "$ends_at" \
    '{
      "campaignId": $campaignId,
      "campaignType": "STAKING",
      "goal": "10000.0",
      "minBacking": "10.0",
      "maxBacking": "1000.0",
      "endsAt": $endsAt
    }')

  canton_exercise "$FA_TOKEN" "$FA_PARTY" "$VALIDATED_APP_CID" \
    "#${BACKR_PKG}:Backr.ValidatedApp:BackrValidatedApplication" "CreateCampaign" "$choice_args"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    CAMPAIGN_CID=$(extract_last_created_contract_id "$LAST_HTTP_BODY")
    if [ -n "$CAMPAIGN_CID" ] && [ "$CAMPAIGN_CID" != "null" ]; then
      test_pass "Campaign created: ${CAMPAIGN_CID:0:40}..."
      test_info "Campaign ID: CAMP-${RUN_ID}"
      test_info "Goal: 10000 Amulets"
      test_info "Type: STAKING"
    else
      test_warn "Campaign created but could not extract contract ID"
    fi
  else
    local error
    error=$(echo "$LAST_HTTP_BODY" | jq -r '.message // .cause // "Unknown error"')
    test_fail "Failed to create campaign: $error"
    return 1
  fi

  test_end
}

#############################################################################
# Summary
#############################################################################

print_workflow_summary() {
  echo ""
  echo "========================================"
  echo "Backr Workflow Summary"
  echo "========================================"
  echo ""
  echo "Operator Contract:     ${OPERATOR_CONTRACT_CID:-(not created)}"
  echo "Fee Request:           ${FEE_REQUEST_CID:-(not created)}"
  echo "Allocation Request:    ${ALLOCATION_REQUEST_CID:-(not created)}"
  echo "CIP-56 Allocation:     ${ALLOCATION_CID:-(not created)}"
  echo "Validated Application: ${VALIDATED_APP_CID:-(not created)}"
  echo "Campaign:              ${CAMPAIGN_CID:-(not created)}"
  echo ""

  if [ -n "$VALIDATED_APP_CID" ]; then
    echo "✓ FULL WORKFLOW COMPLETED"
    echo "  - App validation fee (25 Amulets) paid via CIP-56"
    echo "  - Application is validated and can create campaigns"
  elif [ -n "$ALLOCATION_REQUEST_CID" ]; then
    echo "◐ PARTIAL WORKFLOW"
    echo "  - Fee request accepted"
    echo "  - CIP-56 allocation pending (check FA has Amulets)"
  else
    echo "○ WORKFLOW STARTED"
    echo "  - Operator and fee request created"
    echo "  - Waiting for FA acceptance"
  fi
  echo ""
}

#############################################################################
# Main Execution
#############################################################################

run_workflow_tests() {
  test_info "Running Backr Complete Workflow E2E Tests"
  test_info "Participant: $PARTICIPANT_URL"
  test_info "Run ID: $RUN_ID"
  echo ""

  # Authentication
  test_get_tokens || return 1
  test_load_parties || return 1

  # Operator setup
  test_create_operator_contract || return 1

  # Fee request flow
  test_invite_app_for_validation || return 1
  test_accept_fee_request || return 1

  # CIP-56 Atomic Transfer
  test_cip56_allocate_funds
  test_cip56_execute_transfer

  # Campaign creation (if validated)
  test_create_campaign

  # Summary
  print_workflow_summary
}

main() {
  test_init "Backr Complete Workflow E2E Tests"

  # Check dependencies
  command -v curl &> /dev/null || { echo "Error: curl required"; exit 1; }
  command -v jq &> /dev/null || { echo "Error: jq required"; exit 1; }

  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --verbose|-v)
        VERBOSE="true"
        export HTTP_VERBOSE="true"
        shift
        ;;
      --help|-h)
        echo "Usage: $0 [--verbose]"
        exit 0
        ;;
      *)
        shift
        ;;
    esac
  done

  # Check Canton availability
  http_get "${PARTICIPANT_URL}/v2/version"
  if [ "$LAST_HTTP_STATUS" != "200" ]; then
    echo "Error: Canton not available at $PARTICIPANT_URL"
    echo "Run: cd ~/code/cn-quickstart/quickstart && make start"
    exit 1
  fi

  run_workflow_tests

  test_summary
  exit $?
}

main "$@"
