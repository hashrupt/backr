#!/bin/bash
# Keycloak Utility Functions for Backr

#############################################################################
# JWT Token Functions
#############################################################################

# Decode JWT payload (base64url decode)
_decode_jwt_payload() {
  local token="$1"
  # Extract payload (second part of JWT)
  local payload=$(echo "$token" | cut -d. -f2)
  # Add padding if needed and decode
  local padded_payload="$payload"
  local mod=$((${#payload} % 4))
  if [ $mod -eq 2 ]; then
    padded_payload="${payload}=="
  elif [ $mod -eq 3 ]; then
    padded_payload="${payload}="
  fi
  # Base64url to base64 (replace - with + and _ with /)
  echo "$padded_payload" | tr '_-' '/+' | base64 -d 2>/dev/null
}

# Extract subject (sub) claim from JWT token
# Usage: get_token_sub TOKEN
get_token_sub() {
  local token="$1"
  _decode_jwt_payload "$token" | jq -r '.sub // empty'
}

# Extract party claim from JWT token (Canton uses 'party' claim)
# Usage: get_token_party TOKEN
get_token_party() {
  local token="$1"
  _decode_jwt_payload "$token" | jq -r '.party // empty'
}

#############################################################################
# Admin Token Functions
#############################################################################

# Get admin token for Keycloak management
get_admin_token() {
  local keycloak_url="${1:-$KEYCLOAK_URL}"
  local admin_user="${2:-$KEYCLOAK_ADMIN_USER}"
  local admin_password="${3:-$KEYCLOAK_ADMIN_PASSWORD}"

  curl -s -X POST "${keycloak_url}/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=admin-cli" \
    -d "username=${admin_user}" \
    -d "password=${admin_password}" \
    -d "grant_type=password" | jq -r '.access_token'
}

# Get user token for API calls
get_user_token() {
  local username="$1"
  local password="$2"
  local client_id="${3:-$WALLET_CLIENT_ID}"
  local token_url="${4:-$KEYCLOAK_TOKEN_URL}"

  curl -s -X POST "$token_url" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${client_id}" \
    -d "username=${username}" \
    -d "password=${password}" \
    -d "grant_type=password" | jq -r '.access_token'
}

# Get service account token
get_service_token() {
  local client_id="${1:-$VALIDATOR_CLIENT_ID}"
  local client_secret="${2:-$VALIDATOR_CLIENT_SECRET}"
  local token_url="${3:-$KEYCLOAK_TOKEN_URL}"

  curl -s -X POST "$token_url" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${client_id}" \
    -d "client_secret=${client_secret}" \
    -d "grant_type=client_credentials" \
    -d "scope=openid" | jq -r '.access_token'
}

# Create a user in Keycloak
create_keycloak_user() {
  local admin_token="$1"
  local username="$2"
  local password="$3"
  local firstname="$4"
  local lastname="$5"
  local email="${6:-${username}@backr.local}"

  local keycloak_url="${KEYCLOAK_URL}"
  local realm="${KEYCLOAK_REALM}"

  # Create user
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${keycloak_url}/admin/realms/${realm}/users" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${username}\",
      \"email\": \"${email}\",
      \"firstName\": \"${firstname}\",
      \"lastName\": \"${lastname}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"credentials\": [{
        \"type\": \"password\",
        \"value\": \"${password}\",
        \"temporary\": false
      }]
    }")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" == "201" ] || [ "$http_code" == "409" ]; then
    return 0
  else
    echo "Failed to create user $username: HTTP $http_code"
    return 1
  fi
}

# Get user ID from Keycloak
get_user_id() {
  local admin_token="$1"
  local username="$2"

  curl -s "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${username}&exact=true" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[0].id // ""'
}

# Delete a user from Keycloak
delete_keycloak_user() {
  local admin_token="$1"
  local username="$2"

  local user_id
  user_id=$(get_user_id "$admin_token" "$username")

  if [ -z "$user_id" ]; then
    echo "User '$username' does not exist, skipping deletion"
    return 0
  fi

  local response
  response=$(curl -s -w "\n%{http_code}" -X DELETE \
    "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user_id}" \
    -H "Authorization: Bearer $admin_token")

  local http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" == "204" ]; then
    echo "User '$username' deleted successfully"
    return 0
  else
    echo "Failed to delete user '$username': HTTP $http_code"
    return 1
  fi
}

#############################################################################
# Canton Rights Management
#############################################################################

# Grant rights to a user for a party (ActAs or ReadAs)
# Usage: grant_rights ADMIN_TOKEN USER_ID PARTY RIGHTS_TYPE PARTICIPANT_URL
grant_rights() {
  local admin_token="$1"
  local user_id="$2"
  local party="$3"
  local rights_type="${4:-ReadAs}"  # ActAs or ReadAs
  local participant_url="${5:-$PARTICIPANT_URL}"

  echo "Granting $rights_type rights for party $party to user $user_id..." >&2

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "${participant_url}/v2/user-management/users/${user_id}/rights" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"rights\": [{
        \"type\": \"ParticipantAdmin\"
      }, {
        \"type\": \"CanActAs\",
        \"party\": \"$party\"
      }, {
        \"type\": \"CanReadAs\",
        \"party\": \"$party\"
      }]
    }")

  local http_code=$(echo "$response" | tail -n1)
  local response_body=$(echo "$response" | sed '$d')

  if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
    echo "Rights granted successfully" >&2
    return 0
  else
    echo "Failed to grant rights: HTTP $http_code" >&2
    echo "Response: $response_body" >&2
    return 1
  fi
}
