-- ============================================================================
-- Migration: 20260821140000_full_profile_tables.sql
-- ============================================================================
-- Description: Per-data-type tables for the intro-scan full-profile stage,
-- a per-quickscan consolidation rollup, and Holehe/Leakcheck enrichment
-- results. Children of quickscan.quickscans (20260821120000).
--
-- Populated once, by the full-profile-scan step (post-selection) — not by
-- summary-scan, which only sees unmatched/rejected candidates too. Writing
-- per-type rows for every candidate at summary time would put the wrong
-- person's phone number in a real user's rollup.
--
-- Every type table shares the same dedup shape: raw_value (as scraped) +
-- normalized_value (canonical form for comparison) + duplicate_of (nullable
-- self-FK — NULL is the canonical/first-seen row, non-null rows point at it).
-- Rows are never collapsed away; every raw value seen keeps its own row, so
-- provenance survives for exactly the kind of bug that motivated this design
-- (a broker's truncated/corrupted value needs to stay visible next to the
-- correct one, not silently lose to whichever inserted first).
--
-- emails is the one table with extra machinery: source (broker vs
-- user-added), mx_valid (plausibility check, not full deliverability), and
-- confirmed (drives consolidated_profile.emails and gates Holehe/Leakcheck).
-- ============================================================================


-- ============================================================================
-- Table: phones
-- ============================================================================

