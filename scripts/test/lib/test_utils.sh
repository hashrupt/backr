#!/bin/bash
# Test Utilities Library for Backr E2E Tests
# Provides assertion framework, test lifecycle management, and logging

set -eo pipefail

#############################################################################
# Configuration
#############################################################################

# Color codes for output
export TEST_COLOR_RED='\033[0;31m'
export TEST_COLOR_GREEN='\033[0;32m'
export TEST_COLOR_YELLOW='\033[1;33m'
export TEST_COLOR_BLUE='\033[0;34m'
export TEST_COLOR_CYAN='\033[0;36m'
export TEST_COLOR_NC='\033[0m' # No Color

# Test counters
export TESTS_RUN=0
export TESTS_PASSED=0
export TESTS_FAILED=0
export TESTS_SKIPPED=0

# Test state
export CURRENT_TEST_NAME=""
export CURRENT_TEST_SUITE=""
export TEST_LOG_FILE=""
export TEST_START_TIME=""

# Test results array for detailed reporting
declare -a TEST_RESULTS=()

#############################################################################
# Initialization and Lifecycle
#############################################################################

# Initialize test suite
# Usage: test_init "Suite Name" [log_file]
test_init() {
  local suite_name="${1:-Test Suite}"
  local log_file="${2:-}"

  CURRENT_TEST_SUITE="$suite_name"
  TEST_START_TIME=$(date +%s)

  # Reset counters
  TESTS_RUN=0
  TESTS_PASSED=0
  TESTS_FAILED=0
  TESTS_SKIPPED=0
  TEST_RESULTS=()

  # Setup log file
  if [ -n "$log_file" ]; then
    TEST_LOG_FILE="$log_file"
    > "$TEST_LOG_FILE"
  else
    TEST_LOG_FILE="/tmp/backr_test_$(date +%Y%m%d_%H%M%S).log"
  fi

  echo ""
  echo -e "${TEST_COLOR_BLUE}================================================================${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_BLUE}  $suite_name${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_BLUE}================================================================${TEST_COLOR_NC}"
  echo ""
  echo "Started:  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Log file: $TEST_LOG_FILE"
  echo ""

  test_log "INFO" "Test suite initialized: $suite_name"
}

# Begin a test case
# Usage: test_begin "Test Name"
test_begin() {
  local test_name="$1"
  CURRENT_TEST_NAME="$test_name"

  echo ""
  echo -e "${TEST_COLOR_CYAN}----------------------------------------------------------------${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_CYAN}TEST: $test_name${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_CYAN}----------------------------------------------------------------${TEST_COLOR_NC}"

  test_log "INFO" "Starting test: $test_name"
}

# End a test case
# Usage: test_end [status] [message]
test_end() {
  local status="${1:-pass}"
  local message="${2:-}"

  if [ -n "$CURRENT_TEST_NAME" ]; then
    TEST_RESULTS+=("$status:$CURRENT_TEST_NAME:$message")
    test_log "INFO" "Test completed: $CURRENT_TEST_NAME ($status)"
    CURRENT_TEST_NAME=""
  fi
}

# Mark a test as passed
# Usage: test_pass "message"
test_pass() {
  local message="${1:-Test passed}"
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo -e "${TEST_COLOR_GREEN}PASS:${TEST_COLOR_NC} $message"
  test_log "PASS" "$message"
  test_end "pass" "$message"
}

# Mark a test as failed
# Usage: test_fail "message"
test_fail() {
  local message="${1:-Test failed}"
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo -e "${TEST_COLOR_RED}FAIL:${TEST_COLOR_NC} $message"
  test_log "FAIL" "$message"
  test_end "fail" "$message"
}

# Mark a test as skipped
# Usage: test_skip "message"
test_skip() {
  local message="${1:-Test skipped}"
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
  echo -e "${TEST_COLOR_YELLOW}SKIP:${TEST_COLOR_NC} $message"
  test_log "SKIP" "$message"
  test_end "skip" "$message"
}

