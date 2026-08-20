-- ============================================================================
-- Migration: 20260820120000_pilot_scan_persistence.sql
-- ============================================================================
-- Description: The schema foundation the pilot-scan flow needs in order to
--              persist anything at all. Pure DDL — no function bodies, no data
--              movement, nothing deleted.
--
-- Context (see docs/SCHEMA_REVIEW.md §2, §6, §7):
--   The live pilot-scan path stores nothing. Phase 1 hands
--   Phase1Orchestrator.storeResults() a *text* scan id (`pilot-${sessionId}`),
--   which is inserted straight into quickscan_dedup_groups.quick_scan_id — a
--   `uuid NOT NULL` column. Every insert throws on the cast, the error is
--   caught and `continue`d, and Phase 1 still reports success. Phase 2 never
--   calls storeResults() at all.
--
--   Fixing that requires a real quick_scans row to hang everything off. This
--   migration makes that row addressable and gives the retention chain
--   defaults so writers cannot silently omit them.
-- ============================================================================


-- ============================================================================
-- SECTION 1: Make session_id an upsert target
-- ============================================================================
-- The client fires TWO Phase 1 requests for a single scan — a fast tier (Zaba
-- alone, shown the moment it lands) and a slow tier (FPS/NPD/AnyWho) — both
-- carrying the same sessionId. See apps/app/src/pages/pilot-scan/loading.tsx.
--
-- Whichever request arrives first must CREATE the scan row and the other must
-- JOIN it, with no window in which both create one. A unique constraint on
-- session_id turns that into a single atomic statement:
--
--     INSERT INTO quickscan.quick_scans (session_id, ...) VALUES (...)
--     ON CONFLICT (session_id) DO UPDATE SET updated_at = now()
--     RETURNING id;
--
-- Without the constraint, ON CONFLICT has no arbiter and the two tiers race
-- into two rows.
--
-- Safe to apply as-is: session_id is already de-facto unique in production
-- (170 distinct values across 170 rows, max 1 row per session, none NULL or
-- blank), so this constraint formalises an invariant the data already holds.

ALTER TABLE quickscan.quick_scans
  ADD CONSTRAINT quick_scans_session_id_key UNIQUE (session_id);

-- idx_quick_scans_session was a plain btree on the same single column. The
-- UNIQUE constraint above creates its own index with identical lookup
-- characteristics, so the old one is now pure write overhead.
DROP INDEX IF EXISTS quickscan.idx_quick_scans_session;

COMMENT ON CONSTRAINT quick_scans_session_id_key ON quickscan.quick_scans IS
  'One scan row per client session. Required as the ON CONFLICT arbiter for '
  'the two-tier (fast/slow) Phase 1 upsert — both tier requests carry the same '
  'sessionId and must converge on a single row.';


-- ============================================================================
-- SECTION 2: Retention defaults on the pilot chain
-- ============================================================================
-- Of the five tables purge_expired() sweeps, only pending_profiles had a
-- default on purge_after. The other four relied on every writer remembering to
-- set it — and they do not: Phase1Orchestrator.storeResults() and
-- Phase2Orchestrator.storeResults() both omit it entirely, and 16 of 170
-- quick_scans rows carry NULL.
--
-- NULL is the dangerous value here, not a neutral one. purge_expired() filters
-- on `purge_after IS NOT NULL AND purge_after < NOW()`, so a row that misses
-- its deadline assignment is not caught later — it is retained forever.
-- Defaulting the column converts "writer forgot" from silent immortality into
-- ordinary expiry.
--
-- ⚠️  RETENTION WINDOW — 7 days is a POLICY choice, not a technical one.
--     It matches the pre-existing pending_profiles default, which is the only
--     deadline the schema has ever actually declared and enforced by default.
--     It deliberately does NOT match quick_scans.expires_at (30 minutes):
--     that column describes how long a scan *session* stays valid, and has
--     never governed deletion. A 30-minute purge deadline would destroy the
--     scan before the user could finish the scan → email → return-and-sign-up
--     funnel, which is exactly the flow this data exists to serve.
--
--     Change the interval here if legal or product wants a different number;
--     it is one literal in three places and nothing else depends on the value.

ALTER TABLE quickscan.quick_scans
  ALTER COLUMN purge_after SET DEFAULT (now() + INTERVAL '7 days');

ALTER TABLE quickscan.quickscan_dedup_groups
  ALTER COLUMN purge_after SET DEFAULT (now() + INTERVAL '7 days');

ALTER TABLE quickscan.quickscan_enrichment
  ALTER COLUMN purge_after SET DEFAULT (now() + INTERVAL '7 days');

-- Deliberately NOT backfilled. The 16 existing NULL rows are the converted
-- scans that promote_pending_profile() nulls out on purpose (§4); deciding
-- their fate is a separate call from giving new rows a sane default, and
-- sweeping them in here would silently make 16 real people's pre-auth PII
-- purge-eligible as a side effect of a DDL change.

COMMENT ON COLUMN quickscan.quick_scans.purge_after IS
  'Retention deadline. NULL means KEEP FOREVER — purge_expired() skips NULLs — '
  'so never null this column to "retire" a row. Defaults to now() + 7 days to '
  'match pending_profiles.';


-- ============================================================================
-- SECTION 3: Enforce the pending_profile → quick_scan pointer
-- ============================================================================
-- pending_profiles.source_quick_scan_id has carried no foreign key since it was
-- created (0 rows in pg_constraint with contype='f' on this table). It is the
-- link promote_pending_profile() follows to find the scan a signup came from,
-- so a dangling value there is a silent conversion failure.
--
-- ON DELETE SET NULL rather than CASCADE: when a scan is purged, the person's
-- signup intent is still real and must outlive it. CASCADE here would delete
-- pending profiles as a side effect of routine scan expiry.
--
-- Applies cleanly: all 3 existing rows point at live scans (0 orphans).

ALTER TABLE quickscan.pending_profiles
  ADD CONSTRAINT pending_profiles_source_quick_scan_id_fkey
  FOREIGN KEY (source_quick_scan_id)
  REFERENCES quickscan.quick_scans (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pending_profiles_source_quick_scan_id
  ON quickscan.pending_profiles (source_quick_scan_id)
  WHERE source_quick_scan_id IS NOT NULL;

COMMENT ON CONSTRAINT pending_profiles_source_quick_scan_id_fkey ON quickscan.pending_profiles IS
  'SET NULL, not CASCADE: a purged scan must not take the signup record with '
  'it. promote_pending_profile() already handles a NULL source scan.';


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Added:
--   - UNIQUE (session_id) on quick_scans, dropped the redundant plain index
--   - purge_after DEFAULT now() + 7 days on quick_scans, dedup_groups, enrichment
--   - FK pending_profiles.source_quick_scan_id -> quick_scans(id) ON DELETE SET NULL
--
-- Deliberately NOT here (each needs its own decision, see docs/SCHEMA_REVIEW.md):
--   - §4  promote_pending_profile() setting purge_after = NULL on conversion
--   - §6b quickscan_cost_tracking having no retention column at all
--   - §8  enrichment CASCADE overriding the child's own purge_after
--   - Scheduling purge_expired() — it would remove 154 of 170 scans today
-- ============================================================================