CREATE TABLE quickscan.phones (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    duplicate_of           uuid REFERENCES quickscan.phones(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.phones IS
    'One row per raw phone value seen. NULL duplicate_of = canonical/first-seen for its normalized_value within the quickscan.';

CREATE INDEX idx_phones_quickscan ON quickscan.phones (quickscans_id);
CREATE INDEX idx_phones_canonical ON quickscan.phones (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: addresses
-- ============================================================================

CREATE TABLE quickscan.addresses (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    is_current             boolean NOT NULL DEFAULT false,
    duplicate_of           uuid REFERENCES quickscan.addresses(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.addresses IS
    'One row per raw address value seen. normalized_value is exact-match normalization (lowercased, punctuation stripped) — not fuzzy/abbreviation-aware.';

CREATE INDEX idx_addresses_quickscan ON quickscan.addresses (quickscans_id);
CREATE INDEX idx_addresses_canonical ON quickscan.addresses (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: relatives
-- ============================================================================

CREATE TABLE quickscan.relatives (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    kind                   text NOT NULL DEFAULT 'relative' CHECK (kind IN ('relative', 'associate')),
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    -- Structured detail exists only from a full-profile detail page
    -- (BrokerDetailProfile). Summary-stage names carry neither.
    relation               text,
    age                    integer,
    duplicate_of           uuid REFERENCES quickscan.relatives(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.relatives IS
    'One row per named relative/associate seen. normalized_value is the normalized name.';

CREATE INDEX idx_relatives_quickscan ON quickscan.relatives (quickscans_id);
CREATE INDEX idx_relatives_canonical ON quickscan.relatives (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: aliases
-- ============================================================================

CREATE TABLE quickscan.aliases (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    full_profile_result_id uuid NOT NULL REFERENCES quickscan.full_profile_results(id) ON DELETE CASCADE,
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    duplicate_of           uuid REFERENCES quickscan.aliases(id) ON DELETE SET NULL,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.aliases IS
    'One row per alias/AKA name seen.';

CREATE INDEX idx_aliases_quickscan ON quickscan.aliases (quickscans_id);
CREATE INDEX idx_aliases_canonical ON quickscan.aliases (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: emails
-- ============================================================================

CREATE TABLE quickscan.emails (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id          uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    -- Nullable only here: a user-added email has no broker source.
    full_profile_result_id uuid REFERENCES quickscan.full_profile_results(id) ON DELETE SET NULL,
    source                 text NOT NULL DEFAULT 'broker' CHECK (source IN ('broker', 'user')),
    raw_value              text NOT NULL,
    normalized_value       text NOT NULL,
    duplicate_of           uuid REFERENCES quickscan.emails(id) ON DELETE SET NULL,
    -- NULL = not checked / check errored (never treated as failure).
    -- Format + MX-record existence only — not full mailbox deliverability.
    mx_valid               boolean,
    -- Drives consolidated_profile.emails and gates Holehe/Leakcheck.
    -- Defaults true unless the MX check actively failed.
    confirmed              boolean NOT NULL DEFAULT true,
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.emails IS
    'One row per raw email value seen or user-added. confirmed = currently in the rollup / eligible for enrichment.';

CREATE INDEX idx_emails_quickscan ON quickscan.emails (quickscans_id);
CREATE INDEX idx_emails_canonical ON quickscan.emails (quickscans_id, normalized_value) WHERE duplicate_of IS NULL;


-- ============================================================================
-- Table: consolidated_profile
-- ============================================================================
-- One row per quickscan (1:1 — PK is quickscans_id itself). Built by one
-- explicit consolidation step, not kept live-synced with every per-type
-- insert — except emails.confirmed, which recomputes just the emails array
-- on every add/remove (see docs/intro-scan/journal.md).

CREATE TABLE quickscan.consolidated_profile (
    quickscans_id       uuid PRIMARY KEY REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    match_group_id       uuid REFERENCES quickscan.match_groups(id) ON DELETE SET NULL,
    full_name            text,
    age                  integer,
    primary_address      text,
    previous_addresses   text[] NOT NULL DEFAULT '{}',
    phones               text[] NOT NULL DEFAULT '{}',
    emails               text[] NOT NULL DEFAULT '{}',
    relatives            jsonb NOT NULL DEFAULT '[]',
    aliases              text[] NOT NULL DEFAULT '{}',
    -- Populated after Holehe/Leakcheck finish; NULL/empty until then.
    services_found       text[] NOT NULL DEFAULT '{}',
    breaches             jsonb NOT NULL DEFAULT '[]',
    breach_count         integer NOT NULL DEFAULT 0,
    time_sort            text NOT NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.consolidated_profile IS
    'The render-ready rollup for one quickscan. Built by full-profile-scan; emails array kept in sync by manage-emails; services_found/breaches by the enrichment step.';


-- ============================================================================
-- Table: holehe_results
-- ============================================================================

CREATE TABLE quickscan.holehe_results (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id    uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    email            text NOT NULL,
    status           text NOT NULL CHECK (status IN (
                          'success', 'invalid_email', 'unavailable', 'timeout', 'error'
                      )),
    services_found   text[] NOT NULL DEFAULT '{}',
    services_checked integer,
    error            text,
    time_sort        text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.holehe_results IS
    'One row per email checked against Holehe.';

CREATE INDEX idx_holehe_results_quickscan ON quickscan.holehe_results (quickscans_id);


-- ============================================================================
-- Table: leakcheck_results
-- ============================================================================

CREATE TABLE quickscan.leakcheck_results (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    email         text NOT NULL,
    status        text NOT NULL CHECK (status IN (
                       'success', 'not_found', 'invalid_email', 'rate_limited', 'timeout', 'error'
                   )),
    breaches      jsonb NOT NULL DEFAULT '[]',
    breach_count  integer NOT NULL DEFAULT 0,
    error         text,
    time_sort     text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.leakcheck_results IS
    'One row per email checked against Leakcheck.';

CREATE INDEX idx_leakcheck_results_quickscan ON quickscan.leakcheck_results (quickscans_id);


-- ============================================================================
-- full_profile_results: drop the wide columns now that per-type tables own
-- this data. Nothing reads them yet (no frontend wiring), so this is safe;
-- the columns were only ever written by summary-scan's Zaba path, which is
-- updated alongside this migration to stop writing them and rely on `raw`.
-- ============================================================================

ALTER TABLE quickscan.full_profile_results
    DROP COLUMN full_name,
    DROP COLUMN age,
    DROP COLUMN current_address,
    DROP COLUMN phone,
    DROP COLUMN email,
    DROP COLUMN aliases,
    DROP COLUMN relatives,
    DROP COLUMN previous_addresses;


-- ============================================================================
-- time_sort triggers (BEFORE INSERT, same pattern as prior migrations)
-- ============================================================================

CREATE OR REPLACE FUNCTION quickscan.set_time_sort_from_created_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;
    NEW.time_sort := to_char(
        NEW.created_at AT TIME ZONE 'America/Chicago',
        'MM.DD.YY-HH24.MI'
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION quickscan.set_time_sort_from_created_at() IS
    'Shared BEFORE INSERT trigger body for every quickscan.* child table''s time_sort column.';

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'phones', 'addresses', 'relatives', 'aliases', 'emails',
        'consolidated_profile', 'holehe_results', 'leakcheck_results'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_before_insert BEFORE INSERT ON quickscan.%I '
            'FOR EACH ROW EXECUTE FUNCTION quickscan.set_time_sort_from_created_at()', t, t);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION quickscan.consolidated_profile_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER consolidated_profile_set_updated_at
    BEFORE UPDATE ON quickscan.consolidated_profile
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.consolidated_profile_set_updated_at();


-- ============================================================================
-- RLS: service_role only, defence in depth (matches 20260821130000)
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'phones', 'addresses', 'relatives', 'aliases', 'emails',
        'consolidated_profile', 'holehe_results', 'leakcheck_results'
    ]
    LOOP
        EXECUTE format('ALTER TABLE quickscan.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY "service_role_all" ON quickscan.%I '
            'FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;


-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Created: quickscan.{phones,addresses,relatives,aliases,emails},
--          quickscan.consolidated_profile, quickscan.holehe_results,
--          quickscan.leakcheck_results
-- Altered: quickscan.full_profile_results (dropped 8 wide columns — see
--          summary-scan/index.ts and full-profile-scan/index.ts)
-- Not done here: no residence/property table — no current scraper populates
--          BrokerDetailProfile.properties (its own type comment says so);
--          add it when a parser actually produces that data.
-- ============================================================================
