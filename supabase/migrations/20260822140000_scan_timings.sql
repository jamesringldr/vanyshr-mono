-- ============================================================================
-- Migration: 20260822140000_scan_timings.sql
-- ============================================================================
-- Description: Timing/count instrumentation for the intro-scan pipeline --
-- purely diagnostic, to see where a scan actually spends its time (reported
-- as slow even just to reach the broker-selection modal, which is only
-- summary-scan's work).
--
-- One row per (quickscan, step[, broker]) rather than one wide row per scan
-- -- matches this schema's existing convention of a normalized table per
-- concern (holehe_results/leakcheck_results are their own tables too, not
-- columns bolted onto consolidated_profile) and stays open to new steps
-- without a migration each time.
--
-- `step` is deliberately NOT a CHECK-constrained enum, matching
-- quickscans.status's own precedent ("open text on purpose... we add values
-- as steps land instead of migrating a CHECK every time") -- this is
-- exactly that kind of evolving instrumentation surface, not a fixed set of
-- broker names.
--
-- Answers the "is the dedup upsert pattern part of the slowness?" question
-- this table exists to investigate: full_profile_fetch times the context.dev
-- fetch+parse only; full_profile_populate times the per-field
-- select-then-insert loop (populateFromBrokerDetail/populateFromSummaryResult)
-- separately, so the two are directly comparable per broker. Despite the
-- name, upsertTyped()/upsertRelative()/etc. are NOT a real SQL upsert (no
-- ON CONFLICT) -- each is a SELECT to find the canonical row followed by a
-- plain INSERT, so a profile with e.g. 46 relatives is 46 sequential
-- SELECT+INSERT round trips, not one batched write. See consolidation.ts.
-- ============================================================================

CREATE TABLE quickscan.scan_timings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id  uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    -- e.g. 'summary_scan_broker', 'summary_scan_total', 'match',
    -- 'full_profile_fetch', 'full_profile_populate', 'full_profile_scan_total',
    -- 'rollup', 'holehe', 'leakcheck'. See consolidation.ts / the edge
    -- functions for exactly where each is recorded.
    step           text NOT NULL,
    -- NULL for steps that aren't scoped to one broker (match, rollup,
    -- *_total, holehe, leakcheck -- enrichment runs against confirmed
    -- emails, not a broker).
    broker         text CHECK (broker IS NULL OR broker IN ('zaba', 'fps', 'npd', 'anywho')),
    duration_ms    integer NOT NULL,
    -- Summary/full-profile steps: how many results/whether it found one.
    -- Match: how many groups formed. Holehe/leakcheck: how many emails checked.
    result_count   integer,
    status         text NOT NULL DEFAULT 'success',
    error          text,
    time_sort      text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.scan_timings IS
    'Diagnostic timing/count per pipeline step, purely for finding where a scan spends its time -- not read by the app.';

CREATE INDEX idx_scan_timings_quickscan ON quickscan.scan_timings (quickscans_id);
CREATE INDEX idx_scan_timings_step ON quickscan.scan_timings (step);

CREATE TRIGGER scan_timings_before_insert BEFORE INSERT ON quickscan.scan_timings
    FOR EACH ROW EXECUTE FUNCTION quickscan.set_time_sort_from_created_at();

ALTER TABLE quickscan.scan_timings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON quickscan.scan_timings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Created: quickscan.scan_timings
-- ============================================================================
