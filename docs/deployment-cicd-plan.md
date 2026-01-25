# Backr - Deployment, CI/CD & Branching Strategy

## Current Architecture

```
Browser (Next.js 16 SSR + Client Components)
  |
  +-- Server Components --> Prisma --> PostgreSQL (Supabase)
  |
  +-- API Routes (/api/*) --> Services --> Prisma --> PostgreSQL
                                |
                          Canton Service (MOCK)
                          mock.ts: lockCC(), verifyOwnership(), etc.
                          Returns fake txHash, simulated balances
```

**Stack:** Next.js 16 | React 19 | Tailwind CSS 4 | Prisma 7 | Supabase PostgreSQL | NextAuth JWT

**What's real:** 110 source files, 15 API routes, 6 DB models, full auth, Zod validation, Prisma transactions

**What's mocked:** Canton ledger ops in `src/services/canton/mock.ts` (lock CC, verify ownership, unlock, withdraw)

---

## Production Gaps

| Area | Current | Needed |
|------|---------|--------|
| CI/CD | None | GitHub Actions pipeline |
| Tests | 0 files | Unit + E2E coverage |
| Branching | Direct push to main | Branch-per-environment |
| Deploy config | None | Vercel multi-project |
| A/B sites | None | Dual-site deploys (DAML model A + B) |
| Error monitoring | None | Sentry or equivalent |
| Rate limiting | None | API route protection |
| Canton ledger | Mocked | Real DAML integration (future) |

---

## 1. Branching Strategy

### Branch-per-Environment with Auto-Promotion

```
feature/* ──PR──▶ develop ──auto──▶ staging ──1-click──▶ main
                     │                 │                    │
                   DEV ENV          TEST ENV             PROD ENV
                  (1 site)         (2 sites)            (2 sites)
                     │            ┌────┴────┐          ┌────┴────┐
               dev.backr.io    test-a       test-b   prod-a      prod-b
                               .backr.io   .backr.io .backr.io   .backr.io
                               (DAML v1)   (DAML v2) (DAML v1)   (DAML v2)
```

### Branch → Environment Mapping

| Branch | Environment | Sites | Auto-deploy? |
|--------|------------|-------|-------------|
| `feature/*` | Vercel preview URL | 1 (ephemeral) | On PR open |
| `develop` | Dev | 1 | On merge to develop |
| `staging` | Test | 2 (A + B) | On merge to staging |
| `main` | Prod | 2 (A + B) | On merge to main |

### Branch Protection Rules

| Branch | Rules |
|--------|-------|
| `main` | Require CI pass, require PR (no direct push), no force push |
| `staging` | Require CI pass, require PR (no direct push), no force push |
| `develop` | Require CI pass, require PR (no direct push), no force push |

### Hotfix Flow

```
main ──branch──▶ hotfix/critical-fix ──PR──▶ main
                                              │
                                       (auto back-merge)
                                              │
                                       develop + staging
```

Hotfixes bypass the normal promotion chain. After merging to `main`, a GitHub Action auto-creates back-merge PRs to `develop` and `staging`.

---

## 2. A/B Site Architecture

### Purpose

Run two different DAML model versions in parallel. Each environment's A and B sites are **identical app code** deployed with **different environment variables** pointing to different Canton ledger endpoints.

### Site Differentiation (env vars only)

```bash
# Site A
SITE_VARIANT=A
CANTON_LEDGER_URL=https://canton-model-v1.example.com
DAML_MODEL_VERSION=1.0

# Site B
SITE_VARIANT=B
CANTON_LEDGER_URL=https://canton-model-v2.example.com
DAML_MODEL_VERSION=2.0
```

The app reads `SITE_VARIANT` and `DAML_MODEL_VERSION` via `src/lib/env.ts` to route Canton service calls to the correct endpoint. When DAML is mocked (current state), both sites behave identically.

### Database Strategy

| Environment | Database | Notes |
|-------------|----------|-------|
| Dev | Supabase project: `backr-dev` | Seeded with test data |
| Test-A | Supabase project: `backr-test` | Shared DB for both test sites |
| Test-B | Same as Test-A | Same DB — DAML model diff is at Canton layer |
| Prod-A | Supabase project: `backr-prod` | Shared production DB |
| Prod-B | Same as Prod-A | Same DB — different Canton endpoints only |

The A/B split is at the **Canton ledger layer**, not the database layer. Both A and B sites share the same PostgreSQL database per environment. If data isolation per DAML model is later needed, separate DB projects can be added.

---

## 3. Deployment

### Vercel Multi-Project Setup (5 projects, 1 repo)

