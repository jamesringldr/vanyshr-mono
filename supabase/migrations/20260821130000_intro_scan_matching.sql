-- ============================================================================
-- Migration: 20260821130000_intro_scan_matching.sql
-- ============================================================================
-- Description: Summary-scan candidates, cross-broker identity matching, and
-- full-profile results for the intro-scan sequence. Children of
-- quickscan.quickscans (20260821120000).
--
-- Grain, table by table:
--   match_groups          one row per believed-same-person cluster within a
--                          single quickscan. Groups a mix of summary_results
--                          rows (fps/npd/anywho, not yet full-scraped) and
--                          full_profile_results rows (zaba, already full).
--   summary_results        one row per fps/npd/anywho candidate returned for
--                          the quickscan's search. Zaba never appears here --
--                          it has no separate summary endpoint; its search
--                          results already carry full-profile-grade data, so
--                          it writes straight to full_profile_results below.
--   full_profile_results    one row per target's full profile data for the
--                          quickscan. summary_result_id is NULL for zaba
--                          (bypassed summary_results entirely) and set for
--                          fps/npd/anywho once matched + scraped.
--
-- Selection: quickscans.selected_full_profile_result_id points at the row the
-- user actually picked in the modal -- always a zaba full_profile_results row,
-- since that's the only target with data ready at selection time. Its
-- match_group_id (if any) tells the backend which fps/npd/anywho
-- summary_results rows to run the full-profile scrape against next.
--
-- match_outcome captures the two "not found" paths distinctly, since they
-- mean different things operationally: 'rejected' is the user turning down
-- data we did surface (possible matching/coverage miss); 'no_data' is zero
-- results from every target (no public footprint found).
-- ============================================================================


-- ============================================================================
-- Table: match_groups
-- ============================================================================

