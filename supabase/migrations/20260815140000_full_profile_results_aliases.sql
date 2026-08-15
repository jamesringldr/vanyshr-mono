-- ============================================================================
-- Migration: 20260815140000_full_profile_results_aliases.sql
-- Purpose: aliases column for full_profile_results -- a real, populated field
--          on Zaba's Profile (targets/zaba/models.py) that summary_results
--          already had a column for but full_profile_results didn't.
-- ============================================================================
-- Zaba-only: none of FPS/NPD/AnyWho's Profile dataclasses have an aliases
-- field. Expected NULL for the other three, not a gap.
-- ============================================================================

ALTER TABLE testing.full_profile_results
    ADD COLUMN IF NOT EXISTS aliases TEXT;
