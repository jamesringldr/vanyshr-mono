# Intro-scan sequence rebuild — journal

**Worktree:** `/Users/jameso/DevWork/vanyshr-stack/vanyshr-backend-scrape-bugs`  
**Branch:** `dev/backend-scrape-bugs` (cut from production `main` @ `8314ac3`)  
**Date:** 2026-08-21  
**Dev server (this worktree):** http://localhost:5176/  
**Prod project:** `skhejbzrfptrusskuqoy`

---

## Why this exists

The old pilot-scan pipeline (two-tier Phase 1, client-side merge, email-before-full-profile) was inverted and then patched in place. Each patch raced the last. Decision: **leave the old pipeline running**, build a **new intro-scan sequence beside it**, wire the frontend only after the new path is proven, then delete the old tables/function.

This sequence is a **marketing / introduction funnel for non-subscribers**. A stranger types a few pieces of data and sees how much detailed personal information is already public. It has to be *their* person, fast enough not to bounce, no account required.

---

## Goal of the flow (locked)

1. Form: first name, last name, zip (city/state resolved **before** insert).
2. Zaba summaries → picker. User selects their profile if present. That pick is the reference for later full-profile URLs.
3. Match the pick against the other brokers’ summaries → full-profile URLs (Zaba has no per-person href; re-fetch the search page).
4. Four full-profile scrapes, including the pick.
5. Data in DB + UI.
6. Emails come from **full profiles**, not summaries. Empty list is allowed. Then confirm.
7. Enrichment (accounts/breaches) only against **confirmed** emails.

James will prescribe **one step at a time** (input / what runs / where it writes / what “done” looks like). Do **not** infer later steps. He presents frontend presentation + how a step feeds the next scrape; you pressure-test infrastructure (tables, FKs, clocks, IDs).

---

## What is live in production (new path)

### Table `quickscan.quickscans`

Migration: `supabase/migrations/20260821120000_intro_quickscans.sql` — **applied** to prod.

Parent row only. Created on form submit **before any scrape**. Old `quickscan.quick_scans` is untouched.

| Column | Role |
|---|---|
| `id` | uuid PK |
| `session_id` | defaults to `id::text` (one uuid in the browser) |
| `search_input` | jsonb `{first_name, last_name, zip, city, state}` — city/state already resolved |
| `summary_urls` | jsonb `{zaba, fps, npd, anywho}` — URLs built at insert, pages not fetched |
| `summary_result_counts` | jsonb counts only; result rows will be child tables |
| `profile_selected` | boolean, default false — **not** folded into status |
| `status` | pipeline; starts `created`; open text (no CHECK) |
| `deepest_page` | funnel **watermark** (farthest screen, never moves backwards). Starts `form` |
| `signup_status` | `in_progress` \| `abandoned` \| `report` \| `member`. Default `in_progress`. `member` wins over `report` |
| `visible_until` | UI access clock. **NULL until risk summary first loads** |
| `purge_after` | hard delete. Insert = `created_at + 7 days` |
| `time_sort` | America/Chicago `mm.dd.yy-hh.mm` for **eyeballing SQL**. **Do not ORDER BY this** — use `created_at` |
| `created_at` / `updated_at` | timestamptz. Frontend local time = `new Date(created_at).toLocaleString()` — **no local-time column** |

### Function `intro-scan`

Deployed, `verify_jwt = false`. CORS allows any `localhost`/`127.0.0.1` port plus `app.vanyshr.com` and `vanyshr-*.vercel.app`.

Inserts the parent row, builds `summary_urls`, returns `{ success, id, session_id, time_sort, purge_after, search_input, summary_urls }`.

### Frontend (partial)

`PilotEntryPage.handlePilotSubmit` calls `intro-scan` **first**, stores `pendingScanId` = that `id`, then still navigates into the **old** splash → loading → `pilot-scan` scrapers. New sequence has **not** taken over loading/picker.

Dev server for this worktree: **port 5176** (5173–5175 are other worktrees).

---

## Clocks (locked, not all wired yet)

Two clocks on `quickscans` only. Child PII dies with the parent.

