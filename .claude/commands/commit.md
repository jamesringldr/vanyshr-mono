# Vanyshr — Commit & Ship

Run this workflow every time the user types `/commit`:

## Step 1 — Verify branch

Run `git branch --show-current`. If the result is NOT `sandbox`, stop and tell the user which branch we're on and ask them to confirm before proceeding. Do NOT continue if on `main`.

## Step 2 — Inspect changes

Run these in parallel:
- `git status`
- `git diff` (staged + unstaged)

Summarize what has changed in plain English (files touched, rough nature of the change).

While reviewing the diff, mentally note any **README candidates** and **schema candidates** separately.

**README-worthy signals** (affects documented architecture or setup):
- New routes registered in `App.tsx`
- New Edge Functions added under `supabase/functions/`
- New database tables or significant schema changes (new migrations)
- New environment variables required
- New external services or integrations (third-party APIs, workers, scrapers)
- Significant architectural shifts (e.g. a service moving from client-side to edge)

**Schema doc (`docs/schema.md`) — worthy signals** (any migration that touches the DB surface):
- New tables created
- Columns added or removed from existing tables
- CHECK constraint values changed (e.g. new `source` enum values)
- New DB functions created (`CREATE FUNCTION`)
- New indexes added that are architecturally significant
- RLS policies added or changed
- Status lifecycle changes (new status values on any table)

Do NOT flag for either doc: UI/style changes, copy tweaks, bug fixes, internal refactors, nav redesigns, or anything that doesn't change the system's external surface area, setup requirements, or database structure.

## Step 3 — Stage and commit

- Stage only the modified tracked files by name — never use `git add -A` or `git add .`
- Do NOT stage: `.env.local`, `pnpm-lock.yaml`, `dist/`, `.turbo/`
- Draft a commit message following the project format:
  ```
  <type>: <short description>
  ```
  Valid types: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`
- Commit using a HEREDOC to preserve formatting. Append the Co-Authored-By trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Push to `origin sandbox`

## Step 4 — Confirm success

Run `git status` and `git log -1 --oneline` to confirm the commit landed and the working tree is clean. Show the user the commit hash and message.

## Step 5 — Docs review (before promotion)

Read `README.md` and `docs/schema.md` in parallel. Based on what you noted in Step 2:

- **If there are README or schema candidates:** describe the specific proposed edits for each file (what section, what would change or be added). Present them together, then ask:

  > I have suggested doc updates above. Confirm edits and promote to production, or let me know if you'd like to adjust anything first.

  - If the user **confirms**: make all edits, commit them together as `docs: update README and schema` (or just the relevant file name if only one changed) — single separate commit on sandbox, pushed to origin — then run the promotion sequence.
  - If the user **wants changes first**: hold. Wait for their edits or instructions, then proceed.

- **If there are no doc candidates:** skip straight to asking:

  > Ready to promote to production? This will merge `sandbox` → `main` and trigger a redeploy to `app.vanyshr.com`.

  - If **yes / y / sure / go / ship it** (or similar affirmative): run the promotion sequence.
  - If **no / not yet / wait** (or anything else): stop and confirm you'll hold off.

## Promotion sequence

```bash
git checkout main
git merge sandbox --no-ff -m "chore: promote sandbox to production"
git push origin main
git checkout sandbox
```

After pushing, confirm with the commit hash on `main` and the production URL: `app.vanyshr.com`.
