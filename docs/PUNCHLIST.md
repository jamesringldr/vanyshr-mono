# Pilot-Scan Integration Punchlist

**Branch:** `dev/pilot-scan-schema` (commit `1052ca3`, cut from `dev/schema-review`)
**Companion doc:** `docs/SCHEMA_REVIEW.md` — the findings this work is fixing
**Audience:** the UI worktree picking up the front end, plus whoever finishes the backend

---

## 0. Where things stand right now

**The database is ahead of the deployed code.** Three migrations are applied to
production (`skhejbzrfptrusskuqoy`); the edge function and front-end changes that
use them are committed on this branch but **not deployed**.

| Layer | State |
|---|---|
| `quickscan` schema + 2 new RPCs | ✅ **live in production** |
| `supabase/functions/pilot-scan/index.ts` | committed, **not deployed** |
| `apps/app` pilot-scan pages | committed, **not deployed** |

This mismatch is **safe but inert**. The old deployed edge function still fails
its insert exactly the way it did before, so nothing new breaks — but pilot
scans still persist nothing in production until the code ships.

### Applied to production already

| Object | What it does |
|---|---|
| `UNIQUE (session_id)` on `quickscan.quick_scans` | Lets the fast/slow tiers converge on one scan row |
| `purge_after` DEFAULT `now() + 7 days` (3 tables) | NULL means keep-forever; the default stops writers silently creating immortal PII |
| FK `pending_profiles.source_quick_scan_id → quick_scans` | `ON DELETE SET NULL` — a purged scan must not delete the signup record |
| `quickscan.record_phase1_tier(...)` | Atomic create-or-join + per-tier merge. service_role only |
| `public.get_pilot_scan_result(uuid)` | Read-back, anon-callable, honours `purge_after` |
| cron `cleanup-stuck-scanning-scans` repointed | **§3.5 done** — first successful run 2026-08-20 16:11 after ~20h of failures |
| `get_pilot_scan_result` fallback removed | `consolidated_profile` no longer coalesces onto the differently-shaped `profile_data` |

Verified live: browser key **can** call the read RPC, **cannot** call the ingest
RPC or read `quickscan` tables directly (`42501`). Data counts unchanged
(170 scans / 7 groups / 1 enrichment / 3 pending profiles).

---

## 1. P0 — blockers. Conversion is silently broken until these land.

### 1.1 `profile_data` shape mismatch breaks signup ✅ **DONE**

`finalizeScan()` (`supabase/functions/pilot-scan/index.ts:674`) writes the
Phase 2 `ConsolidatedProfile` into `quick_scans.profile_data`. But
`public.create_pending_profile()` reads that same column expecting a **different,
older shape**, and populates `pending_phones` / `pending_emails` /
`pending_addresses` / `pending_aliases` from it.

| `create_pending_profile` expects | `ConsolidatedProfile` actually has | Result |
|---|---|---|
| `phones[]` → `.number`, `.is_primary` | `phone_numbers: string[]` | wrong key **and** element type → 0 rows |
| `emails[]` → `.email` | `emails: string[]` | `->>'email'` on a string → NULL → 0 rows |
| `addresses[]` → `.street`,`.city`,`.state`,`.zip`,`.full_address`,`.is_current` | `primary_address` / `previous_addresses` as `ContactInfo{formatted,…}` | key absent → 0 rows |
| `aliases[]` (array of text) | *absent entirely* | 0 rows |

**Consequence:** a pilot user who signs up gets a `pending_profiles` row with
only first/last/email. Every child table is empty, so `promote_pending_profile`
copies nothing and the new account lands with no phones, emails, addresses or
aliases.

**To be precise about severity:** this is *not* a regression. The pilot path
previously wrote nothing at all, so nothing got worse — but it does mean the
conversion funnel cannot work until it is fixed.

