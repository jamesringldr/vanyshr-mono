# Vanyshr CI/CD Protocol

## Branch Structure

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code only | `app.vanyshr.com` (production) |
| `staging` | Staging / pre-production integration; push tested work here | Vercel preview URL |
| `dev/<issue-name>` | Isolated work on a specific feature or fix | Vercel preview URL |

## Day-to-Day Workflow

### Normal development
```bash
# Make sure you're on staging
git checkout staging

# Do your work, then commit
git add <files>
git commit -m "description of change"
git push origin staging
```

### Isolating a specific feature or fix
```bash
# Branch off staging (not main)
git checkout staging
git checkout -b dev/issue-name

# Work, commit, push
git push origin dev/issue-name

# When done, merge back into staging
git checkout staging
git merge dev/issue-name
git push origin staging

# Delete the dev branch
git branch -d dev/issue-name
git push origin --delete dev/issue-name
```

### Promoting to production
```bash
# Only when staging is clean and tested
git checkout main
git merge staging
git push origin main
```
This triggers an automatic redeploy to `app.vanyshr.com`.

## Commit Message Format

```
<type>: <short description>

[optional body]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `chore` — dependency updates, config changes, cleanup
- `refactor` — code restructure, no behavior change
- `style` — UI/CSS only changes
- `docs` — documentation only

**Examples:**
```
feat: add phone number confirmation to onboarding
fix: resolve 404 on direct route navigation
chore: update framer-motion to 12.29
style: update dashboard card spacing
```

## Rules

- **Never commit directly to `main`** — always merge from `staging`
- **Never force push to `main`**
- **`dev/*` branches always branch from `staging`**, not `main`
- **Test on the Vercel preview URL** before merging `staging` → `main`
- **Never commit `.env.local`** or any file containing secrets

## Vercel Deployment Behavior

| Branch | Deployment Type | URL |
|--------|----------------|-----|
| `main` | Production | `app.vanyshr.com` |
| `staging` | Preview | `vanyshr-git-staging-james-projects-9bdace54.vercel.app` |
| `dev/*` | Preview | unique per-branch Vercel URL |

Preview deployments are created automatically on every push. Check the Vercel dashboard or GitHub PR for the preview URL.

## Supabase Functions Deployment

`.github/workflows/deploy-functions.yml` deploys `supabase/functions` on push to `main`,
scoped to changes under `supabase/functions/**` or `supabase/config.toml` — a UI-only push
can't trigger it and vice versa. It runs the Deno suite first and stops if that fails, so a
red test never reaches production. `workflow_dispatch` allows a manual re-run.

Requires the `SUPABASE_ACCESS_TOKEN` repository secret:

```bash
gh secret set SUPABASE_ACCESS_TOKEN --repo jamesringldr/vanyshr-mono
```

Two things to know before changing it:

- **`verify_jwt` comes from `supabase/config.toml`, and the default is `true`.** Every
  pre-auth function must have a `[functions.<name>]` block declaring `verify_jwt = false`.
  A pre-auth function that isn't declared there will 401 for logged-out users — which is
  every quickscan — from the next deploy onward.
- **The workflow deliberately does not pass `--prune`.** Some functions exist in the
  Supabase project but not in this repo (`admin-users`, `recon-probe`, `recon-report`,
  `removal-enqueue`, from `vanyshr-admin` or deployed by hand). `--prune` would delete them.

Cloudflare Workers under `workers/` are a separate target and are not deployed by this
workflow.

After deploying, the workflow reads the project back and fails unless every function was
updated by that run (`.github/scripts/verify_deploy.py`) — an exit code alone is a claim,
not evidence.

## Guardrails

| Workflow | When | What it does |
|---|---|---|
| `test.yml` → `no-stub-jobs` | every push | Fails if any workflow job's only steps are `echo`. Both workflows here were echo stubs from 2026-01-31 to 2026-08-26, reporting green on every merge while doing nothing. |
| `drift-check.yml` | nightly 09:17 UTC | Compares production functions against `main` — flags function changes committed but never deployed, and functions deployed outside CI. Opens a `drift`-labelled issue. |
| `prune-branches.yml` | Mondays 10:23 UTC | Deletes `dev/*` branches fully merged into `main` and untouched for 7+ days. `delete_branch_on_merge` only fires on PR merges, and work here lands by direct push. |

Both scheduled workflows accept `workflow_dispatch`; `prune-branches` defaults to a dry run
when triggered manually.

## Environment Variables

- Local: `apps/app/.env.local` (never committed)
- Production/Preview: set in Vercel dashboard under **Settings → Environment Variables**
- Required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Admin UI: private repo `vanyshr-admin` — see `docs/ADMIN_APP.md`

## Staging deploy check

Pushes to `staging` should produce a successful Vercel preview deployment. Confirm in the Vercel dashboard under **Deployments** (branch: `staging`).
