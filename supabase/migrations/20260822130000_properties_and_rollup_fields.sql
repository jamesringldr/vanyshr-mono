-- ============================================================================
-- Migration: 20260822130000_properties_and_rollup_fields.sql
-- ============================================================================
-- Description: Two gaps found testing the previous migration end-to-end from
-- the app:
--
-- 1. Residential/home-spec data (FPS's beds/baths/sqft/estimated value/
--    equity/last sale) never got a schema decision at all -- it was still
--    JSONB-only in full_profile_results.raw, unlike everything else from
--    the same audit pass. Same reasoning as employment/education: the same
--    property can plausibly be reported by more than one broker (only FPS
--    does today, but the address it describes could be corroborated later),
--    so it gets the same dedup-shaped table, keyed on the address.
--
-- 2. employment/education (tables already existed) and legal_records
--    (columns already existed on full_profile_results) were never rolled
--    into consolidated_profile -- the one row per quickscan the frontend
--    actually reads. Adding jsonb columns here, same pattern relatives
--    already uses (a canonical table AND a jsonb rollup column).
-- ============================================================================


-- ============================================================================
-- Table: properties
-- ============================================================================
-- FPS only today. raw_value/normalized_value are the address this property
-- describes (not a separate identity of its own), so the same property
-- reported by a second broker for the same address dedupes the same way
-- addresses already do.

CREATE TABLE quickscan.properties (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    beds                   text,
    baths                  text,
    square_feet            integer,
    year_built             integer,
    estimated_value        integer,
    estimated_equity       integer,
    last_sale_amount       integer,
    last_sale_date         text,
    occupancy_type         text,
    ownership_type         text,
    land_use               text,
    property_class         text,
    subdivision            text,
    lot_sqft               integer,
    duplicate_of           uuid REFERENCES quickscan.properties(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.properties IS
    'One row per property seen, keyed on the address it describes (raw_value/normalized_value), same dedup shape as everything else.';

CREATE INDEX idx_properties_quickscan ON quickscan.properties (quickscans_id);
CREATE INDEX idx_properties_canonical ON quickscan.properties (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;

CREATE TRIGGER properties_before_insert BEFORE INSERT ON quickscan.properties
    FOR EACH ROW EXECUTE FUNCTION quickscan.set_time_sort_from_created_at();

ALTER TABLE quickscan.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON quickscan.properties FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- consolidated_profile: roll up employment/education/properties/legal_records
-- ============================================================================

ALTER TABLE quickscan.consolidated_profile
    ADD COLUMN employment     jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN education      jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN properties     jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN legal_records  jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN quickscan.consolidated_profile.legal_records IS
    'AnyWho''s own aggregate estimate, taken as-is from full_profile_results -- not deduped against anything (see properties/employment/education, which are, and full_profile_results.legal_records_* columns'' own comment).';


-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Created: quickscan.properties
-- Altered: quickscan.consolidated_profile (+employment, education,
--          properties, legal_records)
-- ============================================================================