**Fix (recommended): adapt on write.** In `finalizeScan()`, map
`ConsolidatedProfile` → the legacy shape before writing `profile_data`. Reasons
to adapt the writer rather than the reader: `profile_data` is an established
contract with at least two other consumers (`create_pending_profile`,
`public.get_quick_scan_profile`), the legacy `/scan` path still writes the old
shape, and the rich object is already preserved losslessly in
`quickscan_enrichment.consolidated_profile`.

```ts
// target shape for quick_scans.profile_data
{
  phones:    [{ number: "5551234567", is_primary: true }],
  emails:    [{ email: "a@b.com", is_primary: true }],
  addresses: [{ street, city, state, zip, full_address, is_current }],
  aliases:   ["Ada L", "A. Lovelace"]          // plain strings
}
```

Source fields: `phone_numbers[]`, `emails[]`, `primary_address` (→ `is_current:
true`) + `previous_addresses[]`, and aliases from the dedup group members'
`summary.aliases` (comma/semicolon-delimited — reuse `splitList` semantics).

**Status: implemented.** `toLegacyProfileData()` in
`supabase/functions/pilot-scan/index.ts` adapts the profile before writing, and
both `finalizeScan` call sites pass the dedup group through (aliases come from
the broker summaries, which the consolidator drops). Migration
`20260820120004` removes the now-invalid `profile_data` fallback from
`get_pilot_scan_result`, so `consolidated_profile` is never returned in two
different shapes.

**Verified end-to-end** (production, rolled-back transaction): a scan carrying
the adapted `profile_data` drives `create_pending_profile` to produce 1 phone,
1 email, 1 address and 2 aliases, and those survive promotion into
`public.user_*`. The shape is correct.

### 1.2 Ship the code ⛔ **both**

Order matters: `deploy-functions.yml` only fires on push to `main`.

1. `dev/pilot-scan-schema` → `staging`, confirm the Vercel preview
2. `staging` → `main` (**production gate — needs explicit approval**)
3. Confirm the edge function actually redeployed; the workflow is path-scoped to
   `supabase/functions/**`, `packages/backend/**`, `workers/**`

Until step 2, production runs the old function against the new schema.

---

## 2. Front-end punchlist (UI worktree)

### 2.1 Render Phase 2 data — fold into existing areas 🔴 **highest value**

`buildAreas()` (`apps/app/src/pages/pilot-scan/scan-result.ts:320`) consumes
**only Phase 1 broker data**. Holehe services and Leakcheck breaches are now
fetched and available but nothing renders them — while the loading screen
promises "Finding exposed accounts" and "Scanning Dark Web"
(`loading.tsx` `STEPS`). One `detail` string still reads *"land here once Phase 2
is wired."*

**Decided approach — fold in, keep the hex at 6 slots:**

```
critical  <- + breach count, most recent breach
accounts  <- holehe services (REPLACES broker listings as
             primary content; broker pages move to 'other')
spam      <- unchanged
identity  <- unchanged
family    <- unchanged
scam      <- unchanged
```

`HEX_ORDER` (`risk-summary.tsx:38`) stays as-is — no geometry or `angleDeg`
changes. Work is confined to `buildAreas`.

**Required signature change.** `buildAreas(result)` needs the enrichment as a
second argument; the hook already returns it:

```ts
buildAreas(result: ScanResult | null, enrichment?: EnrichmentData | null)
```

Note the current `listings` array (`scan-result.ts:331`, broker profile URLs)
currently *is* the "accounts" area — moving it to `other` is a deliberate
content change, not a bug. Keep the outbound `href` behaviour at
`risk-summary.tsx:428`.

**Empty vs unknown must not look the same.** `services_checked` /
`services_unavailable` exist precisely so "we checked and you're clean" is
distinguishable from "we couldn't check." An empty `services_found` with a high
`services_unavailable` must **not** render as "no exposed accounts" — that is
the worst available failure direction. Same for `holehe_status` /
`leakcheck_status` of `pending` or an error value.

### 2.2 Switch to skeleton-until-resolved 🟡 *changes code I wrote*

