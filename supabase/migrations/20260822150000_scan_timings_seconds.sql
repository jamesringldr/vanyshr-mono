-- ============================================================================
-- Migration: 20260822150000_scan_timings_seconds.sql
-- ============================================================================
-- Description: duration_ms -> duration_s. Renamed, not just reinterpreted --
-- a column called duration_ms holding seconds would be a landmine for
-- whoever queries this table next. numeric(10,3) keeps millisecond
-- precision (fractional seconds), just in the more readable unit for a
-- table meant to be eyeballed in SQL while chasing down slow scans.
-- ============================================================================

ALTER TABLE quickscan.scan_timings
    ALTER COLUMN duration_ms TYPE numeric(10,3) USING (duration_ms / 1000.0);

ALTER TABLE quickscan.scan_timings
    RENAME COLUMN duration_ms TO duration_s;

COMMENT ON COLUMN quickscan.scan_timings.duration_s IS
    'Seconds, fractional (was duration_ms/milliseconds before this migration).';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Altered: quickscan.scan_timings (duration_ms -> duration_s, integer ms ->
--          numeric(10,3) seconds)
-- ============================================================================
