# Schema Review — Vanyshr Production Database

**Reviewed:** 2026-08-19
**Project ref:** `skhejbzrfptrusskuqoy` (production, pre-launch)
**Method:** every claim below was checked against the **live database** via
`supabase db query --linked`, plus REST probes with the real publishable key and
`grep` over the working tree. Migration files were *not* treated as evidence.
**Status:** review only — no schema changes, migrations, or drops were applied.
`quickscan.purge_expired()` was **not** run.

Scope: 45 tables across `public`, `quickscan`, `brokers`, `testing`.

---

## Summary of findings

| # | Severity | Finding | Verified? |
|---|----------|---------|-----------|
| 1 | **CRITICAL** | `public.scrape_results` — 33 rows of scraped PII readable *and deletable* by anyone with the browser-shipped publishable key | Yes, live REST probe |
| 2 | **CRITICAL** | The live pilot-scan path persists **nothing** — Phase 1 storage fails silently, Phase 2 never stores | Yes, cast error + row counts |
| 3 | **HIGH** | `cron.job` #1 has failed every minute since 20:18 today — timeout reaper dead since the partition | Yes, 79 failures in `job_run_details` |
| 4 | **HIGH** | `promote_pending_profile()` makes converted scans' pre-auth PII **permanent**; enrichment is never promoted | Yes, function source + 16 rows |
| 5 | **HIGH** | `anon` can `INSERT/UPDATE/DELETE` the risk-taxonomy reference tables (75 rows) | Yes, live REST probe |
| 6 | MEDIUM | `quickscan_cost_tracking` has no `purge_after` and is never purged | Yes, column list + function source |
| 7 | MEDIUM | `pending_profiles.source_quick_scan_id` has no FK; retention is inverted vs. intent | Yes, 0 FKs, 3 rows past due |
| 8 | MEDIUM | Purge cascade deletes enrichment/dedup rows regardless of their own `purge_after` | Yes, FK definitions |
| 9 | MEDIUM | `testing.*` holds real scraped PII with RLS off — but is **unreachable via the API** | Yes, no schema `USAGE` |
| 10 | LOW | Five genuinely orphaned tables; one candidate is **not** stale | Yes (one caveat, see §10) |
| 11 | LOW | `search_input` JSONB key-casing drift (`zip_code` vs `zipcode`) | Yes, key census |
| 12 | LOW | Enrichment coverage columns exist but nothing writes them | Yes, orchestrator source |

**Corrections to the handoff brief** are collected in §13, and things I
**could not verify** in §14. Both matter — the brief's own advice was to keep
those separate.

---

## 1. CRITICAL — `public.scrape_results` is world-readable and world-deletable PII

`scrape_results` holds 33 rows of real scraped people (`input_data`,
`summary_results`, `full_profile_results` JSONB) with **RLS disabled** and full
CRUD granted to `anon`.

Grants:

```sql
SELECT n.nspname||'.'||c.relname AS tbl, r.rolname, ...
WHERE c.relrowsecurity = false AND r.rolname IN ('anon','authenticated');
```
```
public.scrape_results|anon         |DELETE,INSERT,SELECT,UPDATE
public.scrape_results|authenticated|DELETE,INSERT,SELECT,UPDATE
```

This is not theoretical. Probed live with the project's **publishable key**
(`sb_publishable_HQk3A…`, which ships in the client JS bundle), requesting counts
only — no PII values were retrieved:

```
scrape_results        HTTP 200  content-range: 0-0/33     ← all 33 rows exposed
user_profiles         HTTP 200  content-range: */0        ← RLS correctly hides all 8
quickscan.quick_scans HTTP 401                            ← partition holds
```

The `user_profiles` and `quickscan` lines are the control: the same key against
properly-protected tables returns nothing, which confirms the `scrape_results`
result is a real hole and not a mis-built probe.

**Root cause** — `workers/tests/scrape_runner.py:75` writes with the anon key:

```python
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
```

RLS was turned off and `anon` granted CRUD so a test harness could write. There
is also **no retention column** on this table (`purge_after`/`expires_at`/
`retention_until`: 0 found), and the data spans 2026-07-29 → 2026-08-08.

