# Vanyshr CI/CD Protocol

## Branch Structure

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code only | `app.vanyshr.com` (production) |
| `sandbox` | Active development, freely push here | Vercel preview URL |
| `dev/<issue-name>` | Isolated work on a specific feature or fix | Vercel preview URL |

## Day-to-Day Workflow

### Normal development
```bash
# Make sure you're on sandbox
git checkout sandbox

# Do your work, then commit
git add <files>
git commit -m "description of change"
git push origin sandbox
```

### Isolating a specific feature or fix
```bash
# Branch off sandbox (not main)
git checkout sandbox
git checkout -b dev/issue-name

# Work, commit, push
git push origin dev/issue-name

# When done, merge back into sandbox
git checkout sandbox
git merge dev/issue-name
git push origin sandbox

# Delete the dev branch
git branch -d dev/issue-name
git push origin --delete dev/issue-name
```

### Promoting to production
```bash
# Only when sandbox is clean and tested
git checkout main
git merge sandbox
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

- **Never commit directly to `main`** — always merge from `sandbox`
- **Never force push to `main`**
- **`dev/*` branches always branch from `sandbox`**, not `main`
- **Test on the Vercel preview URL** before merging `sandbox` → `main`
- **Never commit `.env.local`** or any file containing secrets

## Vercel Deployment Behavior

| Branch | Deployment Type | URL |
|--------|----------------|-----|
| `main` | Production | `app.vanyshr.com` |
| `sandbox` | Preview | `vanyshr-git-sandbox-james-projects-9bdace54.vercel.app` |
| `dev/*` | Preview | unique per-branch Vercel URL |

Preview deployments are created automatically on every push. Check the Vercel dashboard or GitHub PR for the preview URL.

## Environment Variables

- Local: `apps/app/.env.local` (never committed)
- Production/Preview: set in Vercel dashboard under **Settings → Environment Variables**
- Required vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