| Vercel Project | Branch | Domain | Key Env Vars |
|---------------|--------|--------|-------------|
| `backr-dev` | `develop` | dev.backr.io | Dev DB, mock Canton |
| `backr-test-a` | `staging` | test-a.backr.io | Test DB, Canton endpoint A |
| `backr-test-b` | `staging` | test-b.backr.io | Test DB, Canton endpoint B |
| `backr-prod-a` | `main` | backr.io | Prod DB, Canton endpoint A |
| `backr-prod-b` | `main` | b.backr.io | Prod DB, Canton endpoint B |

Test-A and Test-B both deploy from `staging` but are separate Vercel projects with different env vars. Same for Prod-A and Prod-B from `main`.

**Alternative:** Deploy via GitHub Actions using `vercel deploy --env` for tighter control, instead of managing 5 separate Vercel projects.

**Cost:** Vercel Free covers 1 project. Pro ($20/mo) for team features. Multiple projects may require Pro or use the GitHub Actions deploy approach.

**Crawlers:** Long-running crawler jobs run via GitHub Actions scheduled workflows (not on Vercel).

---

## 4. CI/CD Pipeline

### Auto-Promotion Flow (Minimal Manual Intervention)

```
1. Developer merges PR → develop           (manual: approve PR)
2. develop auto-deploys to Dev             (auto)
3. CI runs on develop, if green:
   → GitHub Action auto-creates PR         (auto: develop → staging)
   → Auto-merges if CI passes              (auto)
4. staging auto-deploys to Test-A + Test-B (auto)
5. CI + E2E run on staging, if green:
   → GitHub Action auto-creates PR         (auto: staging → main)
   → Requires 1-click merge approval       (manual: only gate)
6. main auto-deploys to Prod-A + Prod-B   (auto)
7. Post-deploy smoke tests run             (auto)
```

**Manual steps: Only 2**
1. Approve feature PR into `develop`
2. Click merge on the `staging → main` promotion PR

Everything else is automated.

### GitHub Actions Workflows

**`.github/workflows/ci.yml`** — PR checks (all branches)
```yaml
# Triggers: pull_request to develop, staging, main
# Steps:
#   1. Checkout + install deps (npm ci)
#   2. Lint (eslint)
#   3. Type check (tsc --noEmit)
#   4. Build (next build)
#   5. Unit tests (vitest)
#   6. E2E tests (playwright) — against Vercel preview URL
```

**`.github/workflows/promote-to-staging.yml`** — Auto-promote develop → staging
```yaml
# Triggers: push to develop (after merge)
# Steps:
#   1. Create PR: develop → staging (if not already open)
#   2. Wait for CI to pass
#   3. Auto-merge the PR
```

**`.github/workflows/promote-to-prod.yml`** — Create prod promotion PR
```yaml
# Triggers: push to staging (after merge)
# Steps:
#   1. Create PR: staging → main (if not already open)
#   2. Label "ready-for-prod"
#   3. Post summary of changes since last prod deploy
#   (Manual merge required — the one manual gate)
```

**`.github/workflows/deploy.yml`** — Deploy dual sites
```yaml
# Triggers: push to staging, push to main
# Steps:
#   1. Determine environment (staging → test, main → prod)
#   2. Deploy Site A (vercel deploy with A env vars)
#   3. Deploy Site B (vercel deploy with B env vars)
#   4. Run post-deploy smoke tests against both site URLs
#   5. Notify on failure (Slack/Discord/email)
```

**`.github/workflows/import.yml`** — Scheduled data import
```yaml
# Triggers: schedule (daily 2am UTC)
# Steps:
#   1. Run crawler/import against dev DB
#   2. If successful, run against prod DB
```

**`.github/workflows/backmerge.yml`** — Hotfix back-merge
```yaml
# Triggers: push to main (for hotfix sync)
# Steps:
#   1. Create PR: main → staging (auto-merge)
#   2. Create PR: main → develop (auto-merge)
```

### Test Strategy

See **Section 9: Automated Testing Strategy** for the full testing plan.

---

## 5. Feature Flags

### Tier 1: DB-Backed Flags (MVP)

