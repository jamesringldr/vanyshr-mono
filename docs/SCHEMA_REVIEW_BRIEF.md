# Schema Review — Handoff Brief

**Written:** 2026-08-19, immediately after the `quickscan` partition shipped to production.
**Purpose:** orient a fresh review session. This is *not* the review — it is the
context that is expensive to rediscover, plus the leads worth chasing first.

---

## Read this first: trust the database, not the migrations

On 2026-08-19 the migration files and the actual production database were found
to disagree in three separate ways:

1. **Two migrations were recorded but had never been applied.**
   `20260813100000_risk_classification` and `20260813_scraper_sources_and_coverage`
   — their objects simply did not exist. Both have since been applied.
2. **~20 migrations were applied but not recorded**, and 8 recorded entries had
   no local file. `supabase db push` refused to run at all for months as a result.
3. **Root cause was filename collisions**, not drift: Supabase derives a
   migration's version from its numeric prefix, and four files shared `20260812`.
   `schema_migrations` holds one row per version, so it could never reconcile.

That is now fixed (`db push` reports "Remote database is up to date"), **but the
lesson stands: verify every claim against the live database.** A review based on
reading migration files alone will be confidently wrong.

```bash
supabase link --project-ref skhejbzrfptrusskuqoy
supabase db query --linked "SELECT ..."     # read-only, no Docker needed
supabase inspect db table-stats             # table sizes + row estimates
```

`supabase db query --linked` goes through the Management API and needs no DB
password. Docker is *not* running on this machine — `db dump` and `db reset`
will fail; `db query`, `db push`, and `functions deploy` all work without it.

---

## Verified state (2026-08-19)

45 tables across four schemas:

| Schema | Purpose | Access posture |
|--------|---------|----------------|
| `public` | Authenticated subscribers + downstream records | RLS via `get_current_user_profile_id()` |
| `quickscan` | **All pre-conversion data** — anonymous scans and started-but-never-authenticated signups | service_role only; `anon`/`authenticated` have **no `USAGE`** |
| `brokers` | Broker registry and stats | service_role |
| `testing` | Scraper test harness | service_role / `testing_writer` |

Live row counts worth knowing (the rest report `-1`, i.e. never analyzed):

```
public.user_profiles          8      (authenticated only, post-partition)
public.user_phones          129
public.user_addresses       112
quickscan.quick_scans       170      (154 already past purge_after)
quickscan.pending_profiles    3
testing.summary_results     206
testing.test_subjects        35
testing.full_profile_results 42
public.zip_lookup            56
```

---

## Leads worth chasing first

### A. PII outside the partition — the biggest gap

The `quickscan` partition solved pre-conversion PII in the *scan* flow. It did
**not** touch two other surfaces holding real scraped personal data:

- **`public.scrape_results`** — `input_data`, `summary_results`,
  `full_profile_results` JSONB. **No RLS, no policies, no retention.** Written by
  `scrape_runner.py` for integration testing.
- **`testing.*`** — `summary_results` (206 rows), `full_profile_results` (42),
  `test_subjects` (35). All **no RLS**. Real scraped people, used as test fixtures.

**14 tables have RLS disabled entirely.** Full list:

```
brokers.broker_stats, brokers.broker_vanyshr_stats, brokers.brokers,
public.risk_data_type_categories, public.risk_data_types,
public.scrape_results, public.scraper_test_results,
testing.data_points, testing.full_profile_results, testing.holehe_results,
testing.leakcheck_results, testing.scrape_runs, testing.summary_results,
testing.test_subjects
```

Some of those are legitimately service-role-only reference data (`brokers.*`,
`risk_data_type*`). The `testing.*` and `scrape_results` ones are the question.

Also: **`public.recon_probes` has RLS enabled but zero policies** — effectively
deny-all except service_role. Safe, but likely unintentional; worth confirming
it was deliberate rather than a half-finished migration.

### B. Stale tables from previous workflows

Confirmed orphaned:

- **`public.zip_lookup`** (56 rows) — its only consumer was the `zip-lookup`
  edge function, deleted 2026-08-19. Nothing reads or writes it now.

Candidates that *look* stale but were not verified — check for code references
before concluding anything:

```
public.recon_probes, public.removal_jobs, public.removal_status_history,
public.scraper_test_results, public.user_todos, public.user_updates
```

(`monitored_data_points` appears in `00003_core_schema.sql` but does **not**
exist in the live database — an example of why file-based review misleads.)

Note `scraper_test_results` (public) and the `testing.*` tables appear to serve
overlapping purposes — one may supersede the other.

### C. Pilot-scan data model gaps

The pilot-scan flow is the *live* consumer path (`/` redirects to `/pilot-scan`),
so its storage model matters most. Known shape:

- **Phase 1** writes `quickscan.quickscan_dedup_groups` via
  `Phase1Orchestrator.storeResults()`.
- **Phase 2** returns the consolidated profile **in the HTTP response only** —
  storage was deliberately deferred pending this review. It is currently held in
  `sessionStorage.pilotPhase2Result` and **never persisted**.
  Verified: `pilot-scan/index.ts` calls `Phase2Orchestrator.storeResults()` at
  line 364, which sits inside `handlePhase2` (the legacy `dedupGroupId` path,
  line 311). The live path the UI actually uses is `handlePhase2WithGroup`
  (line 407) — it does **not** persist. `quickscan_enrichment` currently holds
  1 row, left over from an old test.
- `risk-summary.tsx` and `pre-profile.tsx` render from the Phase 1 payload only.
  Neither is wired to Phase 2 output yet.

**This is the main design question for the review:** where should the
consolidated profile live, and how does it survive the purge / promote into
`public` on conversion?

Also unresolved: `quickscan.quickscan_enrichment` gained coverage columns
(`services_checked`, `services_unavailable`, `fields_exposed`, `breach_count`)
in `20260819120006`, but nothing writes them yet.

---

## Retention model (shipped, not yet scheduled)

Every `quickscan` table carries `purge_after`:

- anonymous scan → `expires_at` (~30 min)
- signup initiated (email submitted) → +7 days
- authenticated → promoted into `public.user_*`, source rows deleted

`quickscan.purge_expired()` deletes rows past the deadline and returns per-table
counts. It is **deliberately not scheduled** — pg_cron is not enabled. Running it
today would remove 154 of 170 scans. The snippet to schedule it is in
`20260819120003` §5.

---

## Things NOT to redo

- The `public`/`quickscan` split, the promote-on-auth path, and the schema-level
  lockdown were verified end-to-end against production on 2026-08-19 (create →
  pending only, promote → full PII carried across, `anon`/`authenticated` both
  denied, RPC still readable by anon).
- Migration history is reconciled. Do not re-run `migration repair`.
- `docs/schema.md` was updated the same day and reflects the partition
  accurately. It is a reasonable starting map — but see the warning at the top of
  this file about verifying against the live DB.

---

## Known-good reference points

- `docs/schema.md` — table-by-table reference, updated 2026-08-19
- `supabase/migrations/20260819120000..120006` — the partition, with rationale in
  the header comments of each file
- Production project ref: `skhejbzrfptrusskuqoy` (pre-launch; safe to test
  against, but it *is* the real database)
