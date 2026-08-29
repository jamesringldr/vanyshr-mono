-- ============================================================================
-- Migration: 20260829000000_testing_phone_results.sql
-- Purpose: testing.phone_results -- accuracy study for phone-number-keyed
--          lookups (reversephonelookup, usphonebook, anywho, fps), mirroring
--          testing.summary_results' shape exactly, one row per broker result
--          per test subject per sweep.
-- ============================================================================
-- Same grain and columns as testing.summary_results (see
-- 20260814000000_testing_schema.sql / 20260814120000_test_subjects_text_id.sql
-- / 20260815100000_summary_results_match_fields.sql) -- only the `target`
-- check differs, since this study targets phone-search URLs, not the
-- name-search brokers summary_results grades.
--
-- is_target_match here is a loose "does either name contain the other"
-- check for this study only (not a strict match like summary_results) --
-- James spot-checks and corrects these by hand before analysis.
-- ============================================================================

CREATE TABLE testing.phone_results (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id          TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    target              TEXT NOT NULL,
    is_target_match     BOOLEAN,
    full_name           TEXT,
    address             TEXT,
    age                 INTEGER,
    profile_url         TEXT,
    response_time_ms    INTEGER,
    status              TEXT NOT NULL,
    notes               TEXT,
    raw                 JSONB,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    phone               TEXT,
    email               TEXT,
    aliases             TEXT,
    relatives           TEXT,
    previous_addresses  TEXT,

    CONSTRAINT phone_results_target_check
        CHECK (target IN ('reversephonelookup', 'usphonebook', 'anywho', 'fps')),
    CONSTRAINT phone_results_status_check
        CHECK (status IN ('success', 'partial', 'failed', 'timeout', 'blocked', 'no_results'))
);

CREATE INDEX idx_phone_results_run ON testing.phone_results(run_id);
CREATE INDEX idx_phone_results_subject ON testing.phone_results(subject_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
