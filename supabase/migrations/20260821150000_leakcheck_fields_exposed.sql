-- ============================================================================
-- Migration: 20260821150000_leakcheck_fields_exposed.sql
-- Purpose: leakcheck.io's real public endpoint returns which *types* of field
--          leaked per breach (password, ssn, phone, address, ...) — data the
--          previous (broken, Hudson-Rock-targeting) enricher never produced,
--          so this column was dropped from the original design. Now that
--          leakcheck-enricher.ts hits the real endpoint, add it back.
-- ============================================================================

ALTER TABLE quickscan.leakcheck_results
    ADD COLUMN fields_exposed text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN quickscan.leakcheck_results.fields_exposed IS
    'Which data field types leaked (password, ssn, phone, ...) — never the leaked values themselves.';
