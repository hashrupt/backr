# Backr Setup Scripts

Scripts for setting up and running Backr with Canton Quickstart.

## Prerequisites

1. **Canton Quickstart** installed at `~/code/cn-quickstart/quickstart`
2. **Daml SDK** for building DARs (optional if using pre-built)
3. **jq** for JSON processing
4. **curl** for API calls
5. **pnpm** for package management

## Quick Start

The fastest way to get started:

```bash
cd ~/code/backr
./scripts/setup/quick_start.sh
```

This will:
1. Start Canton Quickstart (if not running)
2. Install dependencies
3. Upload DARs to the ledger
4. Start the API and Web servers

## Manual Setup

### 1. Start Canton Quickstart

```bash
./scripts/setup/start_ledger.sh --wait
```

Or manually:
```bash
cd ~/code/cn-quickstart/quickstart
make start
```

### 2. Test Connection

```bash
./scripts/setup/test_connection.sh
```

### 3. Upload DARs

```bash
./scripts/setup/upload_dars.sh
```

### 4. Fresh Ledger Setup (Full)

For a complete setup with environment export:

```bash
./scripts/setup/setup_fresh_ledger.sh
```

### 5. Start Backr Services

**Option A: Docker Compose (recommended for production-like testing)**

```bash
docker compose -f docker-compose.dev.yml up
```

**Option B: Local development (hot reload)**

```bash
# Terminal 1: API
pnpm --filter @backr/api dev

# Terminal 2: Web
pnpm --filter @backr/web dev
```

## Scripts Reference

### Setup Scripts (`scripts/setup/`)

| Script | Description |
|--------|-------------|
| `quick_start.sh` | One-command setup for local development |
| `start_ledger.sh` | Start Canton Quickstart ledger |
| `upload_dars.sh` | Upload DARs to Canton participant |
| `setup_fresh_ledger.sh` | Complete E2E setup with verification |
| `test_connection.sh` | Test Canton and Keycloak connectivity |

### Config Scripts (`scripts/config/`)

| Script | Description |
|--------|-------------|
| `load_env.sh` | Load environment variables for deployment |

### Keycloak Scripts (`scripts/keycloak/`)

| Script | Description |
|--------|-------------|
| `utils.sh` | Keycloak utility functions (token, users) |

### Test Scripts (`scripts/test/`)

| Script | Description |
|--------|-------------|
| `json-api-test.sh` | Canton JSON API v2 direct tests (Level 1) |
| `backr-workflow-test.sh` | REST API E2E tests (Level 2) |
| `lib/test_utils.sh` | Test framework utilities |
| `lib/http_utils.sh` | HTTP request utilities |

## Test Hierarchy

Backr uses a 3-tier testing approach, matching the Settla architecture:

```
Level 1: Canton JSON API Direct
         ↓
Level 2: Backr REST API
         ↓
Level 3: Playwright UI E2E
```

### Level 1: JSON API Direct Tests

Tests DAML contracts directly via Canton JSON API v2:

```bash
# Run Canton JSON API tests
./scripts/test/json-api-test.sh

# Verbose output
./scripts/test/json-api-test.sh --verbose
```

Tests:
- Ledger offset queries
- Operator contract queries
- Fee request contract queries
- Allocation request contract queries
- Validated application queries
- Campaign contract queries

### Level 2: REST API Tests

Tests the Backr REST API endpoints:

```bash
# Without authentication (limited tests)
./scripts/test/backr-workflow-test.sh

# With authentication token
./scripts/test/backr-workflow-test.sh --token "$AUTH_TOKEN"

# Verbose output
./scripts/test/backr-workflow-test.sh --verbose
```

Tests:
- Health check
- List fee requests
- List allocation requests
- List validated apps
- Accept fee request
- Create campaign
- Admin endpoints

### Level 3: Playwright UI Tests

Tests the web UI with Playwright:

```bash
# Install Playwright browsers (first time only)
pnpm exec playwright install

# Run UI tests
pnpm test:e2e

# Run with UI mode (debug)
pnpm exec playwright test --ui

# Run specific test file
pnpm exec playwright test e2e/app-validation-workflow.spec.ts
```

Test files in `e2e/`:
- `app-validation-workflow.spec.ts` - Full validation flow
- `helpers/auth.ts` - Keycloak authentication
- `helpers/ledger.ts` - Canton ledger queries

## Configuration

### Environment Variables

Create `scripts/config/.env.local` for local overrides:

```bash
# Override Canton Quickstart location
CANTON_QUICKSTART_DIR=/path/to/cn-quickstart/quickstart

# Validator service account (from Keycloak)
VALIDATOR_CLIENT_SECRET=your-secret-here
```

### Default Configuration (Local)

| Variable | Value |
|----------|-------|
| `PARTICIPANT_URL` | http://localhost:3975 |
| `KEYCLOAK_URL` | http://keycloak.localhost:8082 |
| `KEYCLOAK_REALM` | AppProvider |
| `VALIDATOR_HOST` | http://wallet.localhost:3000 |
| `VALIDATOR_CLIENT_ID` | app-provider-validator |
| `WALLET_CLIENT_ID` | app-provider-unsafe |

### Service Account Credentials

For local development with Canton Quickstart:

```bash
VALIDATOR_CLIENT_ID=app-provider-validator
VALIDATOR_CLIENT_SECRET=AL8648b9SfdTFImq7FV56Vd0KHifHBuC
```

## Troubleshooting

### Canton Participant not responding

```bash
# Check if Canton Quickstart is running
cd ~/code/cn-quickstart/quickstart
docker compose ps

# Restart if needed
make stop && make start
```

### Keycloak authentication fails

Verify the realm exists:
```bash
curl http://keycloak.localhost:8082/realms/AppProvider
```

### DAR upload fails

1. Ensure Canton participant is healthy
2. Check that you have a valid token
3. Verify the DAR file exists: `ls canton/dars/backr-0.1.0.dar`

### Rebuild Backr DAR

```bash
cd canton/daml
daml build
# DAR will be at .daml/dist/backr-0.1.0.dar
```

## URLs

| Service | URL |
|---------|-----|
| Backr Web | http://localhost:5173 |
| Backr API | http://localhost:4001 |
| API Docs | http://localhost:4001/docs |
| Keycloak | http://keycloak.localhost:8082 |
| Wallet | http://wallet.localhost:3000 |
| Canton Participant | http://localhost:3975 |
