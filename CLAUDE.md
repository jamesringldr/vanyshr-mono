# Vanyshr — Claude Code Instructions

## Git Workflow (STRICT — always follow this)

### Branch rules
- `main` — production only. NEVER commit directly to main. NEVER force push to main.
- `sandbox` — active development branch. Default branch for all work.
- `dev/<issue-name>` — isolated feature/fix branches. Always branch from `sandbox`, not `main`.

### Before any git operation, confirm the current branch
- If on `main`, stop and switch to `sandbox` before making changes
- If asked to commit, always confirm which branch we're on first

### Commit message format
```
<type>: <short description>
```
Types: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`

### Merging to production
Only merge `sandbox` → `main` when explicitly instructed by the user. Never suggest or initiate this automatically.

### Never commit
- `.env.local` or any file containing secrets
- `pnpm-lock.yaml` (it is gitignored intentionally for now)
- Build output (`dist/`, `.turbo/`)

## Stack
- React + Vite + TypeScript + TailwindCSS v4 + Framer Motion
- Supabase (Postgres + Edge Functions in Deno)
- Monorepo: `apps/app` (frontend), `packages/ui` (shared components), `supabase/`
- Package manager: pnpm + Turborepo

## Key Conventions
- All pre-auth DB writes go through service-role Edge Functions, never direct from client
- RLS uses `get_current_user_profile_id()` — not `auth.uid()` directly
- Soft delete: `is_active = false`
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/app/.env.local`
- `envDir` is NOT set in vite.config — Vite reads from `apps/app/` by default

## Vercel Deployment
- Production branch: `main` → `app.vanyshr.com`
- Preview branches: `sandbox`, `dev/*` → Vercel preview URLs
- Build command: `cd apps/app && pnpm build`
- Output directory: `apps/app/dist`
- Root directory: `./` (monorepo root, so pnpm resolves workspace deps)

## Reference
- Full CI/CD protocol: `docs/CICD.md`
- Project memory: see auto-memory files