CREATE TABLE quickscan.match_groups (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    -- Which fields agreed across the grouped rows and how strongly, e.g.
    -- {"name": true, "address": true, "age": false}. Shape is the matcher's
    -- to define; this is a debugging/audit trail, not a queried contract.
    matched_on    jsonb,
    confidence    numeric,
    time_sort     text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.match_groups IS
    'One row per believed-same-person cluster within a quickscan. Members are '
    'summary_results and/or full_profile_results rows carrying this id.';

COMMENT ON COLUMN quickscan.match_groups.matched_on IS
    'Which fields drove the match and how, for debugging false merges. Not a fixed contract.';

COMMENT ON COLUMN quickscan.match_groups.confidence IS
    'Matcher-assigned confidence score. Scale is the matcher''s to define.';

COMMENT ON COLUMN quickscan.match_groups.time_sort IS
    'America/Chicago mm.dd.yy-hh.mm for reading rows. ORDER BY created_at, not this.';

CREATE INDEX idx_match_groups_quickscan
    ON quickscan.match_groups (quickscans_id);


-- ============================================================================
-- Table: summary_results
-- ============================================================================

CREATE TABLE quickscan.summary_results (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id       uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    target              text NOT NULL CHECK (target IN ('fps', 'npd', 'anywho')),
    match_group_id      uuid REFERENCES quickscan.match_groups(id) ON DELETE SET NULL,
    -- Full-profile URL for this candidate. What the full-profile scrape for
    -- this target hits once this row's match_group is selected/confirmed.
    profile_url         text,
    full_name           text,
    age                 integer,
    address             text,
    phone               text,
    email               text,
    aliases             text,
    relatives           text,
    previous_addresses  text,
    status              text NOT NULL CHECK (status IN (
                             'success', 'partial', 'failed',
                             'timeout', 'blocked', 'no_results'
                         )),
    raw                 jsonb,
    time_sort           text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.summary_results IS
    'One row per fps/npd/anywho candidate returned for a quickscan search. '
    'Zaba is never here -- see full_profile_results.';

COMMENT ON COLUMN quickscan.summary_results.profile_url IS
    'Full-profile URL for this candidate; fetched once matched + selected.';

COMMENT ON COLUMN quickscan.summary_results.status IS
    'Per-target scrape outcome. no_results is a normal outcome, not an error.';

COMMENT ON COLUMN quickscan.summary_results.time_sort IS
    'America/Chicago mm.dd.yy-hh.mm for reading rows. ORDER BY created_at, not this.';

CREATE INDEX idx_summary_results_quickscan
    ON quickscan.summary_results (quickscans_id);

CREATE INDEX idx_summary_results_match_group
    ON quickscan.summary_results (match_group_id);


-- ============================================================================
-- Table: full_profile_results
-- ============================================================================

CREATE TABLE quickscan.full_profile_results (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id       uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    target              text NOT NULL CHECK (target IN ('zaba', 'fps', 'npd', 'anywho')),
    -- NULL for zaba (bypasses summary_results entirely). Set for fps/npd/anywho
    -- once matched + full-profile scraped.
    summary_result_id   uuid REFERENCES quickscan.summary_results(id) ON DELETE SET NULL,
    match_group_id      uuid REFERENCES quickscan.match_groups(id) ON DELETE SET NULL,
    full_name           text,
    age                 integer,
    current_address     text,
    phone               text,
    email               text,
    aliases             text,
    relatives           text,
    previous_addresses  text,
    status              text NOT NULL CHECK (status IN (
                             'success', 'partial', 'failed',
                             'timeout', 'blocked', 'no_results'
                         )),
    raw                 jsonb,
    time_sort           text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.full_profile_results IS
    'One row per target''s full profile data for a quickscan. Zaba rows are '
    'written directly from its search results, bypassing summary_results.';

COMMENT ON COLUMN quickscan.full_profile_results.summary_result_id IS
    'NULL for zaba (no summary stage). Set for fps/npd/anywho after matching.';

COMMENT ON COLUMN quickscan.full_profile_results.time_sort IS
    'America/Chicago mm.dd.yy-hh.mm for reading rows. ORDER BY created_at, not this.';

CREATE INDEX idx_full_profile_results_quickscan
    ON quickscan.full_profile_results (quickscans_id);

CREATE INDEX idx_full_profile_results_match_group
    ON quickscan.full_profile_results (match_group_id);

CREATE INDEX idx_full_profile_results_summary_result
    ON quickscan.full_profile_results (summary_result_id);


-- ============================================================================
-- quickscans: selection + not-found outcome
-- ============================================================================

ALTER TABLE quickscan.quickscans
    ADD COLUMN selected_full_profile_result_id
        uuid REFERENCES quickscan.full_profile_results(id) ON DELETE SET NULL,
    ADD COLUMN match_outcome
        text CHECK (match_outcome IN ('matched', 'rejected', 'no_data'));

COMMENT ON COLUMN quickscan.quickscans.selected_full_profile_result_id IS
    'The card the user picked in the selection modal. Always a zaba row -- '
    'the only target with data ready at selection time.';

COMMENT ON COLUMN quickscan.quickscans.match_outcome IS
    'NULL while unresolved. matched = selection made. rejected = user turned '
    'down zaba and the cross-broker fallback both. no_data = nothing came '
    'back from any target.';


-- ============================================================================
-- time_sort triggers (BEFORE INSERT, same pattern as quickscans)
-- ============================================================================

CREATE OR REPLACE FUNCTION quickscan.match_groups_before_insert()
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

CREATE TRIGGER match_groups_before_insert
    BEFORE INSERT ON quickscan.match_groups
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.match_groups_before_insert();


CREATE OR REPLACE FUNCTION quickscan.summary_results_before_insert()
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

CREATE TRIGGER summary_results_before_insert
    BEFORE INSERT ON quickscan.summary_results
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.summary_results_before_insert();


CREATE OR REPLACE FUNCTION quickscan.full_profile_results_before_insert()
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

CREATE TRIGGER full_profile_results_before_insert
    BEFORE INSERT ON quickscan.full_profile_results
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.full_profile_results_before_insert();


-- ============================================================================
-- RLS: service_role only, defence in depth (matches Section 6 of
-- 20260819120000_quickscan_schema.sql -- the schema-level REVOKE/GRANT in
-- that migration is the primary lock; this just extends the same posture to
-- these new tables)
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'match_groups',
        'summary_results',
        'full_profile_results'
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
-- Created:
--   - quickscan.match_groups, quickscan.summary_results,
--     quickscan.full_profile_results
--   - quickscans.selected_full_profile_result_id, quickscans.match_outcome
-- Not done here (later steps):
--   - No scrapers wired to write these tables yet
--   - No matching function implemented yet
--   - deepest_page = 'select_profile' is an application-level value, no
--     schema change needed
-- ============================================================================