Add a `FeatureFlag` model to Prisma:
```prisma
model FeatureFlag {
  id        String   @id @default(cuid())
  key       String   @unique  // e.g. "backer_insights_v2"
  enabled   Boolean  @default(false)
  variant   String?  // Optional: "A" | "B" | "control"
  rollout   Int      @default(0)  // 0-100 percentage
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Utility:
```typescript
// src/lib/flags.ts
export async function isEnabled(key: string, userId?: string): Promise<boolean>
export async function getVariant(key: string, userId?: string): Promise<string>
```

**Use cases:**
- Toggle BackerInsights vs legacy display
- Show/hide network stats placeholders
- Enable/disable collaboration suggestions
- Test different scoring algorithms

### Tier 2: Vercel Flags (Later)
- `@vercel/flags` SDK for edge-evaluated flags
- Vercel Edge Config for instant updates (no redeploy)
- Gradual rollout with percentage-based targeting

### Tier 3: External Platform (Scale)
- PostHog (open source, self-hostable)
- LaunchDarkly (enterprise)
- Statsig (free tier generous)

---

## 6. Environment Variables

### All sites (shared secrets)
```bash
NEXTAUTH_SECRET="<openssl rand -base64 32>"
CANTON_SCAN_PROXY_URL="https://cantara.validator.canton.hashrupt.com/api/validator"
CANTON_SCAN_PROXY_TOKEN="..."
```

### Per-site (different per deploy)
```bash
# Site identity
SITE_VARIANT=A|B
NEXT_PUBLIC_SITE_VARIANT=A|B   # For UI site indicator

# Auth
NEXTAUTH_URL=https://[site-domain]

# Database (Supabase)
DATABASE_URL="postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...@db.xxx.supabase.co:5432/postgres"

# Canton ledger (different per A/B)
CANTON_LEDGER_URL=https://canton-model-v1.example.com
DAML_MODEL_VERSION=1.0

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

### Future
```bash
# Feature flags (if using external provider)
# POSTHOG_KEY="..."

# Error monitoring
# SENTRY_DSN="..."
```

---

## 7. App Code Changes

### `src/lib/env.ts` — Centralized environment config
```typescript
export const env = {
  siteVariant: process.env.SITE_VARIANT || 'A',
  damlModelVersion: process.env.DAML_MODEL_VERSION || '1.0',
  cantonLedgerUrl: process.env.CANTON_LEDGER_URL,
  isProduction: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV || 'development',
};
```

### `src/services/canton/service.ts` — DAML model routing
```typescript
import { env } from '@/lib/env';

// When real DAML integration is added, use env.damlModelVersion
// and env.cantonLedgerUrl to connect to the correct Canton endpoint
```

### `src/components/layout/SiteIndicator.tsx` — QA helper
Shows "Site A / v1.0" or "Site B / v2.0" badge in non-production environments.
Reads `NEXT_PUBLIC_SITE_VARIANT` so it's visible in the browser.

---

## 8. Automated Testing Strategy

### 8.1 Testing Tools & Configuration

| Tool | Purpose | Config File |
|------|---------|-------------|
| **Vitest** | Unit, service, API route tests | `vitest.config.ts` |
| **React Testing Library** | Component rendering & interaction | (via `@testing-library/react`) |
| **MSW (Mock Service Worker)** | API mocking for component/E2E tests | `src/mocks/handlers.ts` |
| **Playwright** | End-to-end browser tests | `playwright.config.ts` |
| **Prisma Client Mock** | DB layer isolation for unit tests | `src/__mocks__/db.ts` |

**Why these tools:**
- Vitest: Native ESM, fast HMR, compatible with Next.js + TypeScript
- MSW: Intercepts fetch at the network level — works for both client components and API tests
- Playwright: Cross-browser E2E, built-in Vercel preview URL support
- Prisma mock: Avoids test DB dependency for unit/service tests

### 8.2 Test Layers

```
┌─────────────────────────────────────────────────────┐
│  E2E (Playwright)                                    │
│  Full user flows in real browser                     │
│  ~10 specs │ Slow │ Run on CI only                   │
├─────────────────────────────────────────────────────┤
│  API Integration (Vitest)                            │
│  Route handlers with mocked DB                       │
│  ~15 suites │ Medium │ Run on CI + local             │
├─────────────────────────────────────────────────────┤
│  Component (Vitest + Testing Library)                │
│  Client components render & interact correctly       │
│  ~12 suites │ Fast │ Run on CI + local               │
├─────────────────────────────────────────────────────┤
│  Unit (Vitest)                                       │
│  Services, utils, pure functions                     │
│  ~20 suites │ Fastest │ Run on CI + local + pre-push │
└─────────────────────────────────────────────────────┘
```

### 8.3 Unit Tests — Services & Utils

Test pure business logic with mocked Prisma client. No DB needed.

