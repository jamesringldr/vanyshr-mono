-- ============================================================================
-- Migration: 20260814130000_test_subjects_test_group.sql
-- Purpose: Document test_group, added directly via the Supabase SQL editor.
-- ============================================================================
-- Lets a sweep target a subset of test_subjects instead of always running the
-- full list:
--   full  -- every profile
--   core  -- a solid mix of 15
--   quick -- a smaller group of 5
--   me    -- just the operator
--
-- A subject can belong to more than one group at once, hence TEXT[] rather
-- than a single-value column.
--
-- IF NOT EXISTS guards this in case it's re-run; the column already exists
-- live, so this migration is for repo/schema parity, not a fresh apply.
-- ============================================================================

ALTER TABLE testing.test_subjects
    ADD COLUMN IF NOT EXISTS test_group TEXT[];
