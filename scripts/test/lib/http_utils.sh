#!/bin/bash
# HTTP Utilities Library for Backr E2E Tests
# Provides HTTP request helpers and JSON parsing utilities

#############################################################################
# Configuration
#############################################################################

# Default timeout for HTTP requests (seconds)
HTTP_TIMEOUT="${HTTP_TIMEOUT:-30}"

# Verbose mode (set to "true" to enable)
HTTP_VERBOSE="${HTTP_VERBOSE:-false}"

# Last HTTP response storage
export LAST_HTTP_STATUS=""
export LAST_HTTP_BODY=""
export LAST_HTTP_HEADERS=""

#############################################################################
# HTTP Request Functions
#############################################################################

# Perform a GET request
# Usage: http_get "url" [auth_token]
# Sets: LAST_HTTP_STATUS, LAST_HTTP_BODY
# Returns: 0 on success, 1 on curl failure
http_get() {
  local url="$1"
  local auth_token="${2:-}"

  local curl_args=(-s -w "\n%{http_code}" --max-time "$HTTP_TIMEOUT")

  if [ -n "$auth_token" ]; then
    curl_args+=(-H "Authorization: Bearer $auth_token")
  fi

  curl_args+=(-H "Content-Type: application/json")
  curl_args+=(-H "Accept: application/json")

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] GET $url" >&2
  fi

  local response
  response=$(curl "${curl_args[@]}" "$url" 2>/dev/null)
  local curl_exit=$?

  if [ $curl_exit -ne 0 ]; then
    LAST_HTTP_STATUS="000"
    LAST_HTTP_BODY='{"error": "Connection failed"}'
    return 1
  fi

  # Extract status code (last line) and body (everything else)
  LAST_HTTP_STATUS=$(echo "$response" | tail -n1)
  LAST_HTTP_BODY=$(echo "$response" | sed '$d')

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] Response: $LAST_HTTP_STATUS" >&2
    echo "[HTTP] Body: ${LAST_HTTP_BODY:0:200}..." >&2
  fi

  return 0
}

# Perform a POST request with JSON body
# Usage: http_post "url" "json_body" [auth_token]
# Sets: LAST_HTTP_STATUS, LAST_HTTP_BODY
# Returns: 0 on success, 1 on curl failure
http_post() {
  local url="$1"
  local body="$2"
  local auth_token="${3:-}"

  local curl_args=(-s -w "\n%{http_code}" --max-time "$HTTP_TIMEOUT" -X POST)

  if [ -n "$auth_token" ]; then
    curl_args+=(-H "Authorization: Bearer $auth_token")
  fi

  curl_args+=(-H "Content-Type: application/json")
  curl_args+=(-H "Accept: application/json")
  curl_args+=(-d "$body")

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] POST $url" >&2
    echo "[HTTP] Body: ${body:0:200}..." >&2
  fi

  local response
  response=$(curl "${curl_args[@]}" "$url" 2>/dev/null)
  local curl_exit=$?

  if [ $curl_exit -ne 0 ]; then
    LAST_HTTP_STATUS="000"
    LAST_HTTP_BODY='{"error": "Connection failed"}'
    return 1
  fi

  # Extract status code (last line) and body (everything else)
  LAST_HTTP_STATUS=$(echo "$response" | tail -n1)
  LAST_HTTP_BODY=$(echo "$response" | sed '$d')

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] Response: $LAST_HTTP_STATUS" >&2
    echo "[HTTP] Body: ${LAST_HTTP_BODY:0:200}..." >&2
  fi

  return 0
}