| Test File | Source File | Key Tests |
|-----------|------------|-----------|
| `src/services/__tests__/backing.service.test.ts` | `backing.service.ts` | Create backing (happy path), insufficient balance rejection, unlock request timing, withdrawal completion, campaign amount update |
| `src/services/__tests__/interest.service.test.ts` | `interest.service.ts` | Register interest, duplicate prevention, review accept/decline, withdraw, invite send/respond |
| `src/services/__tests__/campaign.service.test.ts` | `campaign.service.ts` | Create draft, publish, close, list with filters, entity ownership check |
| `src/services/__tests__/entity.service.test.ts` | `entity.service.ts` | Create entity, claim flow, list with pagination, update fields |
| `src/services/__tests__/collaboration.service.test.ts` | `collaboration.service.ts` | Scoring algorithm, same-type bonus, shared backer scoring, limit param |
| `src/services/canton/__tests__/mock.test.ts` | `canton/mock.ts` | lockCC returns txHash, balance tracking, unlock timing, withdrawal flow |
| `src/lib/__tests__/constants.test.ts` | `constants.ts` | formatCC/parseCC round-trip, MIN_CC values, UNLOCK_PERIOD |
| `src/lib/__tests__/keyword-icons.test.ts` | `keyword-icons.ts` | Known keywords return correct icons, unknown returns default, extractOneLiner truncation |

**Prisma mock pattern:**
```typescript
// src/__mocks__/db.ts
import { PrismaClient } from '@/generated/prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

export const prismaMock = mockDeep<PrismaClient>();

// In vitest.setup.ts
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
```

### 8.4 API Route Tests

Test Next.js route handlers with mocked DB and auth. Validates request/response contracts.

| Test File | Route | Key Tests |
|-----------|-------|-----------|
| `src/app/api/auth/__tests__/register.test.ts` | `POST /api/auth/register` | Valid registration → 201, duplicate email → 400, missing fields → 400, weak password → 400, duplicate partyId → 400 |
| `src/app/api/campaigns/__tests__/route.test.ts` | `GET/POST /api/campaigns` | List with filters, create draft (auth required), create without auth → 401 |
| `src/app/api/campaigns/__tests__/publish.test.ts` | `POST /api/campaigns/[id]/publish` | Publish own draft → 200, publish other's → 403, publish non-draft → 400 |
| `src/app/api/interests/__tests__/route.test.ts` | `GET/POST /api/interests` | Register interest, pledge within min/max, duplicate → 400, closed campaign → 400 |
| `src/app/api/interests/__tests__/review.test.ts` | `PATCH /api/interests/[id]/review` | Accept/decline, non-owner → 403, non-pending → 400 |
| `src/app/api/backings/__tests__/route.test.ts` | `POST /api/backings` | Create from accepted interest, insufficient balance → 400, non-accepted → 400 |
| `src/app/api/entities/__tests__/route.test.ts` | `GET/PATCH /api/entities/[id]` | List with pagination, get by id, update owned entity, update unowned → 403 |
| `src/app/api/entities/__tests__/claim.test.ts` | `POST /api/entities/[id]/claim` | Claim unclaimed → 200, already claimed → 400, Canton verification |
| `src/app/api/entities/__tests__/collaborations.test.ts` | `GET /api/entities/[id]/collaborations` | Returns suggestions, limit param, empty result |
| `src/app/api/entities/__tests__/search.test.ts` | `GET /api/entities/search` | Search by name, by partyId, type filter, empty results |
| `src/app/api/invites/__tests__/route.test.ts` | `GET/POST /api/invites` | Send invite, respond accept/decline, non-recipient → 403 |

**Auth mock pattern:**
```typescript
import { getServerSession } from 'next-auth';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

// In test:
(getServerSession as Mock).mockResolvedValue({
  user: { id: 'user-1', email: 'test@test.com' }
});
```

### 8.5 Component Tests

Test client components with React Testing Library. Focus on interactive components with state.

| Test File | Component | Key Tests |
|-----------|-----------|-----------|
| `src/app/campaigns/[id]/__tests__/InterestForm.test.tsx` | InterestForm | Renders pledge input, submits with valid amount, shows validation errors, disabled when logged out |
| `src/app/my-interests/[id]/complete/__tests__/CompleteBackingForm.test.tsx` | CompleteBackingForm | Renders lock button, shows confirmation, handles success/error states |
| `src/app/claim-entity/__tests__/EntitySearch.test.tsx` | EntitySearch | Search input works, results render, claim button triggers API call |
| `src/app/my-entities/[id]/campaigns/[campaignId]/__tests__/InterestReview.test.tsx` | InterestReview | Renders pending interests, accept/decline buttons work, loading states |
| `src/app/my-invites/__tests__/InviteResponse.test.tsx` | InviteResponse | Accept/decline buttons, processing state, error handling |
| `src/app/campaigns/__tests__/CampaignFilters.test.tsx` | CampaignFilters | Search input updates URL, type filter, sort select |
| `src/components/entities/__tests__/BackerInsights.test.tsx` | BackerInsights | Score calculation, indicator rendering, insight generation, bar comparisons |
| `src/components/entities/__tests__/CollaborationSuggestions.test.tsx` | CollaborationSuggestions | Fetches data on mount, renders suggestions, handles empty state |
| `src/components/layout/__tests__/Header.test.tsx` | Header | Shows login when unauthenticated, shows user menu when authenticated |
| `src/components/interests/__tests__/InterestCard.test.tsx` | InterestCard | Renders status badge, withdraw button for pending, complete link for accepted |

