-- ============================================================================
-- Migration: 20260815130000_full_profile_results_more_fields.sql
-- Purpose: Fields that were sitting in `raw` unpromoted (age, full_name,
--          date_of_birth, previous_addresses), plus columns for property
--          and associate data that wasn't being extracted at all until now
--          (fps_full_profile_scraper.py / npd_full_profile_scraper.py).
-- ============================================================================
-- Property fields are FPS-only (the only broker with residence-detail data);
-- associates are FPS/NPD (AnyWho's profile page has neither). Both are
-- expected to be NULL for brokers that don't carry that data -- not a bug.
-- ============================================================================

ALTER TABLE testing.full_profile_results
    ADD COLUMN IF NOT EXISTS age                      INTEGER,
    ADD COLUMN IF NOT EXISTS full_name                TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth             TEXT,
    ADD COLUMN IF NOT EXISTS previous_addresses        TEXT,
    ADD COLUMN IF NOT EXISTS associates                TEXT,
    ADD COLUMN IF NOT EXISTS resided_since             TEXT,
    ADD COLUMN IF NOT EXISTS property_beds             TEXT,
    ADD COLUMN IF NOT EXISTS property_baths            TEXT,
    ADD COLUMN IF NOT EXISTS property_sqft             INTEGER,
    ADD COLUMN IF NOT EXISTS property_year_built       INTEGER,
    ADD COLUMN IF NOT EXISTS property_estimated_value  INTEGER,
    ADD COLUMN IF NOT EXISTS property_county           TEXT;