**Recommended (not applied):** switch `scrape_runner.py` to the secret key, then
revoke `anon`/`authenticated` and enable RLS with a service-role-only policy. Add
a `purge_after` and fold the table into the purge. Because it is test-harness
data about real people, deleting the 33 rows outright is likely the cleanest fix —
that is your call, so I have not touched them.

---

## 2. CRITICAL — the live pilot-scan path stores nothing at all

The brief stated "Phase 1 writes `quickscan.quickscan_dedup_groups` via
`Phase1Orchestrator.storeResults()`." **That is false in production.** Phase 1
storage throws on every call and the error is swallowed.

`supabase/functions/pilot-scan/index.ts:251` passes a *text* scan id:

```ts
const dedupGroupIds = await orchestrator.storeResults(
  supabaseClient, `pilot-${sessionId}`, result);
```

`phase1-orchestrator.ts:272` puts it straight into a `uuid NOT NULL` FK column:

```ts
.insert({ quick_scan_id: quickScanId, ... })
```

Proven read-only against production:

```sql
SELECT 'pilot-7ffee355-8923-435b-9a75-aea37846d787'::uuid;
-- ERROR: 22P02: invalid input syntax for type uuid
```

The insert error is caught and `continue`d (`phase1-orchestrator.ts:290-293`), so
Phase 1 still returns `success` to the client.

The data agrees. All 7 `quickscan_dedup_groups` rows are from **2026-08-12** with
valid UUIDs and `smoke-…`/`debug-local-005`/`test-full-scan-001` session ids —
the legacy `run-quick-scan` path. None are `pilot-` prefixed. Meanwhile 21+
pilot Phase-1 runs on 2026-08-19 all recorded `status=success` in cost tracking
and wrote **zero** dedup groups:

```
2026-08-19 14:47:32 ph1 sess=8f2b1c3d-… no_dedup=true success
2026-08-19 13:13:44 ph1 sess=7b6dd35d-… no_dedup=true success
… (21 rows, all no_dedup=true)
```

`pilot-scan/index.ts` also never inserts into `quick_scans` at all (grep: only
doc-comment mentions). Newest `quick_scans` row is 2026-08-15; pilot traffic ran
2026-08-19.

**Phase 2 compounds it.** The client sends `selectedGroup`
(`loading.tsx:332`), which routes to `handlePhase2WithGroup` — checked *first* in
the routing chain (`index.ts:126`) — and that handler calls `trackCost` but never
`storeResults`. The result goes to `sessionStorage.pilotPhase2Result`
(`loading.tsx:340`) and **nothing reads it back**: grep finds only the three
write/remove sites in `loading.tsx`, no consumer.

**Net effect:** the only durable trace of a pilot scan is a
`quickscan_cost_tracking` row carrying a session id, a dollar amount, and
`quick_scan_id`/`dedup_group_id`/`enrichment_id` all NULL. Every scraped profile
and every paid enrichment result is discarded when the tab closes.

### Where the Phase 2 consolidated profile should live

`quickscan.quickscan_enrichment.consolidated_profile` (jsonb) **already exists and
already works** — the one surviving row (2026-08-12, legacy path) has it
populated, and `Phase2Orchestrator.storeResults()` writes it correctly. The
column is not the problem; the live path just never calls the writer.

There is a real schema blocker, though. `quickscan_enrichment` requires:

```
quick_scan_id  uuid NOT NULL   → FK quickscan.quick_scans   (ON DELETE CASCADE)
dedup_group_id uuid NOT NULL   → FK quickscan_dedup_groups  (ON DELETE CASCADE)
```

…and `handlePhase2WithGroup` has **neither** — it passes `null` for both to
`trackCost`. So persisting the live path requires a decision, not just a call:

- **Option A (recommended):** make Phase 1 create a real `quick_scans` row,
  return its UUID to the client, and have the client echo it back on the Phase 2
  call. This fixes finding #2 at the root, restores the `purge_after` retention
  chain for pilot data, and makes `promote_pending_profile` able to find the
  scan. Most work, correct result.
- **Option B:** relax both columns to `NULL`-able and store enrichment keyed by
  `session_id` only. Cheaper, but the row then has no retention parent and no
  path into `public` on conversion — it would need its own `purge_after` default.