### 8.6 E2E Tests (Playwright)

Full browser tests against running app (Vercel preview URL in CI, localhost in dev).

| Spec File | Flow | Steps |
|-----------|------|-------|
| `e2e/auth.spec.ts` | Auth flow | Register → login → see dashboard → logout → redirected |
| `e2e/browse-entities.spec.ts` | Entity browsing | Visit entities → filter by type → search → click entity → see details + BackerInsights |
| `e2e/claim-entity.spec.ts` | Entity claiming | Login → claim entity → search → claim → verify claimed status |
| `e2e/campaign-lifecycle.spec.ts` | Campaign flow | Login → create draft → publish → verify listed → close |
| `e2e/backing-flow.spec.ts` | Full backing | Login → find campaign → register interest → (mock accept) → complete backing |
| `e2e/interest-review.spec.ts` | Interest management | Login as entity owner → view interests → accept one → decline one → verify status |
| `e2e/invite-flow.spec.ts` | Invite flow | Login as owner → send invite → login as recipient → accept invite |
| `e2e/navigation.spec.ts` | Navigation & auth guards | Visit protected routes → redirected to login → login → access granted |
| `e2e/entities-pagination.spec.ts` | Pagination | Browse entities → navigate pages → verify page content changes |
| `e2e/smoke.spec.ts` | Post-deploy smoke | Homepage loads, API health check, entities page renders, login page renders |

### 8.7 Test Data & Database Strategy

| Layer | Database | Strategy |
|-------|----------|----------|
| Unit tests | None | Prisma mock (`vitest-mock-extended`) |
| API route tests | None | Prisma mock |
| Component tests | None | MSW for API responses |
| E2E tests (local) | Test DB | `prisma db push` + seed script before test run |
| E2E tests (CI) | Vercel preview | Tests run against deployed preview with seeded data |

**Test seed script** (`prisma/seed-test.ts`):
- Creates 3 users (owner, backer, viewer)
- Creates 5 entities (mix of FEATURED_APP and VALIDATOR, mix of claimed/unclaimed)
- Creates 3 campaigns (DRAFT, OPEN, FUNDED)
- Creates interests and backings for flow verification
- Deterministic IDs for E2E assertions

### 8.8 Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Services (unit) | 90% line coverage | Core business logic — most critical |
| API routes | 80% line coverage | Request/response contracts |
| Components | 70% line coverage | Interactive components only — skip UI primitives |
| Utils/lib | 95% line coverage | Pure functions, easy to test exhaustively |
| E2E | N/A (flow coverage) | 10 critical user flows covered |
| **Overall** | **75% line coverage** | Realistic target for MVP |

### 8.9 CI Integration

```
PR opened → ci.yml triggers:
  ├── Lint (eslint) ─────────────────────────┐
  ├── Type check (tsc --noEmit) ─────────────┤
  ├── Unit tests (vitest --coverage) ────────┤── All parallel
  ├── Component tests (vitest) ──────────────┤
  ├── API tests (vitest) ───────────────────┘
  │
  ├── Build (next build) ── sequential after lint+types
  │
  └── E2E tests (playwright) ── sequential after build
        └── Against Vercel preview URL (via Vercel GitHub integration)
```

**Fail-fast rules:**
- Any lint/type error → fail immediately
- Unit test failure → fail before build
- E2E failure → fail, post screenshot artifacts
- Coverage below threshold → warn (not block, initially)

---

## 9. Detailed Implementation Plan

### Phase 1: Testing Foundation