`usePilotScanResult()` currently renders sessionStorage instantly then swaps
(`use-pilot-scan-result.ts:66-73`). **You chose skeleton-until-the-DB-answers**,
so this needs changing:

- Drive the skeleton off the existing `hydrating` flag (already returned, currently unused)
- Render results only once the read resolves
- Keep the sessionStorage value as the **fallback on failure**, not as the first paint
- The `source: "session" | "database"` field is already there if you want to distinguish

`risk-summary.tsx:151` is the single consumer.

### 2.3 Expired-scan screen 🟡

`get_pilot_scan_result` returns `{success:false, error:"expired"}` once
`purge_after` passes (7 days). Needs a real screen — "this report has expired,
run a new scan" — not an error state. Distinguish from `not_found`.

### 2.4 Build the conversion screen at `/pilot-scan/start` 🔴

`apps/app/src/pages/pilot-scan/start.tsx` is a placeholder ("UI shell only until
the next Mobbin screens land"), and it is the CTA target from
`risk-summary.tsx:338`. **The pilot funnel currently dead-ends.**

Decided flow: **email capture → magic link**, mirroring the legacy `/scan` path.
The working reference implementation is
`apps/app/src/pages/auth/magic-link.tsx:59-80`:

```ts
await supabase.functions.invoke("create-pending-profile", {
  body: { scan_id: scanId, email: email.trim() },
});
// → { success, profile_id }  → sessionStorage.setItem("pendingProfileId", …)
```

`scan_id` is now a **real uuid** — read `quick_scan_id` off the scan result
(sessionStorage `pilotScanResult`, or the hook's `result.quick_scan_id`).
Previously the pilot path had no scan row, which is why this was never wired.

Good news: `create_pending_profile` **already** extends the scan's `purge_after`
to `now() + 7 days` and sets `status='pending_signup'`, so the retention chain
is correct once called. Blocked on **1.1** for the child tables to be non-empty.

### 2.5 "Send me my report" without signing up 🔵 *new — needs schema, see 4.1*

A route/flow letting someone email themselves the report **without creating an
account**. Depends on the read-gate (3.1) and the user-class decision (4.1).
Sketch:

1. Risk summary → "Email me this report" → email input
2. Backend records the email against the scan and sends a link
3. Returning via the link hits the email-gated read (3.1)
4. **No `pending_profiles` row is created** — see 4.1 for why that matters

---

## 3. Backend punchlist

### 3.1 Email-gated read RPC 🔴 *blocks 2.5*

You chose **URL + email match** over a bare capability URL. That RPC does not
exist yet. `get_pilot_scan_result(uuid)` is currently ungated — holding the uuid
is sufficient.

Proposed `public.get_pilot_scan_result_verified(p_scan_id uuid, p_email text)`:

- Compare case-insensitively against `quickscan.quick_scans.email` (column
  already exists, nullable)
- Return the same payload on match; a **generic** failure on mismatch — do not
  reveal whether the scan exists or which email is correct
- Needs rate limiting; a bare email compare is brute-forceable. `cost-middleware.ts`
  already has `checkRateLimit` / `checkBurstProtection` patterns to mirror
- **Decide:** does the ungated `get_pilot_scan_result` stay for the same-session
  read path, or does everything move behind the gate? Two functions with
  different exposure is easy to get wrong later.

Worth considering instead: a single-use signed token in the emailed link. Higher
security, no email round trip, but more moving parts.

### 3.2 `promote_pending_profile` — bound retention, promote enrichment 🟠 **DONE for breaches; services + listings BLOCKED**

`SCHEMA_REVIEW.md §4`. Two defects in one function:

- It set `purge_after = NULL` on conversion, believing that retired the row.
  Because `purge_expired()` filters on `purge_after IS NOT NULL`, that made the
  row **immortal** — with the full pre-auth scrape still in `search_input` and
  `profile_data`. ✅ Now `NOW() + INTERVAL '30 days'`.
- It never touched `quickscan_enrichment`, so enrichment died at the moment the
  user became a customer. ✅ **Breaches are now promoted** into
  `public.data_breaches`, idempotently via its existing
  `UNIQUE (user_id, breach_name, matched_email)`. Provider dates are parsed
  defensively (`YYYY-MM-DD` exact, `YYYY-MM` widened to the 1st, anything else
  → NULL) so one unparseable date cannot abort somebody's signup.

**Applied in `20260820120005`. Verified end-to-end against production** in a
rolled-back transaction: full signup → promotion yielded 3 breaches, 1 phone,
1 address, 2 aliases, and left the scan at **30 days** instead of NULL.

⚠️ The **16 existing NULL-`purge_after` rows are untouched** — this fixes new
conversions only. They remain §3.3, deliberately.

#### The `SCHEMA_REVIEW.md §14` mapping — resolved, and it was half wrong

§14 guessed `public.exposures` / `public.data_breaches` were the enrichment
destinations. Checked directly:

| Enrichment output | Destination | Status |
|---|---|---|
| Leakcheck breaches | `public.data_breaches` | ✅ good fit, now promoted |
| Holehe services | *(none exists)* | ⛔ **no table models online accounts** |
| Phase 1 broker listings | `public.exposures` | ⛔ **blocked, see below** |

- **Holehe services have no home.** No `%account%` / `%service%` / `%social%`
  table exists anywhere in `public`. `exposures` is emphatically not it:
  `exposures.broker_id` is `NOT NULL` referencing `brokers.brokers`, and the
  table carries a removal workflow (`removal_requested_at`,
  `verified_removed_at`). It models data-broker listings. An online account is
  not a broker, and putting services there would corrupt what the removal
  pipeline means.

- **`brokers.brokers` has ZERO rows.** Because `exposures.broker_id` is
  `NOT NULL`, **no `exposures` row can be created at all** right now — not by
  promotion, not by anything else. Promoting Phase 1 broker listings is a
  genuinely good idea and is exactly what that table is for, but it is blocked
  until `brokers.brokers` is seeded (fps / npd / anywho / zaba at minimum).

**Follow-up (not done here):** seed `brokers.brokers`, then decide whether
online accounts get their own table or stay report-only data that never leaves
`quickscan_enrichment`.

### 3.3b Zero-breach enrichment violated a CHECK constraint ✅ **DONE (new find)**

Found while doing 3.4. `Phase2Orchestrator.storeResults()` wrote
`leakcheck_status: breaches.length ? 'success' : 'no_results'`, but
`quickscan_enrichment_leakcheck_status_check` permits only
`pending | success | failed | no_auth | timeout` — **`no_results` is not in the
set**. Since most people have zero breaches, this violated the constraint on the
*common* path and would have failed the entire enrichment insert.

It was latent only because Phase 2 never stored anything before (§2). Fixing §2
without this would have made Phase 2 persistence appear to work for anyone with
a breach and silently fail for everyone else — the worst kind of partial success.

Proved against production in a rolled-back transaction: the old value is
`REJECTED by check constraint`, the new one inserts fine. Now tracks a real
`leakcheck_status` through the enrichment branches (`no_auth` when the API key
is missing, `failed` on error, `success` when the check ran — including a clean
zero-breach result).

### 3.3 Decide the 16 existing NULL-`purge_after` scans 🟡

Deliberately untouched by the migration — sweeping them in as a side effect of a
DDL change would have made 16 real people's pre-auth PII purge-eligible without
anyone deciding to. Needs an explicit call once 3.2 lands.

### 3.4 Wire the enrichment coverage columns 🟠 **3 of 4 done**

`Phase2Orchestrator.storeResults()` now writes three of the four:

| Column | Status |
|---|---|
| `breach_count` | ✅ breaches length |
| `fields_exposed` | ✅ `exposedFields()` — PII categories actually found |
| `services_checked` | ✅ plumbed through `HoleheResult.services_checked`; the count was previously discarded inside `extractServices()` |
| `services_unavailable` | ⚠️ **left NULL deliberately — not derivable** |

**Why `services_unavailable` stays NULL.** The hosted Holehe API returns
`services: Record<string, boolean \| {username,url}>`. A `false` is a *verdict*
("no account there"), not "could not check" — per-service unavailability is
simply not in the response. Writing a number would defeat the column's only
purpose. Populating it honestly needs either a different Holehe deployment that
reports per-service errors, or dropping the column.

**What the UI should use instead (for 2.1):**

```
holehe_status = 'success'      -> accounts found
holehe_status = 'no_results'   -> services WERE checked, none matched ("clean")
holehe_status = 'unavailable'  -> nothing was checked; say nothing about accounts
```

`services_checked > 0` is the corroborating signal. Never render "no exposed
accounts" on `unavailable`.

### 3.5 Fix the dead cron job ✅ **DONE**

Fixed by `20260820120003`. The job `cleanup-stuck-scanning-scans` had failed
every minute since 2026-08-19 20:18 (~1,200 runs) because it referenced
`quick_scans` unqualified and the partition moved the table. Repointed at
`quickscan.quick_scans` via `cron.schedule()` (upserts by job NAME, so it is
idempotent and does not hardcode `jobid=1`).

**Verified:** first successful run at 2026-08-20 16:11:00, `UPDATE 0` — the
reaper is running again and finding nothing stuck, which is correct. The ~1,200
historical failure rows are left as an audit trail; the existing
`cleanup-old-cron-run-details` job prunes them after 30 days.

### 3.6 Schedule `purge_expired()` — **last** 🟡

Only after 3.2/3.3. It would remove 154 of 170 scans today. pg_cron is installed
and working, so this is a one-liner whenever you choose.

---

## 4. Open decisions

### 4.1 Modelling "report recipient" vs "subscriber" ⚠️ **needs your call**

Raised during handoff: someone who emails themselves a report is not a customer,
and the schema has no way to say so.

**Recommendation: do NOT put them on `pending_profiles`.**

- `signup_status` has a CHECK constraint of exactly four values
  (`pending_user`, `waitlisted`, `accessed_pending_signup`, `pending_auth`) —
  a new value means altering it
- `promote_pending_profile` **branches on `signup_status`**, and a
  `pending_profiles` row is the thing that becomes a real `public.user_profiles`
  account. A report recipient must never be promotable; putting them there is
  one missed `WHERE` clause away from minting accounts for people who never
  asked for one

**Proposed instead** — keep it on the scan, where it belongs:

```sql
-- quick_scans.email already exists (nullable text)
ALTER TABLE quickscan.quick_scans
  ADD COLUMN report_sent_at timestamptz;
```

`email IS NOT NULL AND report_sent_at IS NOT NULL AND converted_to_user_id IS NULL`
= report recipient. `pending_profiles` continues to mean "intends to sign up."
Clean separation, no constraint churn, no promotion risk.

**Open sub-questions:**
- Does emailing a report extend `purge_after` beyond 7 days? If someone is told
  "here's your report," a dead link a week later is a bad experience — but
  extending retention on pre-auth PII is a privacy decision, not a UX one.
- Can one scan be emailed to more than one address? If so this needs its own
  table, not a column.
- Is a report recipient marketable-to? That is a consent question with legal
  implications, and the schema should record consent rather than imply it.

### 4.2 Retention window is currently 7 days

Set in `20260820120000` §2, matching `pending_profiles`. Deliberately **not** the
30-minute `expires_at`, which would destroy the scan before the signup funnel
completes. One literal in three places — change it if legal/product want
different.

---

## 5. Contract reference — `get_pilot_scan_result(uuid)`

Build the front end against this. `SECURITY DEFINER`, granted to `anon` and
`authenticated`.

```jsonc
{
  "success": true,
  "scan_id": "uuid",
  "status": "completed",              // or 'scanning' | 'processing' | …
  "created_at": "…", "completed_at": "…",
  "search_input":      { "first_name": "…", "last_name": "…",
                         "zip_code": "…", "city": "…", "state": "…" },

  // raw per-tier Phase 1 output — present even if the user never picked,
  // which is what makes an abandoned scan resumable
  "candidate_matches": { "fast": [ … ], "slow": [ … ] },

  // the group the user actually selected; null until Phase 2 runs.
  // full_data is the BACKEND DedupGroup shape — reshape with
  // storedGroupToScanGroup() in scan-result.ts
  "selected_group": {
    "full_data": { "dedup_id": "…",
                   "members": [ { "match_score": 91.5, "summary": { … } } ] },
    "primary_name": "…", "primary_age": 37,
    "primary_city": "…", "primary_state": "…",
    "sources": ["zaba","fps"], "average_confidence": 91.5,
    "age_conflict": false, "age_note": null
  },

  "consolidated_profile": { … },      // enrichment ONLY; null if no enrichment stored.
                                      // quick_scans.profile_data is the differently-shaped
                                      // signup copy and is NOT exposed here.
  "enrichment": {
    "emails_found": ["…"],
    "services_found": ["github","spotify"],   // Holehe
    "breaches": [ { "name": "LinkedIn 2021", "date": "…",
                    "exposures": 700000000, "url": "…" } ],
    "breach_count": 1,
    "holehe_status": "success", "leakcheck_status": "success",
    "services_checked": 42,                   // verdicts received (see 3.4)
    "services_unavailable": null,             // ⚠️ always null — not derivable, see 3.4
    "fields_exposed": ["name","address","phone"]
  }
}
```

**Failure envelopes** (always HTTP 200 — check `success`):

```jsonc
{ "success": false, "error": "not_found" }   // unknown id
{ "success": false, "error": "expired" }     // past purge_after → 2.3
```

`selected_group` and `enrichment` are **independently nullable** — a scan can
exist with Phase 1 done and Phase 2 never run. Handle that; it is the normal
state for an abandoned scan.

---

## 6. Known-broken on this branch (pre-existing, not from this work)

Flagging so nobody loses an afternoon:

- **`pnpm lint` cannot run.** `eslint.config.js:2` imports `typescript-eslint`,
  which is not declared as a dependency anywhere in the workspace.
- **`pnpm type-check` is red repo-wide.** `packages/shared` does not build, so
  everything downstream reports `TS6305`. Build `packages/shared` → `packages/ui`
  → `apps/app` in order.
- **16 Deno type errors** across `supabase/functions/_shared/quickscan/*` (e.g.
  `used_context_dev` missing from the `Phase1SearchResult` metadata type).
  `deno check` on `pilot-scan/index.ts` reports exactly 1, pre-existing, at the
  `m.summary as Record<string, unknown>` cast.

The pilot-scan changes on this branch add **zero** new type errors in either
toolchain — verified by diffing error sets against a stashed baseline.

---

## 7. Suggested order

~~1.1~~ ✅ · ~~3.4~~ ✅ (3 of 4) · ~~3.3b~~ ✅ · ~~3.5~~ ✅ · ~~3.2~~ ✅ (breaches only) — done, committed, DB applied.

1. **1.2** ship to staging, validate on the preview URL — **the gating step**;
   nothing above is live in the app until this happens
2. **2.1** render Phase 2 data — biggest visible payoff, and now unblocked
   (read 3.4 for the `holehe_status` mapping before writing the copy)
3. **2.2 / 2.3** skeleton + expired screen
4. **2.4** conversion screen — turns the funnel on
5. **3.3** the 16 NULL-`purge_after` rows — **your decision**, nothing else blocks on it
6. **4.1 → 3.1 → 2.5** decide the user class, then build the gate, then the UI
7. Seed `brokers.brokers`, then revisit promoting broker listings into
   `public.exposures` (blocked today — see 3.2)
8. **3.6** schedule the purge, once and only once 3.3 is settled
