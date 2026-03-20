# Code Review Punchlist
> Cross-referenced against codebase — March 20, 2026
> Sources: G Response.md, CU Response.md, CL Response.md

---

## P0 — Production Breaking

### ~~1. `create_pending_profile` (2-arg) writes `pending_auth` instead of `pending_user`~~ ✅ RESOLVED
- **File:** `supabase/migrations/20260314_normalize_profile_on_creation.sql:44`
- **Sources:** G, CU
- **Critical:** Yes
- **Fix:** `supabase/migrations/20260320_fix_pending_profile_status.sql` — `CREATE OR REPLACE` the 2-arg function with `signup_status = 'pending_user'`. Also drops the dead 1-arg overload (see #5). Apply migration to resolve.

---

### 2. `validate_access_code` returns `{ success: true }` when profile status UPDATE hits 0 rows — no `FOUND` check
- **File:** `supabase/migrations/20260318_beta_access.sql:303–313`
- **Sources:** G (implied), confirmed in code
- **Critical:** Yes
- **Notes:** `use_count` is incremented and the function returns success even when the profile was in the wrong state (issue #1). Codes get consumed, profile status never advances, and the client redirects to `/signup` with a stale profile.

---

### 3. `scanId ?? profile.id` falls back to synthetic `aw-*` IDs when `scan_id` is null
- **File:** `apps/app/src/pages/scan/quick-scan.tsx:15`
- **Source:** CU
- **Critical:** Yes
- **Notes:** If `quick_scans` INSERT fails or `universal-search` returns `scan_id: null`, navigation sends `aw-0` etc. to `pre-profile/:scanId`. `create-pending-profile` tries to query `quick_scans WHERE id = 'aw-0'` as a UUID → Postgres cast error → 500. The beta flow made this a hard crash instead of a deferred failure.

---

## P1 — Important

### 4. `validate_access_code` race condition: check and increment are non-atomic
- **File:** `supabase/migrations/20260318_beta_access.sql:293–301`
- **Source:** CL
- **Critical:** Yes (for limited codes)
- **Notes:** Two concurrent submissions of a `max_uses = 1` code can both pass the `use_count >= max_uses` check before either increments. No impact for unlimited shared codes; real double-spend for user-specific (Option B) codes. Fix: atomic `UPDATE … WHERE use_count < max_uses RETURNING id`.

---

### ~~5. Dead 1-arg `create_pending_profile(UUID)` overload lives alongside the canonical 2-arg version~~ ✅ RESOLVED (bundled with #1)
- **File:** `supabase/migrations/20260318_beta_access.sql:57`
- **Sources:** G, CU
- **Critical:** No
- **Fix:** `supabase/migrations/20260320_fix_pending_profile_status.sql` — `DROP FUNCTION IF EXISTS public.create_pending_profile(UUID)` before the `CREATE OR REPLACE`.

---

### 6. `universal-search` ping check is correct in code — console 400s are a deploy skew issue
- **File:** `supabase/functions/universal-search/index.ts:62–66`
- **Sources:** G, CU
- **Critical:** No
- **Notes:** Ping intercepts correctly before the `!firstName || !lastName` guard. The observed 400s on mount come from an older deployed bundle without the ping branch. Resolved on redeploy. Residual: the client fire-and-forgets the ping — errors are silent in logs but appear in the console.

---

### 7. No rate limiting on `validate-access-code`
- **File:** `supabase/functions/validate-access-code/index.ts`
- **Source:** CL
- **Critical:** No
- **Notes:** No per-profile or IP throttle. Enumeration of short codes is possible. Low urgency for beta-scale, but should be tracked before growth.

---

### 8. `purge_orphaned_beta_profiles` function exists but no cron is wired
- **File:** `supabase/migrations/20260318_beta_access.sql:395`
- **Source:** CL
- **Critical:** No
- **Notes:** The cleanup function is deployed and correct, but without a Supabase scheduled job it never runs. `pending_user` profiles will accumulate indefinitely.

---

## P2 — Minor / Nit

### 9. `join-waitlist` returns HTTP 500 for a business logic / client error
- **File:** `supabase/functions/join-waitlist/index.ts:47–52`
- **Source:** CL
- **Critical:** No
- **Notes:** "Profile not found or not in pending state" is a 400-class error. `validate-access-code` handles the analogous case correctly with `status: 200` + `success: false`. Inconsistent and makes monitoring harder.

---

### 10. No email format validation in `join-waitlist` Edge Function
- **File:** `supabase/functions/join-waitlist/index.ts:22–28`
- **Source:** CL
- **Critical:** No
- **Notes:** Presence is validated but format is not. Browser `type="email"` + `required` covers the UI path; a direct API call can store malformed email. The DB only does `LOWER(TRIM(...))`.

---

### 11. `use_count` not decremented when abandoned `accessed_pending_signup` profiles are purged
- **File:** `supabase/migrations/20260318_beta_access.sql:416–424`
- **Source:** CL
- **Critical:** No
- **Notes:** If a user enters a valid code then never signs up, the purge job deletes the profile but the code's `use_count` stays incremented. For limited codes, abandoned conversions permanently eat into the cap. Intentional or oversight — worth deciding explicitly.

---

### 12. Duplicate error string in `BetaModal.tsx`
- **File:** `apps/app/src/components/BetaModal.tsx:95, 100`
- **Source:** CL
- **Critical:** No
- **Notes:** The "Invalid code — please check your code…" message is hardcoded verbatim in two places. Extract to a constant.

---

## Resolved

### 13. AnyWho scraper regression — phones & blurred addresses
- **Sources:** G, CU
- **Status:** Resolved in commit `db66adf`
- **Notes:** `span[data-content]` phone assembly and blurred street-number parsing restored. Residual risk: CF relay HTML changes can silently re-break parsers without a git revert — no code-level safeguard.

---

## Summary

| # | Issue | Priority | Critical? |
|---|-------|----------|-----------|
| ~~1~~ | ~~`create_pending_profile` 2-arg writes `pending_auth` not `pending_user`~~ | ~~P0~~ | ✅ |
| 2 | `validate_access_code` returns success with 0 rows updated | P0 | Yes |
| 3 | `scanId ?? profile.id` falls back to `aw-*` synthetic IDs | P0 | Yes |
| 4 | `validate_access_code` non-atomic check+increment race condition | P1 | Yes (limited codes) |
| ~~5~~ | ~~Dead 1-arg `create_pending_profile` overload~~ | ~~P1~~ | ✅ |
| 6 | Ping 400s from deploy skew | P1 | No |
| 7 | No rate limiting on `validate-access-code` | P1 | No |
| 8 | `purge_orphaned_beta_profiles` cron not wired | P1 | No |
| 9 | `join-waitlist` returns 500 for business logic error | P2 | No |
| 10 | No email format validation in `join-waitlist` | P2 | No |
| 11 | `use_count` not decremented on purge | P2 | No |
| 12 | Duplicate error string in `BetaModal.tsx` | P2 | No |
| 13 | AnyWho scraper regression | — | Resolved |