| Moment | `visible_until` | `purge_after` |
|---|---|---|
| Form submit | NULL | `created_at + 7 days` |
| Risk summary first loads | `now() + 5 minutes` | unchanged |
| “Need more time” at 30s remaining | reset `now() + 5 minutes` | unchanged |
| Report emailed, no account | `now() + 5 days` (from the request), still capped by 7-day purge | unchanged |
| Bounce before summary | leave NULL | 7-day clock |
| Member: **successful copy** into `public.user_*` | — | set `purge_after = now()` so the reaper deletes this row |

30s popup is frontend math on `visible_until`. No extra column.

**Cascade rule:** every new child table **must** have `quickscans_id uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE`. Reaper: `DELETE FROM quickscan.quickscans WHERE purge_after <= now()`. Nested rows go with it. A child without that FK leaks.

`time_sort` on **every new table** as we add them (same Central format, same trigger pattern). Sort with `created_at`.

---

## What we are NOT doing yet

- No child tables for summary/full-profile results
- No Zaba (or any) scrape on the new path
- No picker rewrite against `quickscans`
- No emails/enrichment on the new path
- Do not put candidate lists or full profiles on `quickscans` itself
- Do not alter or purge old `quick_scans` / `pilot-scan`

---

## Where things stand (updated after the full-profile-scan + frontend wiring session)

The whole sequence got built and is live on `staging` (deployed via Vercel preview at
`vanyshr-git-staging-james-projects-9bdace54.vercel.app`, behind Vercel's own login —
sign in with the GitHub account that owns the project). Not on `main`/prod yet.

**Migrations (all applied to prod DB — schema is live regardless of which branch's
frontend is deployed):**
- `20260821130000_intro_scan_matching.sql` — `match_groups`, `summary_results`
- `20260821140000_full_profile_tables.sql` — `phones`, `addresses`, `relatives`,
  `aliases`, `emails`, `consolidated_profile`, `holehe_results`, `leakcheck_results`;
  dropped `full_profile_results`' wide columns
- `20260821150000_leakcheck_fields_exposed.sql` — `fields_exposed` on `leakcheck_results`

