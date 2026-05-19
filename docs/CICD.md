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

## Environment Variables

- Local: `apps/app/.env.local` (never committed)
- Production/Preview: set in Vercel dashboard under **Settings → Environment Variables**
- Required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Staging deploy check

Pushes to `staging` should produce a successful Vercel preview deployment. Confirm in the Vercel dashboard under **Deployments** (branch: `staging`).
