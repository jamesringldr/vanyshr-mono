-- ============================================================================
-- Migration: 20260815110000_drop_zaba_profile_link.sql
-- Purpose: Drop full_profile_link_zaba -- Zaba has no full-profile page to
--          link to, unlike fps/npd/anywho.
-- ============================================================================

ALTER TABLE testing.test_subjects
    DROP COLUMN IF EXISTS full_profile_link_zaba;