Either way `purge_after` must be set on write; today `quickscan_enrichment`
has **no default** on that column (see §6).

---

## 3. HIGH — the scan-timeout cron job has been dead since the partition landed

`cron.job` #1 runs every minute:

```
job1 [* * * * *] active=true ::
  update quick_scans set status='failed',
    error_message='Scan timed out — edge function did not complete in time'
  where status='scanning' and updated_at < now() - interval '2 minutes';
```

The table reference is **unqualified**. The partition moved `quick_scans` from
`public` to `quickscan`, and the job's search path no longer resolves it:

```sql
SELECT min(end_time), max(end_time), count(*) FROM cron.job_run_details
WHERE jobid=1 AND return_message LIKE '%does not exist%';
```
```
n=79   from 2026-08-19 20:18:00   to 2026-08-19 21:36:00
ERROR: relation "quick_scans" does not exist
```

Last successful run: **2026-08-19 20:17:00** — one minute before the first
failure. This is an active, ongoing, once-per-minute production error that
started with the partition and is still firing. It is also filling
`cron.job_run_details` with failures that job #2's cleanup does not match
(it only prunes `return_message = 'UPDATE 0'` rows within the hour).

**Recommended fix:** qualify the reference — `update quickscan.quick_scans …`.
Note there are currently 0 scans in `status='scanning'`, so no user-visible
symptom yet; the job is a safety net that is silently down.

**Bonus:** the same job hit `quick_scans_status_check` violations on 2026-08-08
trying to write `status='error'`. The constraint permits `pending, scanning,
matches_found, selection_required, processing, completed, no_matches, failed,
expired, pending_signup, admin_sent` — `error` is not among them. That code path
has since changed to `'failed'`, but it confirms the job has a history of
failing unnoticed.

**pg_cron is installed and working** (see §13) — scheduling `purge_expired()` is
a one-liner whenever you decide to.

---

## 4. HIGH — conversion makes pre-auth PII permanent, and drops enrichment

`public.promote_pending_profile()` ends with:

```sql
-- The scan itself has served its purpose. Drop its retention deadline and
-- mark it complete; it is no longer purge-eligible because the person
-- converted, and their data now lives in public.
UPDATE quickscan.quick_scans
SET status='completed', completed_at=NOW(), purge_after=NULL
WHERE id = v_pending.source_quick_scan_id;
```

The comment's premise is wrong. Setting `purge_after = NULL` does not retire the
row — because `purge_expired()` filters on `purge_after IS NOT NULL`, it makes
the row **immortal**, and that row still holds the full pre-auth scrape in
`search_input` and `profile_data`.

The correlation is exact — every NULL-`purge_after` scan is a converted one:

```
purge_null=false converted=false -> 154
purge_null=true  converted=true  ->  16
```
```
KEPT FOREVER: n=16  profile_data_PII=16  search_input_PII=16
purgeable:    n=154 profile_data_PII=58  search_input_PII=154
```

Keys present in those retained `profile_data` blobs: `name`, `first_name`,
`last_name`, `middle_name`, `age`, `addresses`, `phones`, `emails`, `relatives`,
`aliases`, `jobs`, `education`, `assets`, `legal_records`, `background_records`,
`social_profiles`.

