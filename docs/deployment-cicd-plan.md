# Backr - Deployment, CI/CD & A/B Testing Plan

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
| Dockerfile | Local only (docker-compose) | Production Dockerfile |
| Deploy config | None | Vercel or container deploy |
| A/B testing | None | Feature flags + experimentation |
| Error monitoring | None | Sentry or equivalent |
| Rate limiting | None | API route protection |
| Canton ledger | Mocked | Real DAML integration (future) |

---

## 1. Deployment

### Option A: Vercel (Recommended)

**Why:** Zero-config for Next.js 16. SSR, API routes, middleware, edge functions all work natively. Preview deploys per PR are free.

**Setup:**
- Connect GitHub repo to Vercel
- Set environment variables (DATABASE_URL, NEXTAUTH_SECRET, etc.)
- Main branch auto-deploys to production
- PR branches get preview URLs automatically

**Cost:** Free tier covers hobby use. Pro ($20/mo) for team features.

**Limitations:** No long-running jobs (crawlers need separate infra). Cold starts on serverless.

### Option B: Railway / Render

**Why:** Container-based, supports long-running processes (crawlers, cron jobs). Single platform for app + worker.

**Setup:**
- Dockerfile for production build
- Railway/Render connects to GitHub for auto-deploy
- Can run crawler scripts as cron jobs on same platform

**Cost:** ~$5-20/mo depending on usage.

### Option C: Self-hosted (Docker + VPS)

**Why:** Full control, cheapest at scale, can run Canton node alongside.

**Setup:**
- Production Dockerfile (multi-stage build)
- Docker Compose with app + Postgres + reverse proxy (Caddy/Nginx)
- Manual or Watchtower-based deploys

**Cost:** ~$5-10/mo for VPS (Hetzner, DigitalOcean).

### Recommendation

**Start with Vercel** for the app (fastest to production, free preview deploys, zero ops). Run crawlers separately via GitHub Actions scheduled workflows or a small Railway worker.

---

## 2. CI/CD Pipeline

### GitHub Actions Workflow

```
PR opened/updated:
  1. Lint (eslint)
  2. Type check (tsc --noEmit)
  3. Build (next build)
  4. Unit tests (vitest)
  5. E2E tests (playwright) -- against preview deploy
  6. Preview deploy (Vercel auto)

Merge to main:
  1. Same checks as PR
  2. Production deploy (Vercel auto)
  3. Post-deploy smoke test

Scheduled (daily 2am UTC):
  1. Data import (crawler re-sync)
  2. Dependency audit (npm audit)
```

### Workflow Files to Create

**`.github/workflows/ci.yml`** - PR checks (lint, typecheck, build, test)
**`.github/workflows/deploy.yml`** - Production deploy on main merge
**`.github/workflows/import.yml`** - Scheduled data import (crawler)

### Test Strategy

| Type | Tool | Coverage Target | Files |
|------|------|----------------|-------|
| Unit | Vitest | Services, utils, keyword extraction | `*.test.ts` |
| Component | Vitest + Testing Library | UI components render correctly | `*.test.tsx` |
| API | Vitest | Route handlers return correct status/data | `*.test.ts` |
| E2E | Playwright | Critical user flows (browse, claim, back) | `e2e/*.spec.ts` |

**Priority test targets:**
1. Backing service (money movement - most critical)
2. Interest review flow (accept/decline)
3. Entity claim flow
4. Campaign creation + publish
5. Auth flow (register, login, protected routes)

---

## 3. A/B Testing

### Tier 1: Feature Flags (MVP)

Simple server-side feature flags using a database table or environment variables.

**Implementation:**

Add a `FeatureFlag` model to Prisma:
```
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

Create a utility:
```typescript
// src/lib/flags.ts
export async function isEnabled(key: string, userId?: string): Promise<boolean>
export async function getVariant(key: string, userId?: string): Promise<string>
```

**Use cases:**
- Toggle BackerInsights vs InvestmentProfile display
- Show/hide network stats placeholders
- Enable/disable collaboration suggestions
- Test different score algorithms

### Tier 2: Vercel Flags (Later)

When you need proper experimentation with metrics:

- `@vercel/flags` SDK for edge-evaluated flags
- Vercel Edge Config for instant flag updates (no redeploy)
- Analytics integration for measuring variant performance
- Gradual rollout with percentage-based targeting

### Tier 3: External Platform (Scale)

For data-driven experimentation:
- PostHog (open source, self-hostable)
- LaunchDarkly (enterprise)
- Statsig (free tier generous)

### Recommendation

**Start with Tier 1** (DB-backed feature flags). It's 1-2 files, no external deps, and covers toggle-based experiments. Move to Tier 2 when you need percentage-based rollouts with metrics.

---

## 4. Implementation Order

### Phase 1: CI Pipeline
1. Add Vitest config + first unit tests (backing service, keyword extraction)
2. Create `.github/workflows/ci.yml` with lint + typecheck + build + test
3. Add Playwright config + first E2E test (entity browse flow)

### Phase 2: Deployment
4. Connect repo to Vercel (or chosen platform)
5. Configure environment variables
6. Verify preview deploys work on PR
7. Set up production domain

### Phase 3: Feature Flags
8. Add FeatureFlag model to Prisma schema
9. Create `src/lib/flags.ts` utility
10. Add admin UI or seed initial flags
11. Wire first flag into BackerInsights component

### Phase 4: Monitoring
12. Add Sentry for error tracking
13. Add basic API rate limiting (middleware)
14. Set up uptime monitoring

### Phase 5: Scheduled Jobs
15. Create GitHub Actions scheduled workflow for data import
16. Add dependency audit workflow

---

## 5. Environment Setup

### Required for Production

```bash
# Database (Supabase)
DATABASE_URL="postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...@db.xxx.supabase.co:5432/postgres"

# Auth
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://backr.yourdomain.com"

# Supabase (if using storage/auth features)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Canton enrichment API
CANTON_SCAN_PROXY_URL="https://cantara.validator.canton.hashrupt.com/api/validator"
CANTON_SCAN_PROXY_TOKEN="..."
```

### Future

```bash
# Canton ledger (when DAML integration is ready)
CANTON_LEDGER_URL="..."
CANTON_SCANNER_API_URL="..."

# Feature flags (if using external provider)
# POSTHOG_KEY="..."

# Error monitoring
# SENTRY_DSN="..."
```

---

## Decision Points

Before implementing, these choices need to be made:

1. **Deploy target:** Vercel (recommended) vs Railway vs self-hosted?
2. **Test framework:** Vitest (recommended, fast, Vite-native) vs Jest?
3. **Feature flag approach:** DB-backed (simple) vs Vercel Flags vs external?
4. **Error monitoring:** Sentry (recommended) vs LogRocket vs Highlight?
5. **Domain:** What domain will production use?
6. **Canton timeline:** When will real DAML integration replace mocks?
