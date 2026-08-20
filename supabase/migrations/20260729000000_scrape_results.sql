-- ============================================================================
-- Migration: 20260729_scrape_results.sql
-- Purpose: Create scrape_results table for integration testing + debugging
-- ============================================================================
-- Table: scrape_results
-- - Logs actual scraper execution (fps, anywho, zabasearch)
-- - Tracks input, results (summary + full), errors, performance
-- - scrape_id format: target.MM.DD.HH.MM (e.g., anywho.07.29.11.53)
-- - Multiple results per scrape_id if scraper returns multiple people
-- ============================================================================

CREATE TABLE scrape_results (
    -- Primary Key & Identifiers
    id                  BIGSERIAL PRIMARY KEY,
    scrape_id           TEXT NOT NULL,

    -- Execution Context
    target              TEXT NOT NULL,
    mode                TEXT NOT NULL,
    scrape_type         TEXT NOT NULL,

    -- Input & Results (JSON for flexibility)
    input_data          JSONB,
    summary_results     JSONB,
    full_profile_results JSONB,

    -- Error Tracking
    errors              TEXT,
    status              TEXT NOT NULL,

    -- Performance Metrics
    response_time_ms    INTEGER,
    response_bytes      INTEGER,

    -- Audit Trail
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT scrape_results_target_check
        CHECK (target IN ('fps', 'anywho', 'zabasearch')),

    CONSTRAINT scrape_results_mode_check
        CHECK (mode IN ('local', 'prod')),

    CONSTRAINT scrape_results_type_check
        CHECK (scrape_type IN ('summary', 'full')),

    CONSTRAINT scrape_results_status_check
        CHECK (status IN ('success', 'partial', 'failed', 'timeout', 'blocked'))
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Lookup all results from one scrape run
CREATE INDEX idx_scrape_results_scrape_id
    ON scrape_results(scrape_id);

-- Query results by target + mode + time (for analysis/stats)
CREATE INDEX idx_scrape_results_target_mode_created
    ON scrape_results(target, mode, created_at DESC);

-- Find all failed/blocked runs
CREATE INDEX idx_scrape_results_status_created
    ON scrape_results(status, created_at DESC);

-- Find runs for a specific target
CREATE INDEX idx_scrape_results_target_created
    ON scrape_results(target, created_at DESC);

-- ============================================================================
-- Sample Data (Optional — for testing)
-- ============================================================================

-- Insert a successful Anywho scrape with one result
-- INSERT INTO scrape_results (
--     scrape_id, target, mode, scrape_type,
--     input_data, summary_results, status, response_time_ms, response_bytes
-- ) VALUES (
--     'anywho.07.29.11.53',
--     'anywho',
--     'local',
--     'summary',
--     '{"name":"John Doe","city":"San Francisco","state":"CA"}',
--     '{"name":"John Doe","age":"42","lives_in":"San Francisco, CA","phones":["415-555-0123"],"detail_link":"https://www.anywho.com/people/a12345"}',
--     'success',
--     2345,
--     4250
-- );

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Created:
--   - scrape_results table with 14 columns
--   - Constraints for target, mode, scrape_type, status
--   - 4 indexes for common queries
-- Usage:
--   - Insert via scrape_runner.py after each scrape
--   - Query for debugging, stats, and audit trail
--   - All results from one scrape run share scrape_id
-- ============================================================================
