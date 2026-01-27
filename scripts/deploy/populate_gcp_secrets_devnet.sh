#!/usr/bin/env bash
# Populate GCP Secret Manager secrets for DevNet
# Run after setup_gcp_cloudrun.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID environment variable}"
ENV="devnet"

echo "=== Populating DevNet secrets for Backr ==="
echo "Project: $PROJECT_ID"
echo ""

# DevNet Canton configuration (Hashrupt)
echo "Setting Canton configuration..."
echo -n "cantara.validator.dev.canton.hashrupt.com" | gcloud secrets versions add "backr-${ENV}-canton-host" --data-file=- --project="$PROJECT_ID"
echo -n "443" | gcloud secrets versions add "backr-${ENV}-canton-port" --data-file=- --project="$PROJECT_ID"
echo -n "true" | gcloud secrets versions add "backr-${ENV}-canton-tls" --data-file=- --project="$PROJECT_ID"
echo -n "/api/json-api" | gcloud secrets versions add "backr-${ENV}-canton-base-path" --data-file=- --project="$PROJECT_ID"

# Keycloak configuration
echo "Setting Keycloak configuration..."
echo -n "https://iam.validator.dev.canton.hashrupt.com/cloak" | gcloud secrets versions add "backr-${ENV}-keycloak-url" --data-file=- --project="$PROJECT_ID"
echo -n "canton-validator-1" | gcloud secrets versions add "backr-${ENV}-keycloak-realm" --data-file=- --project="$PROJECT_ID"
echo -n "verity-ui" | gcloud secrets versions add "backr-${ENV}-keycloak-client" --data-file=- --project="$PROJECT_ID"

# Validator configuration
echo "Setting Validator configuration..."
echo -n "https://cantara.validator.dev.canton.hashrupt.com" | gcloud secrets versions add "backr-${ENV}-validator-host" --data-file=- --project="$PROJECT_ID"

# Database URL - you'll need to set this manually with your Cloud SQL or other DB connection string
echo ""
echo "NOTE: Database URL not set. Run manually:"
echo "  echo -n 'postgresql://user:pass@host:5432/backr' | gcloud secrets versions add backr-${ENV}-db-url --data-file=- --project=$PROJECT_ID"

echo ""
echo "=== DevNet secrets populated ==="