**Goal:** Set up test infrastructure and write first tests for the most critical service.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1.1 | Install test dependencies | `package.json` | — |
|     | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `vitest-mock-extended`, `msw`, `@playwright/test` | | |
| 1.2 | Create Vitest config | `vitest.config.ts` | 1.1 |
|     | Configure path aliases (`@/`), jsdom environment for `.tsx`, node for `.ts`, coverage provider (v8) | | |
| 1.3 | Create Vitest setup file | `vitest.setup.ts` | 1.2 |
|     | Import `@testing-library/jest-dom`, global mocks for `next/navigation`, `next-auth` | | |
| 1.4 | Create Prisma mock | `src/__mocks__/db.ts` | 1.1 |
|     | Deep mock of PrismaClient using `vitest-mock-extended` | | |
| 1.5 | Write backing service tests | `src/services/__tests__/backing.service.test.ts` | 1.4 |
|     | 8-10 test cases: create, insufficient balance, unlock, withdraw, amount update | | |
| 1.6 | Write interest service tests | `src/services/__tests__/interest.service.test.ts` | 1.4 |
|     | 10-12 test cases: register, duplicate, review, withdraw, invite send/respond | | |
| 1.7 | Write campaign service tests | `src/services/__tests__/campaign.service.test.ts` | 1.4 |
|     | 8 test cases: create, publish, close, list, ownership | | |
| 1.8 | Write entity service tests | `src/services/__tests__/entity.service.test.ts` | 1.4 |
|     | 8 test cases: create, claim, list, update, partyId lookup | | |
| 1.9 | Write collaboration service tests | `src/services/__tests__/collaboration.service.test.ts` | 1.4 |
|     | 5 test cases: scoring, same-type bonus, shared backers, limit | | |

**Acceptance:** `npx vitest run` passes with all service tests green.

### Phase 2: Utility & Canton Mock Tests

**Goal:** Cover pure functions and the Canton mock layer.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 2.1 | Write constants tests | `src/lib/__tests__/constants.test.ts` | 1.2 |
|     | formatCC/parseCC round-trip, boundary values, BigInt handling | | |
| 2.2 | Write keyword-icons tests | `src/lib/__tests__/keyword-icons.test.ts` | 1.2 |
|     | Known keywords, unknown fallback, extractOneLiner truncation | | |
| 2.3 | Write Canton mock tests | `src/services/canton/__tests__/mock.test.ts` | 1.2 |
|     | lockCC, requestUnlock, withdrawCC, verifyOwnership, balance tracking | | |
| 2.4 | Add npm test script | `package.json` | 1.2 |
|     | `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"` | | |

**Acceptance:** All utility and mock tests pass. `npm test` works from CLI.

### Phase 3: API Route Tests

**Goal:** Test all 15 API route handlers with mocked auth and DB.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 3.1 | Create API test helpers | `src/__tests__/helpers/api.ts` | 1.3 |
|     | Helper to create NextRequest, mock session, assert JSON response | | |
| 3.2 | Write auth register tests | `src/app/api/auth/__tests__/register.test.ts` | 3.1 |
|     | Valid, duplicate email, missing fields, weak password | | |
| 3.3 | Write campaigns route tests | `src/app/api/campaigns/__tests__/route.test.ts` | 3.1 |
|     | GET list with filters, POST create draft | | |
| 3.4 | Write campaign publish tests | `src/app/api/campaigns/__tests__/publish.test.ts` | 3.1 |
|     | Publish own, publish other's → 403, publish non-draft → 400 | | |
| 3.5 | Write interests route tests | `src/app/api/interests/__tests__/route.test.ts` | 3.1 |
|     | GET/POST, pledge validation, duplicate prevention | | |
| 3.6 | Write interest review tests | `src/app/api/interests/__tests__/review.test.ts` | 3.1 |
|     | Accept, decline, non-owner → 403, non-pending → 400 | | |
| 3.7 | Write backings route tests | `src/app/api/backings/__tests__/route.test.ts` | 3.1 |
|     | Create from accepted interest, insufficient balance, non-accepted → 400 | | |
| 3.8 | Write entities route tests | `src/app/api/entities/__tests__/route.test.ts` | 3.1 |
|     | GET list, GET detail, PATCH update owned, PATCH unowned → 403 | | |
| 3.9 | Write entity claim tests | `src/app/api/entities/__tests__/claim.test.ts` | 3.1 |
|     | Claim unclaimed, already claimed → 400 | | |
| 3.10 | Write entity collaborations tests | `src/app/api/entities/__tests__/collaborations.test.ts` | 3.1 |
|      | Returns suggestions, limit param, empty result | | |
| 3.11 | Write entity search tests | `src/app/api/entities/__tests__/search.test.ts` | 3.1 |
|      | Search by name, by partyId, type filter | | |
| 3.12 | Write invites route tests | `src/app/api/invites/__tests__/route.test.ts` | 3.1 |
|      | GET/POST, respond accept/decline, non-recipient → 403 | | |

