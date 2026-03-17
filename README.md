# Vanyshr Monorepo

A modern, scalable monorepo for the Vanyshr platform — featuring the web application, shared services, and supporting infrastructure.

## Project Structure

```
vanyshr-mono/
├── apps/
│   └── app/                  # Main React web application
├── packages/
│   ├── shared/               # Shared types, constants, and utilities
│   ├── services/             # Business logic (scrapers, auth, database, email, etc.)
│   ├── ui/                   # Reusable component library
│   └── backend/              # Supabase functions and migrations (legacy)
├── supabase/                 # Supabase config, Edge Functions, and migrations
├── workers/                  # Cloudflare Workers (e.g. zabasearch-relay)
├── docs/                     # Project documentation
└── .github/
    └── workflows/            # CI/CD pipelines (GitHub Actions)
```

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0

Install pnpm globally:
```bash
npm install -g pnpm
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jamesringldr/vanyshr-mono.git
cd vanyshr-mono
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp apps/app/.env.example apps/app/.env.local
# Edit apps/app/.env.local with your Supabase URL and anon key
```

Required env vars in `apps/app/.env.local`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Development

Start the development server:
```bash
pnpm dev
```

Or run the app directly:
```bash
pnpm dev --filter @vanyshr/app
```

### Build

```bash
pnpm build
```

Or build a specific package:
```bash
pnpm build --filter @vanyshr/app
```

### Linting & Type Checking

```bash
pnpm lint
pnpm type-check
```

### Format Code

```bash
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

## Package Details

### `apps/app`
Main product web application.
- **Port:** 5173 (dev)
- **Tech:** Vite, React 19, React Router, TailwindCSS v4, Framer Motion
- **Dependencies:** `@vanyshr/shared`, `@vanyshr/services`, `@vanyshr/ui`

### `packages/shared`
Shared types, constants, and utilities used across all packages.
- **Exports:** types, constants, utils
- **Purpose:** No business logic — only types and pure utilities

### `packages/services`
Business logic layer with scrapers, auth, database, and email services.
- **Modules:** scrapers, auth, database, email
- **Dependencies:** `@vanyshr/shared`, `@supabase/supabase-js`, axios

### `packages/ui`
Reusable React component library shared across the app.
- **Purpose:** Shared UI components and design system primitives

### `packages/backend`
Legacy Supabase functions and migrations package.

### `supabase/`
Active Supabase configuration, Edge Functions (Deno), and database migrations.
- All pre-auth DB writes go through service-role Edge Functions — never direct from client
- RLS uses `get_current_user_profile_id()`, not `auth.uid()` directly

### `workers/`
Cloudflare Workers for auxiliary services (e.g. `zabasearch-relay` for scraping relay).

## Build Tool & Configuration

- **Turbo** — Build orchestration & caching
- **pnpm** — Package manager with workspace support
- **TypeScript** — Static type checking
- **ESLint** — Code linting
- **Prettier** — Code formatting
- **Vite** — Frontend build tool

### Path Aliases

```typescript
import { User } from '@vanyshr/shared/types';
```

## Turbo Commands

```bash
turbo run dev          # Run dev servers
turbo run build        # Build all packages
turbo run lint         # Lint all packages
turbo run type-check   # Type-check all packages
```

With filtering:
```bash
turbo run build --filter @vanyshr/app
```

## Dependency Graph

```
@vanyshr/shared ← Core (no internal dependencies)
    ↓
@vanyshr/ui (depends on: shared)
    ↓
@vanyshr/services (depends on: shared)
    ↓
@vanyshr/app (depends on: shared, services, ui)
@vanyshr/backend (depends on: shared, services)
```

No circular dependencies — lower-level packages must not depend on higher-level ones.

## Deployment

### Web App (Vercel)
- **Production:** `main` → `app.vanyshr.com`
- **Preview:** `sandbox`, `dev/*` → Vercel preview URLs
- Build command: `cd apps/app && pnpm build`
- Output directory: `apps/app/dist`

See `docs/CICD.md` for the full CI/CD protocol.

### Supabase Edge Functions
```bash
supabase functions deploy <function-name>
```

### Cloudflare Workers
```bash
cd workers/zabasearch-relay
wrangler deploy
```

## Documentation

See `/docs` for detailed documentation:
- `CICD.md` — CI/CD procedures
- `ARCHITECTURE.md` — System design
- `DESIGN_SYSTEM.md` — Design system reference
- `schema.md` — Database schema

## Maintenance

```bash
pnpm clean    # Clear build artifacts
pnpm update   # Update dependencies
```

## License

[Your License Here]

## Troubleshooting

**"Package not found" errors:**
- Run `pnpm install` to ensure all dependencies are installed
- Check that path aliases in `tsconfig.json` match your package structure

**Turbo cache issues:**
- Run `pnpm clean` to clear build artifacts and reinstall

**TypeScript errors:**
- Run `pnpm type-check` to verify types
- Ensure each package has a `tsconfig.json` extending the root config

**Env vars not loading:**
- Env vars must be in `apps/app/.env.local` — `envDir` is not overridden in `vite.config`

---

For more information, see the documentation in `/docs`.