So the documented model ("authenticated → promoted into `public.user_*`, source
rows deleted") is inverted in practice: the pre-auth copy is the one thing that
never expires. The function *does* correctly delete `pending_profiles` (and
cascades its four child tables) — it is only the scan row that is kept.

**Second gap in the same function:** it copies `pending_phones/addresses/aliases/
emails` into `public.user_*`, but **never touches `quickscan_enrichment`**.
Breaches, exposed services, and the consolidated profile do not survive
conversion at all. Once Phase 2 persistence lands (§2), promote needs a matching
branch or that data dies at the same moment the user becomes a customer.

**Recommended:** set an explicit short deadline instead of NULL
(`purge_after = NOW() + INTERVAL '30 days'`, or immediate), and add enrichment
promotion. Note `public.exposures` (0 rows) and `public.data_breaches` (8 rows)
look like the intended destinations, but I did not verify that mapping — see §14.

---

## 5. HIGH — `anon` can modify the risk-taxonomy reference tables

```
public.risk_data_types           |anon|DELETE,INSERT,SELECT,UPDATE
public.risk_data_type_categories |anon|DELETE,INSERT,SELECT,UPDATE
```

Both have RLS disabled. Confirmed live with the publishable key:

```
risk_data_types              content-range: 0-0/26
risk_data_type_categories    content-range: 0-0/49
```

No PII, so this is an integrity rather than privacy issue — but 75 rows of
product reference data can be silently altered or wiped by any visitor. Read
access is probably intended; write access almost certainly is not.

**Recommended:** `REVOKE INSERT, UPDATE, DELETE … FROM anon, authenticated`,
enable RLS, add a read-only policy.

---

## 6. MEDIUM — retention gaps in the purge function

`quickscan.purge_expired()` deletes from five tables, each guarded by:

```sql
WHERE purge_after IS NOT NULL AND purge_after < NOW()
```

Two consequences:

**a) NULL means "keep forever."** 16 of 170 `quick_scans` have NULL
`purge_after` (§4). Any row that misses its deadline assignment is retained
silently rather than caught.

**b) `quickscan_cost_tracking` is never purged and has no deadline column.**
The brief said "every `quickscan` table carries `purge_after`" — it does not:

```
quick_scans        |total=170|NULL=16 |past_due=154
dedup_groups       |total=7  |NULL=0  |past_due=7
enrichment         |total=1  |NULL=0  |past_due=1
pending_profiles   |total=3  |NULL=0  |past_due=3
cost_tracking      |total=31 |no purge_after column
scan_retry_requests|total=0  |NULL=0  |past_due=0
```

Cost rows carry `session_id` and (via SET NULL FKs) survive their parents, which
is reasonable for billing analytics — but it should be a deliberate, documented
exemption rather than an omission, since `session_id` is still a linkage
identifier.

Also: four of the five tables have **no default** on `purge_after`
(only `pending_profiles` defaults to `now() + 7 days`). Every writer must
remember to set it, and §2/§4 show that writers forget.

Purge performance is fine — all five tables have a `purge_after` index.

---

## 7. MEDIUM — no FK on `source_quick_scan_id`, and retention runs backwards

```sql
SELECT count(*) FROM pg_constraint
WHERE conrelid='quickscan.pending_profiles'::regclass AND contype='f';
-- 0
```

`pending_profiles.source_quick_scan_id` is an unenforced pointer. Combined with
§4, the retention ordering is inverted — the *signup* record expires while the
*scan* it came from lives forever:

```
pp=ef98159e  pp_purge=2026-05-26 (past due)  scan_purge=null  scan_status=pending_signup
pp=39f9050e  pp_purge=2026-05-26 (past due)  scan_purge=null  scan_status=pending_signup
pp=b85cfb71  pp_purge=2026-05-23 (past due)  scan_purge=null  scan_status=pending_signup
```

All three are ~3 months past their 7-day deadline (they persist only because the
purge is unscheduled). When it does run, all three vanish while their scans —
which hold strictly more PII — remain. `promote_pending_profile` would then
return "Pending profile not found (may have been purged)" for anyone who
returned to finish signup.

**Recommended:** add the FK (`ON DELETE SET NULL`), and extend the scan's
`purge_after` to match whenever a signup is initiated.

---

## 8. MEDIUM — cascade overrides the child's own retention deadline

```
quickscan.quick_scans <- quickscan_dedup_groups  [ON DELETE CASCADE]
quickscan.quick_scans <- quickscan_enrichment    [ON DELETE CASCADE]
quickscan_dedup_groups <- quickscan_enrichment   [ON DELETE CASCADE]
```

`purge_expired()` deletes enrichment → dedup → scans, so in its own run order
this is harmless. But the cascade means **deleting a scan destroys its enrichment
regardless of that row's `purge_after`**. Once the signup path extends deadlines
per §7, a 30-minute scan deadline will silently take a 7-day enrichment record
with it. Worth pinning down before Phase 2 persistence ships.

The FKs are otherwise sound: no `RESTRICT`/`NO ACTION` anywhere in `quickscan`,
so the purge cannot fail on a constraint — a risk I specifically checked for and
ruled out.