**Acceptance:** All API tests pass. Route handler contracts verified for happy and error paths.

### Phase 4: Component Tests

**Goal:** Test client-side interactive components.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 4.1 | Create MSW handlers | `src/mocks/handlers.ts`, `src/mocks/server.ts` | 1.1 |
|     | Mock API responses for campaign, entity, interest endpoints | | |
| 4.2 | Write BackerInsights tests | `src/components/entities/__tests__/BackerInsights.test.tsx` | 1.3 |
|     | Score calculation, indicators, insights, comparison bars | | |
| 4.3 | Write InterestForm tests | `src/app/campaigns/[id]/__tests__/InterestForm.test.tsx` | 4.1 |
|     | Render, submit, validation, auth state | | |
| 4.4 | Write EntitySearch tests | `src/app/claim-entity/__tests__/EntitySearch.test.tsx` | 4.1 |
|     | Search, results, claim button | | |
| 4.5 | Write InterestReview tests | `.../__tests__/InterestReview.test.tsx` | 4.1 |
|     | Accept/decline buttons, loading states | | |
| 4.6 | Write InviteResponse tests | `src/app/my-invites/__tests__/InviteResponse.test.tsx` | 4.1 |
|     | Accept/decline, processing state | | |
| 4.7 | Write CampaignFilters tests | `src/app/campaigns/__tests__/CampaignFilters.test.tsx` | 4.1 |
|     | Search input, type select, sort select | | |
| 4.8 | Write Header tests | `src/components/layout/__tests__/Header.test.tsx` | 4.1 |
|     | Unauthenticated vs authenticated rendering | | |
| 4.9 | Write CollaborationSuggestions tests | `src/components/entities/__tests__/CollaborationSuggestions.test.tsx` | 4.1 |
|     | Fetch on mount, render results, empty state | | |
| 4.10 | Write CompleteBackingForm tests | `.../__tests__/CompleteBackingForm.test.tsx` | 4.1 |
|      | Lock button, confirmation, success/error | | |

**Acceptance:** All component tests pass. Interactive flows verified.

### Phase 5: E2E Tests

**Goal:** Full browser tests for critical user journeys.

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 5.1 | Create Playwright config | `playwright.config.ts` | 1.1 |
|     | Browsers: chromium + firefox, base URL from env, screenshot on failure | | |
| 5.2 | Create E2E test seed | `prisma/seed-test.ts` | — |
|     | Deterministic test users, entities, campaigns | | |
| 5.3 | Create E2E helpers | `e2e/helpers/auth.ts` | 5.1 |
|     | Login helper, test user credentials, page object patterns | | |
| 5.4 | Write smoke test | `e2e/smoke.spec.ts` | 5.1 |
|     | Homepage loads, entities page, login page, API responds | | |
| 5.5 | Write auth E2E | `e2e/auth.spec.ts` | 5.3 |
|     | Register → login → dashboard → logout → redirect | | |
| 5.6 | Write entity browsing E2E | `e2e/browse-entities.spec.ts` | 5.3 |
|     | Browse → filter → search → detail page | | |
| 5.7 | Write entity claim E2E | `e2e/claim-entity.spec.ts` | 5.3 |
|     | Login → claim entity → verify | | |
| 5.8 | Write campaign lifecycle E2E | `e2e/campaign-lifecycle.spec.ts` | 5.3 |
|     | Create draft → publish → listed → close | | |
| 5.9 | Write backing flow E2E | `e2e/backing-flow.spec.ts` | 5.3 |
|     | Interest → accept → complete backing | | |
| 5.10 | Write navigation guards E2E | `e2e/navigation.spec.ts` | 5.3 |
|      | Protected routes redirect, auth grants access | | |

**Acceptance:** `npx playwright test` passes. All critical flows verified.

### Phase 6: Branching & CI Pipeline

**Goal:** Set up branches, protection rules, and CI workflow.

| # | Task | Files / Actions | Depends On |
|---|------|-----------------|------------|
| 6.1 | Create `develop` branch from `main` | Git | — |
| 6.2 | Create `staging` branch from `main` | Git | — |
| 6.3 | Set branch protection rules on GitHub | GitHub settings | 6.1, 6.2 |
|     | Require CI pass + PR for all three branches | | |
| 6.4 | Create CI workflow | `.github/workflows/ci.yml` | Phases 1-5 |
|     | Lint → type check → build → unit tests → E2E (parallel where possible) | | |
| 6.5 | Verify CI runs on PR to develop | GitHub | 6.4 |

**Acceptance:** PR to `develop` triggers CI, all checks pass.

