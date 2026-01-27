#!/bin/bash
# Backr Environment Configuration Loader
# Usage: source load_env.sh [local|dev|test|prod]

DEPLOYMENT="${1:-local}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
LOAD_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local overrides if present (for secrets)
if [ -f "$LOAD_ENV_SCRIPT_DIR/.env.local" ]; then
  # shellcheck source=/dev/null
  source "$LOAD_ENV_SCRIPT_DIR/.env.local"
fi

case "$DEPLOYMENT" in
  local)
    # Canton Quickstart Local Network
    export CANTON_QUICKSTART_DIR="${CANTON_QUICKSTART_DIR:-/Users/dev/code/cn-quickstart/quickstart}"

    # Participant API (AppProvider)
    export PARTICIPANT_URL="http://localhost:3975"
    export PARTICIPANT_ADMIN_URL="http://localhost:3902"

    # Validator/Wallet API
    export VALIDATOR_HOST="http://wallet.localhost:3000"
    export VALIDATOR_URL="http://wallet.localhost:3000/api/validator"
    export WALLET_URL="http://wallet.localhost:3000"

    # Keycloak
    export KEYCLOAK_URL="http://keycloak.localhost:8082"
    export KEYCLOAK_REALM="AppProvider"
    export KEYCLOAK_TOKEN_URL="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"
    export KEYCLOAK_ADMIN_URL="${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}"
    export WALLET_CLIENT_ID="app-provider-unsafe"

    # Keycloak Admin (for user management)
    export KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
    export KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

    # Validator Service Account (for DAR uploads and admin operations)
    export VALIDATOR_CLIENT_ID="app-provider-validator"
    export VALIDATOR_CLIENT_SECRET="AL8648b9SfdTFImq7FV56Vd0KHifHBuC"

    # PostgreSQL (Backr uses separate DB)
    export POSTGRES_HOST="localhost"
    export POSTGRES_PORT="5433"
    export POSTGRES_USER="backr"
    export POSTGRES_PASSWORD="backr"
    export POSTGRES_DB="backr"
    ;;

  dev|devnet)
    echo -e "${YELLOW}Devnet configuration - Canton Validator DevNet${NC}"
    export PARTICIPANT_URL="${PARTICIPANT_URL:-https://your-validator.dev.canton.network/api/json-api}"
    export VALIDATOR_HOST="${VALIDATOR_HOST:-https://your-validator.dev.canton.network}"
    export VALIDATOR_URL="${VALIDATOR_URL:-https://your-validator.dev.canton.network/api/validator}"
    export KEYCLOAK_URL="${KEYCLOAK_URL:-https://iam.your-validator.dev.canton.network/cloak}"
    export KEYCLOAK_REALM="${KEYCLOAK_REALM:-canton-validator-1}"
    export KEYCLOAK_TOKEN_URL="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"
    export WALLET_CLIENT_ID="${WALLET_CLIENT_ID:-verity-ui}"

    # Validator Service Account
    export VALIDATOR_CLIENT_ID="${VALIDATOR_CLIENT_ID:-validator-backend}"
    if [ -z "$VALIDATOR_CLIENT_SECRET" ]; then
      echo -e "${RED}VALIDATOR_CLIENT_SECRET not set${NC}"
      echo "  Set via: export VALIDATOR_CLIENT_SECRET='<secret from Keycloak>'"
      echo "  Or create scripts/config/.env.local with the value"
    fi
    ;;

  *)
    echo -e "${RED}Unknown deployment: $DEPLOYMENT${NC}"
    echo "Usage: source load_env.sh [local|dev]"
    return 1
    ;;
esac

# Backr-specific paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BACKR_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export BACKR_SCRIPTS="$BACKR_ROOT/scripts"
export BACKR_DAML="$BACKR_ROOT/canton/daml"

echo -e "${GREEN}Environment loaded for: $DEPLOYMENT${NC}"
echo "  PARTICIPANT_URL: $PARTICIPANT_URL"
echo "  KEYCLOAK_URL: $KEYCLOAK_URL"
echo "  BACKR_ROOT: $BACKR_ROOT"