---

## 9. MEDIUM — `testing.*` PII is real, but not API-reachable

The brief grouped `testing.*` with `scrape_results`. They are different risks.

```
testing|anon         |USAGE=false
testing|authenticated|USAGE=false
testing|service_role |USAGE=false      ← not even service_role
```

With no schema `USAGE`, nothing reachable through PostgREST can touch these
tables, so RLS being off is far less consequential than in §1. The PII is still
real and undated, though:

```
summary_results     |n=206|2026-08-15
full_profile_results|n=91 |2026-08-15
test_subjects       |n=34 |2026-08-13
scrape_runs         |n=21 |2026-08-15
data_points / holehe_results / leakcheck_results | n=0
```

These are real scraped people used as test fixtures, with no retention deadline
and no owner. Risk class: data-at-rest / anyone with direct DB credentials or a
backup — not internet exposure.

**Recommended:** leave the lockdown as-is, but give the schema a retention story
(or synthetic fixtures). Note `full_profile_results` is at 91 rows, not the 42
the brief recorded — something wrote 49 rows on 2026-08-15.

---

## 10. LOW — stale tables (each checked for code references)

Grep across the working tree excluding `docs/`, `supabase/migrations/`,
`node_modules`, `dist`, `.turbo`:

| Table | Rows | Code refs | Verdict |
|---|---|---|---|
| `public.zip_lookup` | 57 | **0** | Orphaned — consumer edge function deleted 2026-08-19. Confirms brief. |
| `public.user_todos` | 0 | **0** | Orphaned (migrations only). |
| `public.removal_jobs` | 0 | **0** | Orphaned *in this repo* — see §14. |
| `public.removal_status_history` | 0 | **0** | Orphaned *in this repo* — see §14. |
| `public.recon_probes` | 21 | **0** | Orphaned *in this repo* — see §14. |
| `public.scraper_test_results` | 0 | 2 (scripts) | Superseded, see below. |
| `public.user_updates` | 0 | **4 (live app code)** | **NOT stale — do not drop.** |

**`user_updates` is a false positive in the brief's candidate list.** It is
queried in four places in `apps/app/src/views/Dashboard/DashboardHome.tsx`
(lines 321, 356, 364, 379). It is empty because the feature has no data yet, not
because it is abandoned.

**`scraper_test_results` vs `scrape_results`:** the brief suspected overlap and
it is real. `scraper_test_results` (0 rows) is written by
`workers/tests/log_scraper_results.py:107,139`; `scrape_results` (33 rows) is
written by `workers/tests/scrape_runner.py`. The newer runner won — the older
table has never received a row. Safe to retire once you confirm
`log_scraper_results.py` is dead tooling. It also carries the same `anon` CRUD
grant as §1, so it is a zero-row hole of the same shape.

**`recon_probes`** is *not* PII — columns are `site_id, surface, classification,
status, ms, bytes, final_url, evidence, headers, probed_at`, i.e. broker-site
reconnaissance metadata. 21 rows, all from a single day (2026-05-06), 15 distinct
sites. Its "RLS enabled, zero policies" state (deny-all except service_role) is
safe; whether it was deliberate I could not determine, but given the table has no
code references and one day of data, it reads as an abandoned experiment rather
than a half-finished migration.

I did **not** drop or modify any of these.

---

## 11. LOW — `search_input` key-casing drift

```
170 state          170 city
161 zip_code       161 last_name    161 first_name
  9 zipcode          9 lastName       9 firstName
  3 email            1 age
```

Two naming conventions coexist in the same JSONB column from two different
writers. The pilot request handler already compensates in TypeScript
(`lastName || last_name`, `zipcode || zipCode` at `index.ts:119-120`), so nothing
is broken — but any SQL that reads `search_input->>'zip_code'` silently misses 9
rows. Worth normalising on write if this column is ever queried analytically.

---

## 12. LOW — enrichment coverage columns are dead weight

`services_checked`, `services_unavailable`, `fields_exposed`, `breach_count` were
added in `20260819120006`. `Phase2Orchestrator.storeResults()` does not write any
of them, and the single existing row confirms it:

