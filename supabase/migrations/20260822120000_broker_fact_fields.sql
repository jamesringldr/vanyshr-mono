-- ============================================================================
-- Migration: 20260822120000_broker_fact_fields.sql
-- ============================================================================
-- Description: Fields the full-profile parsers now extract (ported from
-- vanyshr-scraper-lab's recent audit passes) that had nowhere queryable to
-- go until now -- everything below was previously captured only inside
-- full_profile_results.raw.
--
-- Two shapes, matching what each kind of data actually is:
--
-- 1. Descriptive columns on the existing per-type tables (phones, addresses,
--    relatives) -- these are sub-fields of a value that table already dedupes
--    on, not new identities. relatives already set this precedent (kind,
--    relation, age beyond raw_value/normalized_value).
--
-- 2. Two new dedup-shaped tables (employment, education), same shape as
--    phones/addresses/relatives/aliases: raw_value + normalized_value +
--    duplicate_of. These ARE new identities a person can have the same one
--    of reported by more than one broker (the same job, the same school),
--    unlike legal_records below.
--
-- legal_records is neither: AnyWho's county/nationwide counts are each
-- broker's own aggregate estimate, not a discrete named thing a second
-- broker could report the same instance of. Nothing to dedup against, so
-- it stays as plain columns on full_profile_results instead of a table.
-- ============================================================================


-- ============================================================================
-- phones: type/carrier/first-reported, and AnyWho's per-number location
-- ============================================================================

ALTER TABLE quickscan.phones
    ADD COLUMN phone_type     text,
    ADD COLUMN carrier        text,
    ADD COLUMN first_reported text,
    ADD COLUMN location       text;

COMMENT ON COLUMN quickscan.phones.phone_type IS 'Mobile/Landline/Wireless/Voip -- broker-reported, not normalized to a fixed set.';
COMMENT ON COLUMN quickscan.phones.location IS 'AnyWho only: the city/state shown next to this specific number.';


-- ============================================================================
-- addresses: county, recorded-date, and AnyWho's per-address property type
-- ============================================================================

ALTER TABLE quickscan.addresses
    ADD COLUMN county        text,
    ADD COLUMN recorded_date text,
    ADD COLUMN property_type text;

COMMENT ON COLUMN quickscan.addresses.recorded_date IS 'FPS only: "Recorded July 2020" next to a previous address.';
COMMENT ON COLUMN quickscan.addresses.property_type IS 'AnyWho only: land-use sentence next to an address, reduced to just the type ("Single Family Residential").';


-- ============================================================================
-- relatives: gender, birth month
-- ============================================================================

ALTER TABLE quickscan.relatives
    ADD COLUMN gender      text,
    ADD COLUMN birth_month text;

COMMENT ON COLUMN quickscan.relatives.birth_month IS 'FPS only: "(May 1961)" next to a relative/associate''s age.';


-- ============================================================================
-- Table: employment
-- ============================================================================
-- FPS only. kind='current' is #current_employment_section (usually one row);
-- kind='history' is #work_experience_section (Zaba's "Job History" also
-- lands here as kind='history', title/employer split back out of the
-- "<title> at <employer>" string populateFromSummaryResult already joins).

CREATE TABLE quickscan.employment (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    kind                   text NOT NULL DEFAULT 'history' CHECK (kind IN ('current', 'history')),
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    employer               text,
    title                  text,
    since                  text,
    duration               text,
    location               text,
    duplicate_of           uuid REFERENCES quickscan.employment(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.employment IS
    'One row per job seen (current or history). normalized_value keys on employer+title so the same job reported by more than one broker can dedup.';

CREATE INDEX idx_employment_quickscan ON quickscan.employment (quickscans_id);
CREATE INDEX idx_employment_canonical ON quickscan.employment (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: education
-- ============================================================================
-- FPS: school/degree/field_of_study come from separate <dt>/<dd> pairs.
-- Zaba: one raw sentence, not cleanly separable -- school/degree/
-- field_of_study stay NULL, raw_value carries the whole thing.

CREATE TABLE quickscan.education (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    school                 text,
    degree                 text,
    field_of_study         text,
    duplicate_of           uuid REFERENCES quickscan.education(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.education IS
    'One row per school seen. normalized_value keys on school name where known, otherwise the normalized raw sentence (Zaba).';

CREATE INDEX idx_education_quickscan ON quickscan.education (quickscans_id);
CREATE INDEX idx_education_canonical ON quickscan.education (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- full_profile_results: birth_date (Zaba) + legal_records (AnyWho)
-- ============================================================================

ALTER TABLE quickscan.full_profile_results
    ADD COLUMN birth_date                    text,
    ADD COLUMN legal_records_county          text,
    ADD COLUMN legal_records_county_count    integer,
    ADD COLUMN legal_records_nationwide_count integer;

COMMENT ON COLUMN quickscan.full_profile_results.birth_date IS
    'Zaba only, from JSON-LD -- full ISO date or just a year. Not promoted to consolidated_profile; age already covers identity there.';
COMMENT ON COLUMN quickscan.full_profile_results.legal_records_county_count IS
    'AnyWho''s own county-level court-record count estimate -- a broker''s aggregate, not a discrete record, so nothing to dedup against another broker''s count.';


-- ============================================================================
-- time_sort triggers + RLS for the two new tables (same pattern as
-- 20260821140000; that migration's DO $$ loops already ran and can't be
-- retroactively extended, so these are explicit)
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['employment', 'education']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_before_insert BEFORE INSERT ON quickscan.%I '
            'FOR EACH ROW EXECUTE FUNCTION quickscan.set_time_sort_from_created_at()', t, t);
        EXECUTE format('ALTER TABLE quickscan.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY "service_role_all" ON quickscan.%I '
            'FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;


-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Altered: quickscan.phones (+phone_type, carrier, first_reported, location)
--          quickscan.addresses (+county, recorded_date, property_type)
--          quickscan.relatives (+gender, birth_month)
--          quickscan.full_profile_results (+birth_date, legal_records_*)
-- Created: quickscan.employment, quickscan.education
-- ============================================================================
