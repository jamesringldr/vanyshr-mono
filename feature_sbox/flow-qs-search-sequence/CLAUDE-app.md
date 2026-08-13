# Vanyshr App — Holistic Context

## Architecture Overview

### Tech Stack
- **Frontend**: React + Vite + TypeScript + TailwindCSS v4 + Framer Motion
- **Backend**: Supabase (Postgres + Edge Functions in Deno)
- **Monorepo**: pnpm + Turborepo
  - `apps/app/`: Consumer React app
  - `packages/ui/`: Reusable UI components
  - `packages/services/`: Service modules (people search, orchestration, etc.)
- **Search Integration**: Multiple scrapers (FPS, ZabaSearch, AnyWho) coordinated via orchestration service
- **Authentication**: Supabase Auth (email/password, social)

### Directory Structure
```
Vanyshr-mono/
├── apps/app/                          # Main React + Vite app
│   ├── src/
│   │   ├── pages/                     # Routes (search, results, profile, etc.)
│   │   ├── components/                # React components (reusable & page-specific)
│   │   ├── lib/                       # Utilities (env, hooks, API clients)
│   │   └── App.tsx                    # Root component
│   ├── vite.config.ts                 # Vite config (reads env from apps/app/.env.local)
│   └── dist/                          # Build output (Vercel deploys this)
│
├── packages/
│   ├── ui/                            # Shared UI components (exported as package)
│   ├── services/                      # Service modules
│   │   ├── fps/                       # FastPeopleSearch integration
│   │   ├── zaba/                      # ZabaSearch integration
│   │   ├── orchestration/             # Search orchestration (workflow coordination)
│   │   └── ... (other services)
│   └── shared/                        # Shared types, utilities, constants
│
├── supabase/                          # Supabase (database, RLS policies, migrations)
│   ├── migrations/                    # SQL migrations
│   └── functions/                     # Edge Functions (Deno)
│
├── CLAUDE.md                          # Project-level instructions
└── feature_sbox/                      # Feature sandboxes (isolation for feature work)
```

### Key Flows

#### 1. Search Orchestration
```
User Input (query, filters)
    ↓
Trigger.dev Workflow (or Edge Function)
    ↓
Parallel API calls (FPS, ZabaSearch, AnyWho)
    ↓
Result aggregation & deduplication
    ↓
Rank & present results → Frontend
```

#### 2. Authentication
```
User login (email/social)
    ↓
Supabase Auth (JWT issued)
    ↓
Client stores JWT → requests to Edge Functions
    ↓
RLS policies enforce data isolation (uses get_current_user_profile_id())
```

#### 3. Rate Limiting & Resilience
- Adaptive batching for high-volume queries
- Fallback sources if primary scraper fails
- Proxy rotation per scraper strategy
- Exponential backoff for retries

### Integration Points for New Features

| Feature Type | Where to Add | Key Files |
|---|---|---|
| **UI changes** | Frontend components | `apps/app/src/pages/`, `apps/app/src/components/` |
| **New scraper/service** | Service module | `packages/services/<name>/` |
| **Data model changes** | Supabase schema + RLS | `supabase/migrations/`, `.sql` files |
| **Async workflows** | Orchestration logic | `packages/services/orchestration/` or Trigger.dev |
| **Shared utilities/types** | Export from packages | `packages/shared/` |

### QS Search Sequence Flow (Current)
The quickscan search flow runs through:
1. **User enters query** → `apps/app/src/pages/search` (or similar)
2. **Frontend calls orchestration** → `packages/services/orchestration/`
3. **Orchestration coordinates scrapers** → Parallel API calls to FPS, ZabaSearch, etc.
4. **Results aggregated & returned** → Frontend displays in `apps/app/src/components/`
5. **User clicks result** → Navigate to detail page or action

**Current friction points** (to be validated):
- Multiple steps in result selection
- Unclear result formatting
- Possible latency in display

**Optimization target**: Reduce steps, clarify presentation, improve UX flow.

---

## Environment & Deployment

### Local Development
```bash
pnpm install                          # Install dependencies (all packages)
pnpm dev                              # Run dev server (apps/app Vite dev)
pnpm test                             # Run tests (all packages)
```

### Deployment
- **Consumer** (`apps/app`): Vercel, branch → `app.vanyshr.com` (main), preview (dev/*, staging)
- **Supabase**: Cloud-hosted; migrations auto-apply on deploy
- **Build**: `cd apps/app && pnpm build` → output to `apps/app/dist`

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL (public, safe for client)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key (public, safe for client)
- Store in `apps/app/.env.local` (not committed)

---

## Key Conventions & Best Practices

### Database
- **RLS**: Use `get_current_user_profile_id()` instead of `auth.uid()` directly
- **Soft deletes**: Mark inactive records with `is_active = false` instead of deleting
- **Service role**: Edge Functions use service role for pre-auth writes; client uses anon key

### Frontend
- **Component structure**: Keep page components in `pages/`, reusable components in `components/`
- **Styling**: TailwindCSS v4 + Framer Motion for animations
- **Type safety**: Export types from `packages/shared/` for cross-package consistency

### API & Services
- **Service modules**: Each scraper/service lives in `packages/services/<name>/`
- **Exports**: Export main functions/types from service index file for clean imports
- **Error handling**: Consistent error shape across all services (for aggregation layer)

---

**Last updated**: 2026-08-08  
**For feature-specific context**, see the feature's `CLAUDE.md`.
