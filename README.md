# Vanyshr Monorepo

A modern, scalable monorepo for the Vanyshr platform - featuring a web application, landing page, and shared services layer.

## 📦 Project Structure

```
vanyshr-mono/
├── apps/
│   ├── app/                  # Main React web application
│   └── landing/              # Marketing landing page
├── packages/
│   ├── shared/               # Shared types, constants, and utilities
│   ├── services/             # Business logic (scrapers, auth, database, email, etc.)
│   ├── ui/                   # Reusable component library
│   └── backend/              # Supabase functions and migrations
├── .github/
│   └── workflows/            # CI/CD pipelines (GitHub Actions)
├── docs/                     # Project documentation
└── scripts/                  # Utility scripts
```

## 🚀 Quick Start

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
git clone <repository-url>
cd vanyshr-mono
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Development

Start development servers for all apps in parallel:
```bash
pnpm dev
```

Or run specific apps:
```bash
pnpm dev --filter @vanyshr/app
pnpm dev --filter @vanyshr/website
```

### Build

Build all packages and apps:
```bash
pnpm build
```

Or build specific packages:
```bash
pnpm build --filter @vanyshr/app
pnpm build --filter @vanyshr/services
```

### Linting & Type Checking

```bash
pnpm lint          # Run ESLint across all packages
pnpm type-check    # Run TypeScript type checking
```

### Format Code

```bash
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

## 📁 Package Details

### `apps/app`
Main product web application built with Vite + React + TypeScript.
- **Port:** 5173 (dev)
- **Tech:** Vite, React 19, React Router, MUI, Framer Motion
- **Dependencies:** `@vanyshr/shared`, `@vanyshr/services`, `@vanyshr/ui`

### `apps/website`
Marketing landing page built with Vite + React + TypeScript.
- **Port:** 5174 (dev)
- **Tech:** Vite, React 19, React Router, Lucide, Framer Motion
- **Dependencies:** `@vanyshr/shared`, `@vanyshr/ui`

### `packages/shared`
Shared types, constants, and utilities used across all packages.
- **Exports:** types, constants, utils
- **Dependencies:** zod (for type safety)
- **Purpose:** No business logic, only types and pure utilities

### `packages/services`
Business logic layer with scrapers, auth, database, and email services.
- **Modules:** scrapers, auth, database, email, gemini
- **Dependencies:** `@vanyshr/shared`, @supabase/supabase-js, axios
- **Purpose:** Used by both frontend and backend

### `packages/backend`
Supabase functions and migrations.
- **Structure:** functions/, migrations/
- **Dependencies:** `@vanyshr/shared`, `@vanyshr/services`
- **Scripts:** `functions:serve`, `functions:deploy`

### `packages/ui`
Reusable React component library (currently minimal, grows over time).
- **Purpose:** Shared components for web and landing apps
- **Dependencies:** React (peer dependency)
- **Future:** Will integrate design system components

## 🛠 Build Tool & Configuration

This monorepo uses:
- **Turbo** — Build orchestration & caching
- **pnpm** — Package manager with workspace support
- **TypeScript** — Static type checking
- **ESLint** — Code linting
- **Prettier** — Code formatting
- **Vite** — Frontend build tool (both apps)

### Path Aliases

Import packages using workspace aliases:
```typescript
// Instead of relative imports:
import { User } from '../../../packages/shared/src/types';

// Use absolute aliases:
import { User } from '@vanyshr/shared/types';
```

## 🔧 Turbo Commands

Turbo orchestrates tasks across all packages:

```bash
turbo run dev          # Run dev in all packages that have it
turbo run build        # Build all packages (respects dependencies)
turbo run lint         # Lint all packages
turbo run type-check   # Type-check all packages
turbo run test         # Run tests
```

With filtering:
```bash
turbo run build --filter @vanyshr/app
turbo run lint --filter @vanyshr/shared
```

## 📝 Dependency Graph

```
@vanyshr/shared ← Core (no internal dependencies)
    ↓
@vanyshr/ui (depends on: shared)
    ↓
@vanyshr/services (depends on: shared)
    ↓
@vanyshr/app (depends on: shared, services, ui)
@vanyshr/website (depends on: shared, ui)
@vanyshr/backend (depends on: shared, services)
```

**Rule:** No circular dependencies. Ensure lower-level packages don't depend on higher-level ones.

## 🚀 Deployment

### Web App
```bash
pnpm build --filter @vanyshr/app
# Deploy dist/ folder to CDN or server
```

### Landing Page
```bash
pnpm build --filter @vanyshr/website
# Deploy dist/ folder to CDN
```

### Supabase Functions
```bash
cd packages/backend
pnpm functions:deploy
```

## 📚 Documentation

See `/docs` for detailed documentation:
- `ARCHITECTURE.md` — System design and package responsibilities
- `SETUP.md` — Detailed setup instructions
- `DEPLOYMENT.md` — Deployment procedures
- `SCRAPER_IMPLEMENTATION.md` — Scraper architecture and usage

## 🧹 Maintenance

### Clean Build Artifacts
```bash
pnpm clean
```

### Update Dependencies
```bash
pnpm update
```

### Lock File
The `pnpm-lock.yaml` file tracks exact versions. Commit it to version control.

## 🤝 Contributing

1. Create a feature branch
2. Make changes respecting the monorepo structure
3. Run `pnpm lint` and `pnpm type-check` before committing
4. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Troubleshooting

**"Package not found" errors:**
- Run `pnpm install` to ensure all dependencies are installed
- Check that path aliases in `tsconfig.json` match your package structure

**Turbo cache issues:**
- Run `pnpm clean` to clear build artifacts
- Delete `.turbo` folder and `pnpm-lock.yaml`, then reinstall

**TypeScript errors:**
- Run `pnpm type-check` to verify types
- Ensure each package has a `tsconfig.json` extending the root config

---

For more information, see the documentation in `/docs`.
