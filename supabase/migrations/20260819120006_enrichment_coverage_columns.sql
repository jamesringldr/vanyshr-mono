-- ============================================================================
-- Migration: 20260819120006_enrichment_coverage_columns.sql
-- ============================================================================
-- Description: Re-apply 20260813_scraper_sources_and_coverage's changes against
--              quickscan.quickscan_enrichment.
--
-- Why this exists (a migration-ordering artifact, not new work):
--   20260813_scraper_sources_and_coverage.sql alters
--   `public.quickscan_enrichment`. It had never actually been applied to the
--   production database — it was only ever recorded as pending — and by the
--   time that was discovered, 20260819120000 had already moved the table to
--   the `quickscan` schema. Running the original file now fails: there is no
--   public.quickscan_enrichment left to alter.
--
--   The original file is deliberately left untouched. On a fresh database the
--   ordering is correct as written (20260812 creates the table in public →
--   20260813 alters it there → 20260819120000 moves it, carrying these columns
--   along). This migration is what reconciles a database where the move landed
--   first.
--
--   Everything here is IF NOT EXISTS / idempotent, so on a fresh install where
--   20260813 already did the work this is a no-op.
-- ============================================================================

ALTER TABLE quickscan.quickscan_enrichment
  ADD COLUMN IF NOT EXISTS services_checked     INT,
  ADD COLUMN IF NOT EXISTS services_unavailable INT,
  ADD COLUMN IF NOT EXISTS fields_exposed       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS breach_count         INT;

COMMENT ON COLUMN quickscan.quickscan_enrichment.services_checked IS
  'Holehe targets that returned a verdict. Read with services_unavailable: an '
  'empty services_found is only meaningful when services_unavailable is low.';

COMMENT ON COLUMN quickscan.quickscan_enrichment.services_unavailable IS
  'Holehe targets that gave no verdict -- site returned a challenge, or the '
  'module errored. Treating "did not check" as "you are clean" is the worst '
  'available failure direction.';

-- Widen holehe_status to cover the non-verdict outcomes the columns above
-- distinguish.
ALTER TABLE quickscan.quickscan_enrichment
  DROP CONSTRAINT IF EXISTS quickscan_enrichment_holehe_status_check;

ALTER TABLE quickscan.quickscan_enrichment
  ADD CONSTRAINT quickscan_enrichment_holehe_status_check
  CHECK (holehe_status IN (
    'pending', 'success', 'error', 'failed', 'no_auth', 'timeout',
    'invalid_email', 'unavailable', 'no_results'
  ));


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- quickscan.quickscan_enrichment gains: services_checked, services_unavailable,
-- fields_exposed, breach_count; holehe_status constraint widened.
-- ============================================================================
