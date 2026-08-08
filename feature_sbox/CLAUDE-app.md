# Vanyshr App — Holistic Context Reference

**Last updated**: 2026-08-08

This document is the reference for understanding Vanyshr's architecture, data model, and integration points. Each feature in `feature_sbox/` has its own `CLAUDE.md` with targeted context; this file provides the holistic picture agents need to integrate features properly.

---

## Product Overview

**Vanyshr** is a comprehensive people search aggregator. Users search by name, zip code, or date of birth and get consolidated results from multiple scrapers (FastPeopleSearch, ZabaSearch, AnyWho) with adaptive batching, fallback strategies, and residential proxy rotation to maximize success rates.

**Key user flows**:
1. User logs in → dashboard
2. Enter search params (name, zip, DOB) → submit query
3. Backend orchestrates scrapers in parallel → aggregates results
4. Results displayed in dashboard with deduplication & scoring

---

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js + React + Tailwind | Web UI, routing, state management |
| Backend Orchestration | Convex | Real-time functions, data sync, RPC |
| Async Workflows | Trigger.dev + Convex Workflows | Long-running scraper jobs |
| Database | Supabase (PostgreSQL) | User auth, RLS, persistent data |
| Services | Custom Node modules | Scraper adapters, orchestration logic |
| Deployment | Vercel (frontend) + Convex (backend) | Prod hosting |

---

## Directory Structure

```
Vanyshr-mono/
├── apps/app/                    # Main Next.js application
│   ├── src/
│   │   ├── pages/              # Route definitions (index, dashboard, onboarding, etc.)
│   │   ├── components/         # React components (search form, results table, etc.)
│   │   ├── lib/
│   │   │   ├── env.ts         # Environment & config
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── utils/         # Utilities (formatting, validation, etc.)
│   │   └── styles/            # Tailwind, global CSS
│   ├── public/                # Static assets
│   └── package.json
│
├── packages/backend/            # Convex functions & types
│   └── convex/
│       ├── queries/            # Read-only functions
│       ├── mutations/          # Write operations
│       ├── actions/            # Server-side logic (API calls, etc.)
│       ├── schema.ts           # Data model definitions
│       └── orchestration/      # Workflow definitions (Convex Workflows, Trigger.dev)
│
├── packages/services/           # Service modules
│   ├── fps/                    # FastPeopleSearch scraper adapter
│   │   ├── src/
│   │   │   ├── adapter.ts     # FPS API wrapper
│   │   │   ├── fingerprint.ts # Camoufox fingerprint config
│   │   │   └── batching.ts    # Request batching logic
│   │   └── tests/
│   ├── zaba/                   # ZabaSearch adapter (planned)
│   ├── anywho/                 # AnyWho adapter (planned)
│   ├── orchestration/          # Scraper coordination
│   │   ├── index.ts           # Main orchestration logic
│   │   ├── aggregator.ts      # Result deduplication & scoring
│   │   └── strategy.ts        # Fallback & retry strategies
│   └── shared/                 # Scrapers' shared utilities
│       ├── proxy.ts           # Proxy rotation (FlameProxies)
│       ├── types.ts           # Common types
│       └── error-handler.ts   # Error recovery
│
├── packages/shared/             # App-wide shared types & utilities
│   ├── types/
│   │   ├── api.ts             # API request/response types
│   │   ├── domain.ts          # Domain models (User, SearchResult, etc.)
│   │   └── scraper.ts         # Scraper-specific types
│   └── utils/
│       ├── validation.ts      # Input validation
│       └── formatting.ts      # Output formatting
│
├── packages/ui/                 # Reusable UI component library
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── SearchForm.tsx
│   │   └── ...
│   └── package.json
│
├── feature_sbox/                # Feature sandboxes (isolated dev)
│   ├── CLAUDE-app.md           # ← This file
│   ├── feature-{name}/         # Each feature gets its own directory
│   │   ├── CLAUDE.md
│   │   ├── journal.md
│   │   ├── feature_roadmap.md
│   │   ├── src/
│   │   └── tests/
│   └── ...
│
├── docs/                        # User-facing & team documentation
├── scripts/                     # Build & deployment scripts
└── package.json, pnpm-lock.yaml, etc.
```

---

## Data Model

### Core Entities (Supabase)

**users**
```sql
id UUID (PK)
email VARCHAR (unique)
password_hash VARCHAR
created_at TIMESTAMP
-- RLS: Users can only read/write their own row
```

**search_results**
```sql
id UUID (PK)
user_id UUID (FK → users.id)
query_params JSONB {name, zip, dob}
raw_results JSONB {fps: [...], zaba: [...], anywho: [...]}
deduped_results JSONB [{matched_person, sources, confidence_score}]
created_at TIMESTAMP
-- RLS: Users can only read/write their own searches
```

**scraper_logs** (optional, for debugging)
```sql
id UUID (PK)
user_id UUID
scraper_name VARCHAR (fps, zaba, anywho)
query_params JSONB
status VARCHAR (success, rate_limit, cloudflare_block, error)
error_message TEXT
timestamp TIMESTAMP
```

### Convex Schema

Mirrors Supabase tables + adds sync fields for real-time:
- `users`: User metadata (onboarding status, preferences)
- `searchResults`: Synced from Supabase
- `scraperJobs`: In-flight Trigger.dev jobs (status, progress)

---

## Key Flows

### Search Orchestration

