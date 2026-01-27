#!/usr/bin/env bash
# Setup GCP Cloud Run infrastructure for Backr
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - PROJECT_ID and REGION configured
#   - Billing enabled on project

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID environment variable}"
REGION="${GCP_REGION:-us-central1}"
GITHUB_ORG="${GITHUB_ORG:-hashrupt}"
GITHUB_REPO="${GITHUB_REPO:-backr}"

echo "=== Setting up GCP Cloud Run infrastructure for Backr ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "GitHub: $GITHUB_ORG/$GITHUB_REPO"
echo ""

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"

# Create Artifact Registry repository
echo ""
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create backr \
  --repository-format=docker \
  --location="$REGION" \
  --description="Backr Docker images" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Repository already exists"

# Create Service Account for GitHub Actions
SA_NAME="github-actions-backr"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo ""
echo "Creating service account..."
gcloud iam service-accounts create "$SA_NAME" \
  --description="GitHub Actions service account for Backr" \
  --display-name="GitHub Actions Backr" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Service account already exists"

# Grant required roles
echo ""
echo "Granting IAM roles..."
for role in \
  "roles/run.admin" \
  "roles/iam.serviceAccountUser" \
  "roles/artifactregistry.writer" \
  "roles/secretmanager.secretAccessor"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" \
    --condition=None \
    --quiet
done

# Setup Workload Identity Federation for GitHub Actions
echo ""
echo "Setting up Workload Identity Federation..."

POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "$POOL_NAME" \
  --location="global" \
  --description="GitHub Actions pool for Backr" \
  --display-name="GitHub Pool" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Pool already exists"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
  --location="global" \
  --workload-identity-pool="$POOL_NAME" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Provider already exists"

# Allow GitHub Actions to impersonate the service account
WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe "$POOL_NAME" \
  --location="global" \
  --project="$PROJECT_ID" \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --project="$PROJECT_ID" \
  --quiet

# Create secrets for each environment
echo ""
echo "Creating secrets..."
for env in devnet testnet mainnet; do
  for secret in canton-host canton-port canton-tls canton-base-path keycloak-url keycloak-realm keycloak-client validator-host db-url; do
    SECRET_NAME="backr-${env}-${secret}"
    gcloud secrets create "$SECRET_NAME" \
      --replication-policy="automatic" \
      --project="$PROJECT_ID" 2>/dev/null || echo "Secret $SECRET_NAME already exists"
  done
done

# Output configuration
echo ""
echo "=== Setup complete ==="
echo ""
echo "Add these secrets to your GitHub repository:"
echo ""
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_SERVICE_ACCOUNT: $SA_EMAIL"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: projects/$PROJECT_ID/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
echo ""
echo "Next steps:"
echo "1. Add the GitHub secrets above to your repository"
echo "2. Run populate_gcp_secrets_devnet.sh to populate Canton/Keycloak config"
echo "3. Run deploy-cloudrun.yml workflow to deploy"
