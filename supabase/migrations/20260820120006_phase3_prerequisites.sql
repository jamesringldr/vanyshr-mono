-- ============================================================================
-- Migration: 20260820120006_phase3_prerequisites.sql
-- ============================================================================
-- Description: The two schema changes Phase 3 cannot exist without.
--              See docs/SCAN_SEQUENCE.md §6.
--
-- The scan is being resequenced into three phases (summary sweep → full
-- profile → enrichment). Both changes below are prerequisites: without them the
-- new phase fails at the database, and in one case it fails SILENTLY.
-- ============================================================================


-- ============================================================================
-- SECTION 1: Let cost tracking record a third phase
-- ============================================================================
-- quickscan_cost_tracking_phase_check currently permits only phase 1 and 2.
-- Every Phase 3 insert would be rejected outright with a check violation.
--
-- This is the same failure shape as the leakcheck_status='no_results' bug fixed
-- in 20260820120005's lineage: cost tracking is deliberately best-effort, so a
-- rejected insert is logged and swallowed rather than surfaced. The result is
-- enrichment that runs, costs money, and records nothing -- with no error
-- anywhere the operator would look.
--
-- Widened rather than dropped: the constraint still catches a typo'd phase, and
-- an unbounded integer here would let a bad caller write phase 47 unnoticed.

ALTER TABLE quickscan.quickscan_cost_tracking
  DROP CONSTRAINT IF EXISTS quickscan_cost_tracking_phase_check;

ALTER TABLE quickscan.quickscan_cost_tracking
  ADD CONSTRAINT quickscan_cost_tracking_phase_check
  CHECK (phase = ANY (ARRAY[1, 2, 3]));

COMMENT ON COLUMN quickscan.quickscan_cost_tracking.phase IS
  '1 = summary sweep, 2 = full-profile scrape, 3 = enrichment '
  '(holehe/leakcheck). See docs/SCAN_SEQUENCE.md.';


-- ============================================================================
-- SECTION 2: Make enrichment rows addressable for staged writes
-- ============================================================================
-- quickscan_enrichment has no unique key. Under the current single-shot write
-- that merely allows duplicates -- four Phase 2 calls against one scan produced
-- four dedup groups and four enrichment rows on 2026-08-20.
--
-- Under the new sequence it becomes a correctness problem. Phase 2 INSERTs the
-- row (emails found, consolidated profile, holehe/leakcheck still 'pending')
-- and Phase 3 UPDATEs it in place with services, breaches and coverage. Without
-- a unique key Phase 3 has no deterministic target: a retry forks a second row
-- and the scan ends up with two partial enrichments and no way to tell which is
-- authoritative.
--
-- (quick_scan_id, dedup_group_id) is the natural key: one enrichment per
-- selected person per scan. Both columns are already NOT NULL.
--
-- Applies cleanly: 5 existing rows, 0 duplicate pairs, 0 NULL dedup_group_id.

ALTER TABLE quickscan.quickscan_enrichment
  ADD CONSTRAINT quickscan_enrichment_scan_group_key
  UNIQUE (quick_scan_id, dedup_group_id);

COMMENT ON CONSTRAINT quickscan_enrichment_scan_group_key ON quickscan.quickscan_enrichment IS
  'One enrichment per selected person per scan. Required as the ON CONFLICT '
  'target for the staged Phase 2 (insert) / Phase 3 (update) write split, so a '
  'retried Phase 3 updates rather than forking a second partial row.';


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Added:
--   - phase CHECK widened to [1,2,3] on quickscan_cost_tracking
--   - UNIQUE (quick_scan_id, dedup_group_id) on quickscan_enrichment
--
-- Deliberately NOT here:
--   - No new columns. quickscan_enrichment already carries a status and
--     timestamp per enrichment source (emails_extracted_at, holehe_status /
--     holehe_checked_at, leakcheck_status / leakcheck_checked_at,
--     completed_at). The schema already models staged writes; only the code
--     needs to catch up.
-- ============================================================================