**Edge functions (deployed to prod, callable from staging's frontend):**
- `intro-scan` — parent row on submit (unchanged from before)
- `summary-scan` — 4-broker parallel scrape, Zaba → `full_profile_results` directly,
  FPS/NPD/AnyWho → `summary_results`, `DedupEngine.deduplicate()` → `match_groups`.
  Returns `zaba_candidates` for the picker modal. Writes `deepest_page` +
  `match_outcome='no_data'` when nothing came back from anywhere.
- `full-profile-scan` — accepts the picked `fullProfileResultId` inline, fetches
  FPS/NPD/AnyWho detail pages for the matched group, fans everything into the
  per-type tables, rebuilds `consolidated_profile`, returns it inline. Writes
  `match_outcome='matched'`, `deepest_page='full_profile'`.
- `manage-emails` — `add`/`remove` sync `consolidated_profile.emails` immediately;
  `confirm` runs real Holehe (hosted service on serv02, Docker + Tailscale Funnel,
  see `holehe-enricher.ts`) and Leakcheck (real public endpoint, see
  `leakcheck-enricher.ts`) against the confirmed set, writes `deepest_page='report'`.

**Frontend (`apps/app/src/pages/pilot-scan/`):**
- `entry.tsx` calls `intro-scan`, sets `pendingScanId` + `pilotScanFields` — this was
  sitting uncommitted the whole earlier session and caused a real "Missing scan
  fields" bug on staging until it got committed; watch for this class of drift
  (local worktree vs. what's actually committed) any time something works
  locally but not on a fresh clone/staging.
- `loading.tsx` — full phase machine (`searching → pick → full_profile → emails →
  report`) rewired to `summary-scan` / `full-profile-scan` / `manage-emails`.
  Email confirm hides the modal immediately on click (it has no loading state of
  its own and Holehe/Leakcheck aren't instant) rather than appearing frozen.
- `pre-profile.tsx` (new) — **temporary** landing spot after `report`, reads
  `consolidated_profile` from `sessionStorage` (key `pilotConsolidatedProfile`,
  written by `loading.tsx` right after `full-profile-scan` resolves). Real
  `risk-summary.tsx` still reads the *old* dedup-group/enrichment tables and
  hasn't been rewired — pre-profile is standing in for it on purpose.

**Known divergence trap, worth remembering:** staging has its own actively-changing
versions of some pilot-scan files (`scan-result.ts`, `email-confirmation.tsx`) from
parallel work on other branches. Twice now, code that type-checked fine locally
broke on staging because a helper it depended on had been renamed/removed there.
Type-check *on the staging worktree* (`Vanyshr-mono`), not just locally, before
trusting a merge — and run the actual `cd apps/app && pnpm build` Vercel uses, not
just `tsc --noEmit` (the latter has unrelated pre-existing `packages/ui` noise that
looks scary but doesn't block the real build).

---

## Open issues for next session (found live-testing on staging, not yet investigated)

**A) Duplicate `ja_studly@hotmail.com`.** Showed up twice in the email
confirm/pre-profile flow. Worth knowing before diving in: this exact email is the
one documented in `docs/scraper-testing-data/test-runs/HANDOFF_PROMPT.md` as the
sample case for the old AnyWho blur-truncation bug (`ja_studly@hotmail.com` →
`j@hotmail.com`) — that bug is supposedly fixed and regression-tested now, so if
what's showing up is the truncated fragment *next to* the full address, that's
actually the dedup design working as intended (raw provenance kept, not
collapsed — see `consolidation.ts`'s `upsertBrokerEmail` / the migration's own
reasoning for why duplicates are deliberately not silently merged). If instead it's
the *same full string* appearing twice, that's a real bug in the dedup query
(`quickscan.emails`, `duplicate_of` / `normalized_value` matching) or in how
`manage-emails`'s add/remove path talks to it. Check `quickscan.emails` for this
quickscan directly — `raw_value`, `normalized_value`, `duplicate_of` — before
guessing further.

**B) Pre-profile isn't showing everything — full scan data, Holehe, Leakcheck.**
Two known, already-diagnosed gaps, not yet fixed:
1. `pre-profile.tsx`'s `ConsolidatedProfile` interface and `convertToPreProfileData`
   never included `services_found`/`breaches`/`breach_count` at all — the page was
   ported from the old `/quick-scan/pre-profile`, which never showed that either.
   Needs those fields added to both the interface and a new card in the JSX.
2. **Timing bug, not just a missing field**: `loading.tsx` snapshots
   `consolidated_profile` into `sessionStorage` right when `full-profile-scan`
   resolves — *before* the user has even confirmed emails, let alone before
   Holehe/Leakcheck (triggered by `manage-emails`'s `confirm` action, which
   happens later) have run. So even once (1) is fixed, pre-profile would still
   show stale/empty enrichment data because it's reading a snapshot taken before
   that data existed. Fix needs `handleEmailsConfirmed` in `loading.tsx` to
   re-snapshot `consolidated_profile` (or fetch it fresh) *after* the `confirm`
   call resolves, not rely solely on the pre-confirm snapshot.
   Also worth checking whether any *other* full-profile data (phones/addresses/
   relatives beyond what's already showing) is missing for a reason beyond these
   two — hence "check the DB" first rather than assume it's only this.

---

## Next conversation

Pick up with A and B above. Both have a real DB row to inspect first — don't
guess from code reading alone, the fixture data plus a fresh test run through
staging will show exactly what's in `quickscan.emails` / `consolidated_profile`
/ `holehe_results` / `leakcheck_results` for a real scan.

---

## Old pipeline (reference only)

Still live: `pilot-scan` edge function, `quickscan.quick_scans` + dedup/enrichment, two-tier Zaba-fast / FPS+NPD+AnyWho-slow, client merge, email modal after Phase 2 (patched). Known pain: inverted sequence, CORS localhost ports, React hooks crash on risk-summary (fixed in this worktree), email dupes in the selector (mitigated in UI + write-path unique; not the new sequence).

Docs of the *intended* old rework (not fully built): `docs/SCAN_SEQUENCE.md`.

---

## How to work with James on this

- One step at a time. He is more reliable at step-by-step than end-to-end.
- Don’t infer missing steps.
- Don’t start scrapers until the parent row exists (it now does, on submit).
- New code lives beside the old; delete old only after the new path is validated.
- Production gate (`staging` → `main`) still requires an explicit yes. This worktree is a `dev/*` branch cut from `main`.