# Perform a PATCH request with JSON body
# Usage: http_patch "url" "json_body" [auth_token]
http_patch() {
  local url="$1"
  local body="$2"
  local auth_token="${3:-}"

  local curl_args=(-s -w "\n%{http_code}" --max-time "$HTTP_TIMEOUT" -X PATCH)

  if [ -n "$auth_token" ]; then
    curl_args+=(-H "Authorization: Bearer $auth_token")
  fi

  curl_args+=(-H "Content-Type: application/json")
  curl_args+=(-H "Accept: application/json")
  curl_args+=(-d "$body")

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] PATCH $url" >&2
  fi

  local response
  response=$(curl "${curl_args[@]}" "$url" 2>/dev/null)
  local curl_exit=$?

  if [ $curl_exit -ne 0 ]; then
    LAST_HTTP_STATUS="000"
    LAST_HTTP_BODY='{"error": "Connection failed"}'
    return 1
  fi

  LAST_HTTP_STATUS=$(echo "$response" | tail -n1)
  LAST_HTTP_BODY=$(echo "$response" | sed '$d')

  return 0
}

# Perform a DELETE request
# Usage: http_delete "url" [auth_token]
http_delete() {
  local url="$1"
  local auth_token="${2:-}"

  local curl_args=(-s -w "\n%{http_code}" --max-time "$HTTP_TIMEOUT" -X DELETE)

  if [ -n "$auth_token" ]; then
    curl_args+=(-H "Authorization: Bearer $auth_token")
  fi

  curl_args+=(-H "Accept: application/json")

  if [ "$HTTP_VERBOSE" = "true" ]; then
    echo "[HTTP] DELETE $url" >&2
  fi

  local response
  response=$(curl "${curl_args[@]}" "$url" 2>/dev/null)
  local curl_exit=$?

  if [ $curl_exit -ne 0 ]; then
    LAST_HTTP_STATUS="000"
    LAST_HTTP_BODY='{"error": "Connection failed"}'
    return 1
  fi

  LAST_HTTP_STATUS=$(echo "$response" | tail -n1)
  LAST_HTTP_BODY=$(echo "$response" | sed '$d')

  return 0
}

#############################################################################
# JSON Utilities
#############################################################################

# Extract a field from JSON using jq
# Usage: json_get "json_string" "jq_path"
# Example: json_get "$LAST_HTTP_BODY" ".id"
# Returns: The extracted value or empty string
json_get() {
  local json="$1"
  local path="$2"

  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed" >&2
    return 1
  fi

  echo "$json" | jq -r "$path" 2>/dev/null || echo ""
}

# Check if JSON contains a key
# Usage: json_has_key "json_string" "key"
# Returns: 0 if key exists, 1 otherwise
json_has_key() {
  local json="$1"
  local key="$2"

  local result
  result=$(echo "$json" | jq -r "has(\"$key\")" 2>/dev/null)

  if [ "$result" = "true" ]; then
    return 0
  else
    return 1
  fi
}

# Get array length from JSON
# Usage: json_array_length "json_string" "array_path"
json_array_length() {
  local json="$1"
  local path="${2:-.}"

  echo "$json" | jq -r "$path | length" 2>/dev/null || echo "0"
}

#############################################################################
# Utility Functions
#############################################################################

# Check if API is reachable
# Usage: check_api_health "base_url"
# Returns: 0 if healthy, 1 otherwise
check_api_health() {
  local base_url="$1"

  http_get "${base_url}/health"

  if [ "$LAST_HTTP_STATUS" = "200" ]; then
    return 0
  else
    return 1
  fi
}

# Wait for API to be ready
# Usage: wait_for_api "base_url" [max_attempts] [delay_seconds]
wait_for_api() {
  local base_url="$1"
  local max_attempts="${2:-30}"
  local delay="${3:-2}"

  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if check_api_health "$base_url"; then
      return 0
    fi

    echo "Waiting for API... (attempt $attempt/$max_attempts)"
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  return 1
}

# Generate a random string for test data
# Usage: random_string [length]
random_string() {
  local length="${1:-8}"

  if command -v openssl &> /dev/null; then
    openssl rand -hex "$((length / 2))" 2>/dev/null | cut -c1-"$length"
  else
    date +%s%N | sha256sum | head -c "$length"
  fi
}
