-- ============================================================================
-- Migration: 20260815100000_summary_results_match_fields.sql
-- Purpose: Add the fields dedup_engine.py actually matches on to
--          summary_results as real columns, not just inside `raw` JSONB.
-- ============================================================================
-- These were captured in context/summary_results_test_profiles.csv all
-- along; they just didn't make it into the DB write. Comma-joined strings,
-- matching SummaryResult's own representation (data_models.py) rather than
-- normalizing into arrays here.
-- ============================================================================

ALTER TABLE testing.summary_results
    ADD COLUMN IF NOT EXISTS phone               TEXT,
    ADD COLUMN IF NOT EXISTS email                TEXT,
    ADD COLUMN IF NOT EXISTS aliases              TEXT,
    ADD COLUMN IF NOT EXISTS relatives            TEXT,
    ADD COLUMN IF NOT EXISTS previous_addresses   TEXT;