### Phase 7: Deployment & Promotion

**Goal:** Multi-site deploy and auto-promotion pipelines.

| # | Task | Files / Actions | Depends On |
|---|------|-----------------|------------|
| 7.1 | Create `src/lib/env.ts` | `src/lib/env.ts` | — |
|     | Centralized SITE_VARIANT, DAML_MODEL_VERSION, CANTON_LEDGER_URL | | |
| 7.2 | Create SiteIndicator component | `src/components/layout/SiteIndicator.tsx` | 7.1 |
|     | Badge showing site variant in non-prod environments | | |
| 7.3 | Update Canton service for env routing | `src/services/canton/index.ts` | 7.1 |
| 7.4 | Set up Vercel projects (5) | Vercel dashboard / CLI | — |
|     | backr-dev, backr-test-a, backr-test-b, backr-prod-a, backr-prod-b | | |
| 7.5 | Configure env vars per project | Vercel dashboard | 7.4 |
| 7.6 | Create deploy workflow | `.github/workflows/deploy.yml` | 7.4 |
|     | Dual-site deploy + post-deploy smoke tests | | |
| 7.7 | Create promote-to-staging workflow | `.github/workflows/promote-to-staging.yml` | 6.4 |
| 7.8 | Create promote-to-prod workflow | `.github/workflows/promote-to-prod.yml` | 6.4 |
| 7.9 | Create backmerge workflow | `.github/workflows/backmerge.yml` | — |
| 7.10 | Test full pipeline end-to-end | Manual | 7.6-7.9 |
|      | feature → develop → staging → main, verify all sites deploy | | |

**Acceptance:** Full promotion pipeline works. All 5 sites deploy correctly.

### Phase 8: Feature Flags, Monitoring & Scheduled Jobs

**Goal:** Production hardening.

| # | Task | Files / Actions | Depends On |
|---|------|-----------------|------------|
| 8.1 | Add FeatureFlag model | `prisma/schema.prisma` | — |
| 8.2 | Create flags utility | `src/lib/flags.ts` | 8.1 |
| 8.3 | Add Sentry error tracking | `sentry.client.config.ts`, `sentry.server.config.ts` | — |
| 8.4 | Add API rate limiting | `src/middleware.ts` | — |
| 8.5 | Create scheduled import workflow | `.github/workflows/import.yml` | — |
| 8.6 | Create dependency audit workflow | `.github/workflows/audit.yml` | — |

**Acceptance:** Feature flags work, errors reported to Sentry, rate limiting active.

---

### Implementation Priority Order

```
Phase 1 (Testing Foundation)     ──┐
Phase 2 (Utils & Canton Tests)   ──┼── Can be done in parallel
Phase 3 (API Route Tests)        ──┘
                                    │
Phase 4 (Component Tests)       ───── After Phases 1-3
                                    │
Phase 5 (E2E Tests)             ───── After Phase 4
                                    │
Phase 6 (Branching & CI)        ───── After Phase 5 (CI needs tests to run)
                                    │
Phase 7 (Deploy & Promotion)    ───── After Phase 6
                                    │
Phase 8 (Flags & Monitoring)    ───── After Phase 7
```

**Phases 1-3 can run in parallel** since they only depend on the test infrastructure (1.1-1.4).

**Total new files:** ~50 test files + 6 config files + 6 workflow files + 3 app code files

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Branch strategy | Branch-per-environment (develop → staging → main) |
| Environments | Dev (1 site), Test (2 sites), Prod (2 sites) |
| A/B sites purpose | Run different DAML model versions in parallel |
| Deploy target | Vercel (5 projects) or GitHub Actions-driven Vercel deploys |
| Manual gates | 2 only: approve feature PR + approve staging→main promotion |
| Site differentiation | Environment variables only, same codebase |
| DB per site | Shared per environment (A+B share same DB) |
| Test framework | Vitest (unit/component/API) + Playwright (E2E) |
| Feature flags | DB-backed (Tier 1), Vercel Flags later (Tier 2) |
| DB mocking | `vitest-mock-extended` deep mock of PrismaClient |
| API mocking | MSW for component tests |
| Coverage target | 75% overall, 90% services, 80% routes |
| E2E strategy | Playwright against Vercel preview URLs in CI |

## Open Decisions

| Question | Options |
|----------|---------|
| Error monitoring | Sentry (recommended) vs LogRocket vs Highlight |
| Production domain | backr.io? backr.xyz? TBD |
| Canton DAML timeline | When will real integration replace mocks? |
| Deploy method | 5 Vercel projects vs GitHub Actions `vercel deploy` |
