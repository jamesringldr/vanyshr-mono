-- ============================================================================
-- Migration: 20260814_testing_schema.sql
-- Purpose: Dedicated `testing` schema for scraper accuracy sweeps, replacing
--          the rotating CSVs in vanyshr-scraper-sequence/context/.
-- ============================================================================
-- Kept out of `public` deliberately: this is data about the 17 (extensible)
-- known test people used to grade scraper accuracy, not real user data, and
-- has no business under prod RLS.
--
-- Grain, table by table:
--   test_subjects          one row per known test person (the search input)
--   scrape_runs             one row per sweep, groups everything below
--   summary_results          one row per broker match returned for a subject's
--                            search, including non-target matches
--   full_profile_results     one row per broker full-profile fetch
--   holehe_results           one row per email checked by holehe
--   leakcheck_results        one row per email checked by leakcheck
--   data_points              one row per atomic scraped value (phone, email,
--                            address, ...), from either a broker or
--                            'ground_truth' -- the normalized layer that makes
--                            per-data-type accuracy a GROUP BY instead of
--                            array-unpacking every query
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS testing;

-- ============================================================================
-- Table: test_subjects
-- ============================================================================

CREATE TABLE testing.test_subjects (
    id          BIGSERIAL PRIMARY KEY,
    search_id   TEXT NOT NULL UNIQUE,   -- e.g. 'ocker' -- matches the existing CSV convention
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    city        TEXT,
    state_id    TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table: scrape_runs
-- ============================================================================

CREATE TABLE testing.scrape_runs (
    id          BIGSERIAL PRIMARY KEY,
    run_id      TEXT NOT NULL UNIQUE,   -- e.g. 'summary.08.14.10.30'
    git_ref     TEXT,                   -- branch/commit the run was made from
    notes       TEXT,
    started_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ
);

-- ============================================================================
-- Table: summary_results
-- ============================================================================

CREATE TABLE testing.summary_results (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id        BIGINT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    target            TEXT NOT NULL,
    is_target_match   BOOLEAN,          -- believed to be the subject vs. an unrelated match
    full_name         TEXT,
    address           TEXT,
    age               INTEGER,
    profile_url       TEXT,
    response_time_ms  INTEGER,
    status            TEXT NOT NULL,
    notes             TEXT,
    raw               JSONB,            -- full SummaryResult.to_dict(), escape hatch
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT summary_results_target_check
        CHECK (target IN ('fps', 'npd', 'anywho', 'zaba')),
    CONSTRAINT summary_results_status_check
        CHECK (status IN ('success', 'partial', 'failed', 'timeout', 'blocked', 'no_results'))
);

CREATE INDEX idx_summary_results_run ON testing.summary_results(run_id);
CREATE INDEX idx_summary_results_subject ON testing.summary_results(subject_id);

-- ============================================================================
-- Table: full_profile_results
-- ============================================================================

CREATE TABLE testing.full_profile_results (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id        BIGINT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    summary_result_id BIGINT REFERENCES testing.summary_results(id) ON DELETE SET NULL,
    target            TEXT NOT NULL,
    response_time_ms  INTEGER,
    status            TEXT NOT NULL,
    notes             TEXT,
    raw               JSONB,            -- the full profile payload, escape hatch
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT full_profile_results_target_check
        CHECK (target IN ('fps', 'npd', 'anywho', 'zaba')),
    CONSTRAINT full_profile_results_status_check
        CHECK (status IN ('success', 'partial', 'failed', 'timeout', 'blocked', 'no_results'))
);

CREATE INDEX idx_full_profile_results_run ON testing.full_profile_results(run_id);
CREATE INDEX idx_full_profile_results_subject ON testing.full_profile_results(subject_id);

-- ============================================================================
-- Table: holehe_results
-- One row per email checked. holehe reports which sites matched, a checked
-- count and a rate-limited count -- not per-site "not found" rows -- so the
-- row grain follows the enricher's actual output (holehe_enricher.py).
-- ============================================================================

CREATE TABLE testing.holehe_results (
    id                     BIGSERIAL PRIMARY KEY,
    run_id                 BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id             BIGINT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    email                  TEXT NOT NULL,
    status                 TEXT NOT NULL,
    services_found         TEXT[],
    services_checked       INTEGER,
    services_rate_limited  INTEGER,
    error                  TEXT,
    created_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT holehe_results_status_check
        CHECK (status IN ('success', 'invalid_email', 'unavailable', 'timeout', 'error'))
);

CREATE INDEX idx_holehe_results_run ON testing.holehe_results(run_id);
CREATE INDEX idx_holehe_results_subject ON testing.holehe_results(subject_id);

-- ============================================================================
-- Table: leakcheck_results
-- One row per email checked. Breaches come back as a list per email
-- (leakcheck_enricher.py); kept as JSONB here rather than split into a child
-- table since a breach has no independent test-accuracy grain of its own.
-- ============================================================================

CREATE TABLE testing.leakcheck_results (
    id              BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id      BIGINT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    status          TEXT NOT NULL,
    breaches        JSONB,            -- [{source, date, year}, ...]
    breach_count    INTEGER,
    fields_exposed  TEXT[],
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT leakcheck_results_status_check
        CHECK (status IN ('success', 'not_found', 'invalid_email', 'rate_limited', 'timeout', 'error'))
);

CREATE INDEX idx_leakcheck_results_run ON testing.leakcheck_results(run_id);
CREATE INDEX idx_leakcheck_results_subject ON testing.leakcheck_results(subject_id);

-- ============================================================================
-- Table: data_points
-- Normalized layer for accuracy grading: one row per atomic scraped value,
-- from either a broker (source = broker name) or the known-correct answer
-- (source = 'ground_truth'). Grading is a self-join on (subject_id,
-- data_type) between the two, rather than a bespoke comparison column per
-- data type. This table exists only to make per-data-point accuracy
-- queryable -- full records live in the *_results tables' `raw` JSONB above.
-- ============================================================================

CREATE TABLE testing.data_points (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,  -- NULL for ground_truth rows
    subject_id        BIGINT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    summary_result_id BIGINT REFERENCES testing.summary_results(id) ON DELETE SET NULL,
    source            TEXT NOT NULL,    -- broker name ('fps', 'npd', 'anywho', 'zaba'), or 'ground_truth'
    data_type         TEXT NOT NULL,
    value             TEXT NOT NULL,
    is_correct        BOOLEAN,          -- graded against the matching ground_truth row; NULL until graded
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT data_points_data_type_check
        CHECK (data_type IN ('phone', 'email', 'address', 'previous_address', 'alias', 'relative', 'age'))
);

CREATE INDEX idx_data_points_subject_type ON testing.data_points(subject_id, data_type);
CREATE INDEX idx_data_points_run ON testing.data_points(run_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Created:
--   - testing schema
--   - 7 tables: test_subjects, scrape_runs, summary_results,
--     full_profile_results, holehe_results, leakcheck_results, data_points
-- Usage:
--   - Seed testing.test_subjects from context/summary- test_profiles.csv
--   - One testing.scrape_runs row per sweep; everything else FKs to it
--   - Per-data-type accuracy: self-join testing.data_points on
--     (subject_id, data_type) between broker rows and 'ground_truth' rows
-- ============================================================================
