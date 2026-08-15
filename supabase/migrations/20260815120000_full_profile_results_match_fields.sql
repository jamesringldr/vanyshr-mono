-- ============================================================================
-- Migration: 20260815120000_full_profile_results_match_fields.sql
-- Purpose: Add first-class phone/email/relatives/current_address columns to
--          full_profile_results, same reasoning as
--          20260815100000_summary_results_match_fields.sql -- these are
--          exactly the fields the per-broker accuracy analysis needs to
--          query directly, not just have buried in `raw` JSONB.
-- ============================================================================

ALTER TABLE testing.full_profile_results
    ADD COLUMN IF NOT EXISTS current_address  TEXT,
    ADD COLUMN IF NOT EXISTS phone            TEXT,
    ADD COLUMN IF NOT EXISTS email            TEXT,
    ADD COLUMN IF NOT EXISTS relatives        TEXT;
