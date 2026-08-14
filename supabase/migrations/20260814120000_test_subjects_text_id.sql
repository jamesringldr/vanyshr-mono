-- ============================================================================
-- Migration: 20260814120000_test_subjects_text_id.sql
-- Purpose: Rework testing.test_subjects to a human-readable TEXT primary key
--          and add ground-truth columns, then propagate the key type change
--          to every table that FKs to it.
-- ============================================================================
-- All 6 tables below are still empty (confirmed before writing this), so this
-- is a clean drop-and-recreate rather than an ALTER ... USING cast -- there is
-- no data to lose or reshape.
--
-- id replaces the old BIGSERIAL id + search_id pair with a single TEXT key,
-- e.g. 'chris-ocker' (lowercase first-last). Set by hand when a subject is
-- added; not auto-generated, since the subject list is small and curated.
-- ============================================================================

DROP TABLE IF EXISTS testing.data_points;
DROP TABLE IF EXISTS testing.leakcheck_results;
DROP TABLE IF EXISTS testing.holehe_results;
DROP TABLE IF EXISTS testing.full_profile_results;
DROP TABLE IF EXISTS testing.summary_results;
DROP TABLE IF EXISTS testing.test_subjects;

-- ============================================================================
-- Table: test_subjects
-- ============================================================================

CREATE TABLE testing.test_subjects (
    id                        TEXT PRIMARY KEY,   -- e.g. 'chris-ocker'
    first_name                TEXT NOT NULL,
    last_name                 TEXT NOT NULL,
    full_name                 TEXT,
    city                      TEXT,
    state_id                  TEXT,
    scan_zip                  TEXT,
    age                       INTEGER,
    current_address           TEXT,
    current_phone             TEXT,
    full_profile_link_anywho  TEXT,
    full_profile_link_zaba    TEXT,
    full_profile_link_fps     TEXT,
    full_profile_link_npd     TEXT,
    notes                     TEXT,
    created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table: summary_results
-- ============================================================================

CREATE TABLE testing.summary_results (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id        TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    target            TEXT NOT NULL,
    is_target_match   BOOLEAN,
    full_name         TEXT,
    address           TEXT,
    age               INTEGER,
    profile_url       TEXT,
    response_time_ms  INTEGER,
    status            TEXT NOT NULL,
    notes             TEXT,
    raw               JSONB,
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
    subject_id        TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    summary_result_id BIGINT REFERENCES testing.summary_results(id) ON DELETE SET NULL,
    target            TEXT NOT NULL,
    response_time_ms  INTEGER,
    status            TEXT NOT NULL,
    notes             TEXT,
    raw               JSONB,
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
-- ============================================================================

CREATE TABLE testing.holehe_results (
    id                     BIGSERIAL PRIMARY KEY,
    run_id                 BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id             TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
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
-- ============================================================================

CREATE TABLE testing.leakcheck_results (
    id              BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id      TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    status          TEXT NOT NULL,
    breaches        JSONB,
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
-- ============================================================================

CREATE TABLE testing.data_points (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT REFERENCES testing.scrape_runs(id) ON DELETE CASCADE,
    subject_id        TEXT NOT NULL REFERENCES testing.test_subjects(id) ON DELETE CASCADE,
    summary_result_id BIGINT REFERENCES testing.summary_results(id) ON DELETE SET NULL,
    source            TEXT NOT NULL,
    data_type         TEXT NOT NULL,
    value             TEXT NOT NULL,
    is_correct        BOOLEAN,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT data_points_data_type_check
        CHECK (data_type IN ('phone', 'email', 'address', 'previous_address', 'alias', 'relative', 'age'))
);

CREATE INDEX idx_data_points_subject_type ON testing.data_points(subject_id, data_type);
CREATE INDEX idx_data_points_run ON testing.data_points(run_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