# Print test summary
# Usage: test_summary
# Returns: 0 if all tests passed, 1 otherwise
test_summary() {
  local end_time=$(date +%s)
  local duration=$((end_time - TEST_START_TIME))

  echo ""
  echo -e "${TEST_COLOR_BLUE}================================================================${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_BLUE}  Test Summary: $CURRENT_TEST_SUITE${TEST_COLOR_NC}"
  echo -e "${TEST_COLOR_BLUE}================================================================${TEST_COLOR_NC}"
  echo ""
  echo "Duration:      ${duration}s"
  echo "Total Tests:   $TESTS_RUN"
  echo -e "Passed:        ${TEST_COLOR_GREEN}$TESTS_PASSED${TEST_COLOR_NC}"
  echo -e "Failed:        ${TEST_COLOR_RED}$TESTS_FAILED${TEST_COLOR_NC}"
  echo -e "Skipped:       ${TEST_COLOR_YELLOW}$TESTS_SKIPPED${TEST_COLOR_NC}"
  echo ""

  # Print failed tests if any
  if [ $TESTS_FAILED -gt 0 ]; then
    echo "Failed Tests:"
    for result in "${TEST_RESULTS[@]}"; do
      local status=$(echo "$result" | cut -d: -f1)
      local name=$(echo "$result" | cut -d: -f2)
      local msg=$(echo "$result" | cut -d: -f3-)
      if [ "$status" == "fail" ]; then
        echo -e "  ${TEST_COLOR_RED}x${TEST_COLOR_NC} $name: $msg"
      fi
    done
    echo ""
  fi

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${TEST_COLOR_GREEN}ALL TESTS PASSED${TEST_COLOR_NC}"
    test_log "INFO" "All tests passed: $TESTS_PASSED/$TESTS_RUN"
    return 0
  else
    echo -e "${TEST_COLOR_RED}SOME TESTS FAILED${TEST_COLOR_NC}"
    test_log "ERROR" "Tests failed: $TESTS_FAILED/$TESTS_RUN"
    return 1
  fi
}

#############################################################################
# Logging
#############################################################################

# Log a message to the test log file
# Usage: test_log "LEVEL" "message"
test_log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  if [ -n "$TEST_LOG_FILE" ]; then
    echo "[$timestamp] [$level] $message" >> "$TEST_LOG_FILE"
  fi
}

# Log and print an info message
# Usage: test_info "message"
test_info() {
  echo -e "${TEST_COLOR_CYAN}i${TEST_COLOR_NC} $1"
  test_log "INFO" "$1"
}

# Log a warning
# Usage: test_warn "message"
test_warn() {
  echo -e "${TEST_COLOR_YELLOW}!${TEST_COLOR_NC} $1"
  test_log "WARN" "$1"
}

# Log an error
# Usage: test_error "message"
test_error() {
  echo -e "${TEST_COLOR_RED}x${TEST_COLOR_NC} $1"
  test_log "ERROR" "$1"
}

#############################################################################
# Assertions
#############################################################################

# Assert a value is not empty
# Usage: assert_not_empty "value" "description"
# Returns: 0 on pass, 1 on fail
assert_not_empty() {
  local value="$1"
  local description="$2"
  TESTS_RUN=$((TESTS_RUN + 1))

  if [ -n "$value" ] && [ "$value" != "null" ] && [ "$value" != "" ]; then
    echo -e "${TEST_COLOR_GREEN}+${TEST_COLOR_NC} PASS: $description"
    test_log "PASS" "$description (value: ${value:0:50}...)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${TEST_COLOR_RED}x${TEST_COLOR_NC} FAIL: $description (got: '$value')"
    test_log "FAIL" "$description (got: '$value')"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Assert two values are equal
# Usage: assert_equals "expected" "actual" "description"
assert_equals() {
  local expected="$1"
  local actual="$2"
  local description="$3"
  TESTS_RUN=$((TESTS_RUN + 1))

  if [ "$expected" = "$actual" ]; then
    echo -e "${TEST_COLOR_GREEN}+${TEST_COLOR_NC} PASS: $description"
    test_log "PASS" "$description (expected: $expected, got: $actual)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${TEST_COLOR_RED}x${TEST_COLOR_NC} FAIL: $description (expected: '$expected', got: '$actual')"
    test_log "FAIL" "$description (expected: '$expected', got: '$actual')"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Assert HTTP status code
# Usage: assert_http_status "expected_status" "actual_status" "description"
assert_http_status() {
  local expected="$1"
  local actual="$2"
  local description="$3"
  TESTS_RUN=$((TESTS_RUN + 1))

  if [ "$expected" = "$actual" ]; then
    echo -e "${TEST_COLOR_GREEN}+${TEST_COLOR_NC} PASS: $description (HTTP $actual)"
    test_log "PASS" "$description (HTTP $actual)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${TEST_COLOR_RED}x${TEST_COLOR_NC} FAIL: $description (expected HTTP $expected, got HTTP $actual)"
    test_log "FAIL" "$description (expected HTTP $expected, got HTTP $actual)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Assert a string contains a substring
# Usage: assert_contains "haystack" "needle" "description"
assert_contains() {
  local haystack="$1"
  local needle="$2"
  local description="$3"
  TESTS_RUN=$((TESTS_RUN + 1))

  if echo "$haystack" | grep -q "$needle"; then
    echo -e "${TEST_COLOR_GREEN}+${TEST_COLOR_NC} PASS: $description"
    test_log "PASS" "$description (found: $needle)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${TEST_COLOR_RED}x${TEST_COLOR_NC} FAIL: $description (did not find: '$needle')"
    test_log "FAIL" "$description (did not find: '$needle')"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}