```
created=2026-08-12 consolidated=true services_checked=null
services_unavail=null breach_count=null fields_exposed=null holehe=success
```

Confirms the brief. Either wire them up alongside the §2 fix or drop them; right
now they are schema that promises coverage data nobody produces.

---

## 13. Corrections to the handoff brief

The brief asked to be checked rather than trusted. Seven things did not hold:

1. **"Phase 1 writes `quickscan_dedup_groups`."** It does not — every write
   fails on the uuid cast (§2). This is the most consequential correction.
2. **"pg_cron is not enabled."** It **is** installed, with two active jobs — one
   of which is currently failing every minute (§3). Scheduling `purge_expired()`
   needs no enablement work.
3. **"Every `quickscan` table carries `purge_after`."** `quickscan_cost_tracking`
   does not (§6), and 16 `quick_scans` rows have it NULL.
4. **"`quickscan`, `brokers`, `testing` … service_role"** — `brokers` grants
   `USAGE` to `authenticated` (with `SELECT` on `brokers.brokers` and
   `brokers.broker_stats`), and `testing` grants `USAGE` to **nobody**,
   service_role included (§9).
5. **"authenticated → source rows deleted."** Converted scans are retained
   permanently with full PII (§4).
6. **Row counts have drifted:** `testing.full_profile_results` 91 (not 42),
   `test_subjects` 34 (not 35), `user_phones` 113 (not 129), `zip_lookup` 57
   (not 56), `scrape_results` 33.
7. **`pre-profile.tsx` does not exist.** The pilot-scan pages are `entry`,
   `loading`, `pii-artifact`, `risk-summary`, `scan-result`, `splash`, `start`.

Confirmed correct: the `monitored_data_points` warning (0 tables found), the
`quickscan` lockdown (`anon` → HTTP 401), the 14 RLS-disabled tables, the unwired
coverage columns, `recon_probes` having RLS with zero policies, `zip_lookup`
being orphaned, and the Phase 2 non-persistence at `index.ts:407`.

---

## 14. What I could not verify

Stated plainly rather than guessed:

- **`removal_jobs`, `removal_status_history`, `recon_probes` in the admin app.**
  Zero references in this repo, but the admin UI is the private `vanyshr-admin`
  repo (per `docs/ADMIN_APP.md`) which I cannot read. All three have full RLS
  policy sets (5, 5, and 0 respectively), which for the first two suggests
  deliberate setup for *some* consumer. **Do not drop these until the admin repo
  is grepped.**
- **Who writes `testing.*`.** No writer exists in this working tree, and no API
  role has schema `USAGE` — so writes must come from a direct Postgres connection
  outside this repo. 49 rows appeared on 2026-08-15; I could not attribute them.
- **Whether retaining the 16 converted scans is a deliberate product decision.**
  The code comment says the opposite of what the code does, so I treated it as a
  bug — but if there is a support or audit reason to keep post-conversion scans,
  the fix is to document and bound it rather than to purge.
- **Whether `public.exposures` / `public.data_breaches` are the intended
  promotion targets** for enrichment data (§4). The column shapes look plausible;
  I did not trace it far enough to assert it.
- **Whether `log_scraper_results.py` is still run by anyone** (§10). It targets a
  table that has never held a row, which is suggestive but not proof.

---

## Suggested order of work

1. **§1** — revoke `anon` on `scrape_results`; decide whether the 33 PII rows stay.
2. **§3** — one-word cron fix (`quickscan.quick_scans`); stops an active
   per-minute production error.
3. **§5** — revoke `anon` writes on the two risk tables.
4. **§2** — thread a real `quick_scans` UUID through pilot Phase 1 → Phase 2
   (Option A). This is the substantive design change and unblocks §4, §6, §12.
5. **§4** — bound the post-conversion deadline; promote enrichment.
6. **§7, §8** — FK plus deadline alignment, ideally in the same migration as #4.
7. **§10** — retire `zip_lookup`, `user_todos`, `scraper_test_results` once §14's
   admin-repo check clears the other three.
8. Schedule `purge_expired()` **last** — after §4/§6/§7, so it does not delete
   the wrong side of the retention model. It would remove 154 of 170 scans today;
   that call remains yours and I have not run it.
