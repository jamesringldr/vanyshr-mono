# Vanyshr — Claude Code Instructions

## Git Workflow (STRICT — always follow this)

### Branch rules
- `main` — production only. NEVER commit directly to main. NEVER force push to main.
- `staging` — staging / pre-production integration branch. Default branch for all work.
- `dev/<issue-name>` — isolated feature/fix branches. Always branch from `staging`, not `main`.

### Before any git operation, confirm the current branch
- If on `main`, stop and switch to `staging` before making changes
- If asked to commit, always confirm which branch we're on first

### Pre-commit branch gate (enforced by git hook, not just convention)
Every git repo on this machine is gated by a global `~/.githooks/pre-commit`
hook (`git config --global core.hooksPath ~/.githooks` — see `~/.claude/CLAUDE.md`
for the full rationale). It blocks every commit until the current branch is
confirmed, regardless of how the commit is invoked (terminal, IDE, Claude Code).
Interactive terminals get a `y/N` prompt; non-interactive commits (Claude Code's
Bash tool has no TTY) require `GITDADDY_CONFIRM=<branch>` set to the current
branch name, obtained by confirming with the user first — see the `gitdaddy`
skill. This is machine-global, not repo-specific — nothing to set up per clone.

### Commit message format
```
<type>: <short description>
```
Types: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`

### Merging to production
Only merge `staging` → `main` when explicitly instructed by the user. Never suggest or initiate this automatically.

### Never commit
- `.env.local` or any file containing secrets
- `pnpm-lock.yaml` (it is gitignored intentionally for now)
- Build output (`dist/`, `.turbo/`)

## Stack
- React + Vite + TypeScript + TailwindCSS v4 + Framer Motion
- Supabase (Postgres + Edge Functions in Deno)
- Monorepo: `apps/app` (consumer), `packages/ui`, `supabase/` — admin UI is private repo `vanyshr-admin` (see `docs/ADMIN_APP.md`)
- Package manager: pnpm + Turborepo

## Key Conventions
- All pre-auth DB writes go through service-role Edge Functions, never direct from client
- RLS uses `get_current_user_profile_id()` — not `auth.uid()` directly
- Soft delete: `is_active = false`
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/app/.env.local`
- `envDir` is NOT set in vite.config — Vite reads from `apps/app/` by default

## Vercel Deployment
- **Consumer** (`apps/app`): production branch `main` → `app.vanyshr.com`
- **Admin**: private repo `vanyshr-admin` → `admin.vanyshr.com` (not in this public mono)
- Preview branches: `staging`, `dev/*` → Vercel preview URLs
- Build command: `cd apps/app && pnpm build`
- Output directory: `apps/app/dist`
- Root directory: `./` (monorepo root, so pnpm resolves workspace deps)

## Design

Read `docs/DESIGN.md` BEFORE writing or editing ANY UI code. No exceptions. Read DESIGN.md §12 before importing ANY component.
If that file does not exist, STOP — do not proceed with styling.

Hard rules:
- No raw hex, rgb(), or rgba() in component files — use `packages/ui/src/styles/tokens.css` custom props.
- No arbitrary px values for spacing — use the space scale (DESIGN.md 4).
- No font families not named in DESIGN.md 3.
- No `style={{ }}` with color or spacing values — use className and tokens.
- Chrome from Konsta, content from shadcn/Radix, charts from the viz library — never cross the §12 boundary.
- One icon package: `lucide-react`. No phosphor, no heroicons, no emoji-as-icons.
- Konsta owns all screen overlays (sheets, action sheets, modals). Never nest a Radix overlay inside a Konsta overlay or vice versa.
- Never assign Konsta `--k-*` vars or shadcn theme vars in component files — they are generated from tokens.css.
- Touch targets ≥ 44px. Respect safe-area insets on fixed chrome (tab bar, navbar, sheets).
- When a component exists in `docs/COMPONENTS.md`, use it. Do not reinvent.
- When ambiguous, STOP and ask. Do not make a design decision independently.

Token file: `packages/ui/src/styles/tokens.css`
Component catalog: `docs/COMPONENTS.md`

## Reference
- Full CI/CD protocol: `docs/CICD.md`
- Project memory: see auto-memory files
