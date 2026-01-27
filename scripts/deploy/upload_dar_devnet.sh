#!/usr/bin/env bash
# Upload Backr DAR to DevNet Canton participant
# Requires: curl, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# DevNet configuration
PARTICIPANT_URL="${PARTICIPANT_URL:-https://cantara.validator.dev.canton.hashrupt.com/api/json-api}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://iam.validator.dev.canton.hashrupt.com/cloak}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-canton-validator-1}"
VALIDATOR_CLIENT_ID="${VALIDATOR_CLIENT_ID:?Set VALIDATOR_CLIENT_ID environment variable}"
VALIDATOR_CLIENT_SECRET="${VALIDATOR_CLIENT_SECRET:?Set VALIDATOR_CLIENT_SECRET environment variable}"

DAR_FILE="${PROJECT_ROOT}/canton/dars/backr-0.1.0.dar"

echo "=== Backr DAR Upload to DevNet ==="
echo "Participant: $PARTICIPANT_URL"
echo "DAR File: $DAR_FILE"
echo ""

# Check DAR exists
if [ ! -f "$DAR_FILE" ]; then
  echo "ERROR: DAR file not found: $DAR_FILE"
  echo ""
  echo "Build the DAR first:"
  echo "  cd ${PROJECT_ROOT}/canton/daml && daml build"
  exit 1
fi

# Get access token
echo "Getting access token..."
TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${VALIDATOR_CLIENT_ID}" \
  -d "client_secret=${VALIDATOR_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  -d "scope=openid")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "ERROR: Failed to get access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "Token obtained successfully"
echo ""

# Upload DAR
echo "Uploading DAR..."
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${PARTICIPANT_URL}/v2/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$DAR_FILE")

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "DAR uploaded successfully!"
  echo "Response: $BODY"
else
  echo "ERROR: DAR upload failed (HTTP $HTTP_CODE)"
  echo "Response: $BODY"
  exit 1
fi

echo ""
echo "=== Upload complete ==="
