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

## Next conversation (paused here)

James is about to specify **scraping**: how it should look on the frontend, and how a result feeds the next scrape. He wants **infrastructure design feedback** (tables, writes, IDs, clocks) — not code — until he says go.

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
