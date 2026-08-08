# Vanyshr App — Holistic Context

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS v4 + Framer Motion
- **Backend**: Supabase (Postgres + Edge Functions in Deno)
- **Services**: Custom orchestration in `packages/services/` for scraper coordination
- **Monorepo**: pnpm + Turborepo
- **Authentication**: Supabase Auth (email/password, social SSO)
- **Deployment**: Vercel (production branch `main` → `app.vanyshr.com`)

### Directory Structure

```
Vanyshr-mono/
├── apps/
│   └── app/                    # Main React app (Vite)
│       ├── src/
│       │   ├── pages/          # Route pages (flows, dashboard, etc.)
│       │   ├── components/     # React components
│       │   ├── lib/            # Utilities (env, hooks, API clients)
│       │   └── styles/         # TailwindCSS config
│       ├── .env.local          # Local env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│       └── dist/               # Build output
│
├── packages/
│   ├── services/               # Service modules (scrapers, orchestration)
│   │   ├── fps/                # FastPeopleSearch integration
│   │   ├── zaba/               # ZabaSearch integration
│   │   ├── npd/                # NPD scraper (newly added)
│   │   ├── orchestration/      # Scraper sequence & coordination
│   │   └── ...
│   │
│   ├── ui/                     # Reusable UI components
│   │   └── src/components/     # Shared component library
│   │
│   └── shared/                 # Shared types & utilities
│       └── src/
│           ├── types/          # TypeScript types (User, SearchResult, etc.)
│           └── utils/          # Shared helpers
│
├── supabase/                   # Supabase schema, migrations, RLS policies
│   ├── migrations/             # Database migrations (.sql)
│   └── functions/              # Edge Functions (Deno)
│
└── feature_sbox/               # Feature sandboxes (this one: flow-pilot-scan)
```

### Database Schema (Key Tables)

- **users** — Supabase Auth + custom profile data
- **searches** — Search records with `flow_type` to distinguish pilot vs baseline
- **search_results** — Scraped results (FPS, ZabaSearch, NPD)
- **scraper_runs** — Individual scraper execution logs (status, duration, results)

**RLS Policy**: Uses `get_current_user_profile_id()` to enforce row-level access.
**Soft delete**: `is_active = false` pattern.

### Key Flows

#### 1. Search Orchestration (Baseline → Pilot variant)
```
User initiates search
  ↓
Determine flow_type (baseline vs. pilot)
  ↓
Call orchestration service with scraper sequence
  ↓
Parallel scraper execution:
  - FPS → results
  - ZabaSearch → results
  - [Pilot only] NPD → results
  ↓
Aggregate results + deduplicate
  ↓
Store in database
  ↓
Return to frontend + display in appropriate view
```

#### 2. Authentication & Authorization
- Supabase Auth (JWT) → Client session
- RLS policies enforce data isolation by user
- Service-role Edge Functions handle pre-auth writes

#### 3. Onboarding (Baseline → Pilot variant)
- Baseline: Current sequence of steps
- Pilot: Reorganized sequence (TBD per spec)

### Key Integration Points for pilot-scan

1. **Scraper Orchestration** (`packages/services/orchestration/`)
   - Add conditional logic: if `flow_type === 'pilot'`, include NPD in sequence
   - Handle NPD scraper results (schema compatibility, deduplication)

2. **Database Schema** (`supabase/migrations/`)
   - Add `flow_type` column to `searches` table (enum: 'baseline' | 'pilot')
   - Ensure NPD results fit `search_results` schema

3. **Frontend Routing** (`apps/app/src/pages/`)
   - Create or branch flow pages for pilot variant
   - Route selection: "Baseline Scan" vs. "Pilot Scan"

4. **New Views** (`apps/app/src/components/`)
   - Implement new result views (specific to pilot flow)
   - Reorganized onboarding UI

5. **Onboarding Sequence** (`apps/app/src/pages/`)
   - Reorganize onboarding steps per spec
   - Pilot-specific onboarding UX

### Existing Scraper Services

- **FPS (FastPeopleSearch)**: Primary people search; handles batching and rate limiting
- **ZabaSearch**: Secondary people search; fallback strategy
- **NPD** (newly added): Third scraper for enhanced coverage
- **Orchestration**: Coordinates all scrapers, deduplicates results, handles failures

### Conventions

- **Pre-auth writes**: Service-role Edge Functions, never client-side
- **RLS**: `get_current_user_profile_id()` function, not `auth.uid()` directly
- **Environment**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/app/.env.local`
- **Commit messages**: `<type>: <desc>` (feat/fix/chore/refactor/style/docs)
- **Branches**: `dev/<slug>` off `staging`; `staging` → `main` for production

---

**Last updated**: 2026-08-08
**For feature-specific context**, see the feature's `CLAUDE.md` in this sandbox.
