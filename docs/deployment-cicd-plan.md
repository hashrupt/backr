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

| Type | Tool | Coverage Target | Files |
|------|------|----------------|-------|
| Unit | Vitest | Services, utils, keyword extraction | `*.test.ts` |
| Component | Vitest + Testing Library | UI components render correctly | `*.test.tsx` |
| API | Vitest | Route handlers return correct status/data | `*.test.ts` |
| E2E | Playwright | Critical user flows (browse, claim, back) | `e2e/*.spec.ts` |

**Priority test targets:**
1. Backing service (money movement — most critical)
2. Interest review flow (accept/decline)
3. Entity claim flow
4. Campaign creation + publish
5. Auth flow (register, login, protected routes)

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

## 8. Implementation Order

### Phase 1: Branching & CI
1. Create `develop` and `staging` branches from `main`
2. Set branch protection rules on GitHub
3. Add Vitest config + first unit tests
4. Create `.github/workflows/ci.yml`
5. Add Playwright config + first E2E test

### Phase 2: Deployment
6. Set up 5 Vercel projects (or GitHub Actions deploy)
7. Configure environment variables per project
8. Create `.github/workflows/deploy.yml`
9. Verify all 5 sites deploy correctly

### Phase 3: Auto-Promotion
10. Create `.github/workflows/promote-to-staging.yml`
11. Create `.github/workflows/promote-to-prod.yml`
12. Create `.github/workflows/backmerge.yml`
13. Test full pipeline: feature → develop → staging → main

### Phase 4: Feature Flags & Monitoring
14. Add FeatureFlag model to Prisma schema
15. Create `src/lib/flags.ts` utility
16. Add Sentry for error tracking
17. Add API rate limiting (middleware)

### Phase 5: App Code & Scheduled Jobs
18. Create `src/lib/env.ts`
19. Create `src/components/layout/SiteIndicator.tsx`
20. Update Canton service for DAML model routing
21. Create `.github/workflows/import.yml` (scheduled crawler)
22. Create `.github/workflows` dependency audit

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

## Open Decisions

| Question | Options |
|----------|---------|
| Error monitoring | Sentry (recommended) vs LogRocket vs Highlight |
| Production domain | backr.io? backr.xyz? TBD |
| Canton DAML timeline | When will real integration replace mocks? |
| Deploy method | 5 Vercel projects vs GitHub Actions `vercel deploy` |