```
User submits search (name, zip, DOB)
  ↓
[apps/app] → Convex mutation: startSearch({user_id, query_params})
  ↓
[packages/backend] → Create search_results record; trigger Trigger.dev workflow
  ↓
[Trigger.dev] → Invoke Convex action: runScrapers({query_params})
  ↓
[packages/services/orchestration] → Parallel scraper calls:
  ├─ fps/adapter.ts → FPS API (with Camoufox fingerprint, residential proxy)
  ├─ zaba/adapter.ts → ZabaSearch (if implemented)
  └─ anywho/adapter.ts → AnyWho (if implemented)
  ↓
[packages/services/orchestration/aggregator.ts] → Deduplicate & score results
  ↓
[packages/backend] → Update search_results with deduped_results; emit Convex subscription update
  ↓
[apps/app] → Real-time results displayed in dashboard
```

### Authentication & RLS

```
User logs in (email/password or social)
  ↓
[Supabase Auth] → Generate JWT
  ↓
[apps/app] → Store JWT in localStorage/session cookie
  ↓
[Convex query/mutation] → Convex verifies JWT, extracts user_id
  ↓
[Supabase RLS] → All queries automatically filtered by user_id
  (e.g., SELECT * FROM search_results WHERE user_id = auth.uid())
```

### Adaptive Rate-Limiting & Fallback

```
Scraper call attempted
  ↓
If rate limit detected:
  ├─ Retry with exponential backoff (2s, 4s, 8s)
  └─ If still blocked, try fallback source (e.g., FPS → ZabaSearch)
  ↓
If Cloudflare Turnstile blocks:
  ├─ Rotate proxy (FlameProxies residential pool)
  ├─ Update Camoufox fingerprint (mobile/desktop variant)
  └─ Retry (max 3 times)
  ↓
If all attempts fail:
  └─ Return partial results (what succeeded) + error metadata
```

---

## Integration Points for New Features

### Adding UI Pages/Components

1. **New page**: Create route in `apps/app/src/pages/{route}.tsx`
2. **New component**: Add to `packages/ui/components/` or inline in `apps/app/src/components/`
3. **Styling**: Use Tailwind classes (no new CSS files unless necessary)
4. **Types**: Import from `packages/shared/types/`

### Adding Backend Logic

1. **New Convex function**: Define in `packages/backend/convex/{queries,mutations,actions}/`
2. **Server-side API calls**: Use Convex actions (not direct client calls)
3. **Types**: Add to `packages/shared/types/api.ts` or create new file in `packages/backend/convex/`

### Adding a New Service/Scraper

1. **Module structure**: Create `packages/services/{scraper-name}/`
2. **Adapter pattern**: Export a class or function that adapts the scraper's API to a common interface
3. **Error handling**: Use `packages/services/shared/error-handler.ts` for consistent error recovery
4. **Tests**: Unit tests in `src/__tests__/` or `tests/`
5. **Integration**: Wire into `packages/services/orchestration/index.ts`

### Modifying the Data Model

1. **Schema change**: Update both Supabase schema + Convex schema in `packages/backend/convex/schema.ts`
2. **RLS policies**: Define in Supabase console or migrations (`supabase/migrations/`)
3. **Types**: Update `packages/shared/types/domain.ts`
4. **Backfill**: If new required field, write a migration script

### Async Workflows (Trigger.dev / Convex Workflows)

1. **Define workflow**: Create in `packages/backend/convex/orchestration/` (Convex Workflows) or link to Trigger.dev job
2. **Invoke**: Call from Convex mutation or action
3. **Monitor**: Logs available in Trigger.dev or Convex dashboard

---

## Deployment & Environments

| Environment | Frontend | Backend | Database | Status |
|---|---|---|---|---|
| **Dev** | Local `pnpm dev` | Convex local | Supabase local (optional) | Non-persistent |
| **Staging** | Vercel (staging branch) | Convex (staging) | Supabase staging | Preview URL |
| **Production** | Vercel (main branch) | Convex (prod) | Supabase prod | app.vanyshr.com |

**Branch conventions**:
- `dev/<feature>`: Feature branches (work in progress)
- `staging`: Staging environment (ready for preview/testing)
- `main`: Production (gated, requires review)

---

## Known Constraints & Decisions

1. **Scraper Fingerprinting**: Camoufox (WebGL renderer spoofing) is critical for FPS; without it, Cloudflare blocks requests. See memory: [[FPS fingerprint + IP strategy]].
2. **Residential Proxies**: FlameProxies residential pool + geo-matching provides best success rate (supersedes no-proxy strategy).
3. **Rate Limiting**: Adaptive batching (start 1, backoff on limits) + fallback scrapers (if FPS rate-limits, try ZabaSearch) are primary resilience strategies.
4. **No auto-loop**: Scrapers must not auto-retry in loops without operator approval. After each test/result, diagnose + propose, then STOP. See memory: [[Workflow: no auto-loop on scraper]].
5. **Backend choice**: Convex (confirmed choice) for orchestration; pivot to Trigger.dev only if observability wall hit. See CONVEX_MIGRATION.md in repo root.

---

## Troubleshooting & Debugging

### Search returns no results
1. Check scraper logs (Trigger.dev dashboard or Supabase scraper_logs table)
2. Likely causes: Rate limit, Cloudflare block, network error
3. Validate: Fingerprint still working? Proxy still rotating?

### Convex sync is stale
1. Check Convex dashboard → Logs
2. Restart Convex sync or check Supabase connection

### Performance degradation
1. Check Trigger.dev job duration (scraper calls should be <5s each)
2. Validate proxy/fingerprint overhead (should add <1s per call)

---

## Getting Help

- **For scraper-specific questions**: Check `packages/services/fps/README.md` or equivalent
- **For data model questions**: See Supabase schema editor + Convex schema.ts
- **For workflow questions**: See Trigger.dev dashboard or Convex orchestration logs
- **For architecture questions**: See this document + feature's CLAUDE.md

---

**For feature-specific context**, read the feature's `CLAUDE.md` in `feature_sbox/feature-{name}/`.
