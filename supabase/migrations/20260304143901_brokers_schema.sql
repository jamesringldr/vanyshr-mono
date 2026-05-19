-- ============================================================================
-- Migration: 20260304_brokers_schema.sql
-- ============================================================================
-- Creates the `brokers` schema and moves all broker data out of `public`.
--
-- Actions:
--   1. Drop FK constraints from public.exposures + public.user_todos → public.brokers
--   2. Drop public.broker_category_map, public.broker_categories, public.brokers
--   3. Create brokers schema
--   4. Create brokers.brokers         — full broker registry
--   5. Create brokers.broker_stats    — manually curated per-request-type metrics
--   6. Create brokers.broker_vanyshr_stats — placeholder for live app outcome data
--   7. Re-add FKs on exposures + user_todos pointing to brokers.brokers
--   8. Indexes, grants, updated_at triggers
-- ============================================================================


-- ============================================================================
-- SECTION 1: Drop inbound FKs to public.brokers
-- ============================================================================

ALTER TABLE public.exposures
    DROP CONSTRAINT IF EXISTS exposures_broker_id_fkey;

ALTER TABLE public.user_todos
    DROP CONSTRAINT IF EXISTS user_todos_broker_id_fkey;


-- ============================================================================
-- SECTION 2: Drop old public broker tables
-- ============================================================================

DROP TABLE IF EXISTS public.broker_category_map CASCADE;
DROP TABLE IF EXISTS public.broker_categories    CASCADE;
DROP TABLE IF EXISTS public.brokers              CASCADE;


-- ============================================================================
-- SECTION 3: Create brokers schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS brokers;


-- ============================================================================
-- SECTION 4: brokers.brokers — broker registry
-- ============================================================================

CREATE TABLE brokers.brokers (
    id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name                          TEXT        NOT NULL,
    parent_broker_id              UUID        REFERENCES brokers.brokers(id) ON DELETE SET NULL,
    -- NULL parent_broker_id = top-level broker; set = child / sub-brand

    -- Classification
    type                          TEXT        NOT NULL
                                  CHECK (type IN (
                                      'people_search',
                                      'background_check',
                                      'marketing_list',
                                      'data_aggregator',
                                      'financial',
                                      'employment',
                                      'public_records'
                                  )),
    data_types                    TEXT[]      NOT NULL DEFAULT '{}'
                                  CHECK (data_types <@ ARRAY[
                                      'identity', 'real_estate', 'employment',
                                      'vehicle', 'voter', 'credit', 'phone_records'
                                  ]::text[]),
    -- 0 = worst offenders (remove first), 3 = lowest priority
    removal_priority              SMALLINT    NOT NULL DEFAULT 2
                                  CHECK (removal_priority BETWEEN 0 AND 3),

    -- Scan & automation
    scrape_type                   TEXT
                                  CHECK (scrape_type IN ('web_form', 'api', 'email', 'manual', 'none')),
    opt_out_type                  TEXT
                                  CHECK (opt_out_type IN ('web_form', 'email', 'automated_api', 'manual')),

    -- URLs & contact
    company_url                   TEXT,
    privacy_policy_url            TEXT,
    opt_out_url                   TEXT,
    opt_out_email                 TEXT,
    requires_email_verification   BOOLEAN     NOT NULL DEFAULT false,

    -- Manual removal guidance
    removal_directions            TEXT,

    -- Research notes
    collection_practices_comments TEXT,
    reporting_comments            TEXT,

    -- Lifecycle
    is_active                     BOOLEAN     NOT NULL DEFAULT true,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  brokers.brokers IS 'Broker registry — all known data brokers Vanyshr monitors and targets for removal.';
COMMENT ON COLUMN brokers.brokers.parent_broker_id       IS 'NULL = top-level broker. Set = child / sub-brand of the referenced parent.';
COMMENT ON COLUMN brokers.brokers.data_types             IS 'Data categories this broker exposes. Subset of: identity, real_estate, employment, vehicle, voter, credit, phone_records.';
COMMENT ON COLUMN brokers.brokers.removal_priority       IS '0 = worst offenders (removed first), 3 = lowest priority.';
COMMENT ON COLUMN brokers.brokers.scrape_type            IS 'Method used by Vanyshr scanners to detect user data presence.';
COMMENT ON COLUMN brokers.brokers.opt_out_type           IS 'Automation method used for removal submissions.';


-- ============================================================================
-- SECTION 5: brokers.broker_stats — manually curated request-type metrics
-- ============================================================================
-- One row per (broker, request_type). UNIQUE enforces clean upserts.
-- When live app data is ready, broker_vanyshr_stats will feed into this table.

CREATE TABLE brokers.broker_stats (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id       UUID        NOT NULL REFERENCES brokers.brokers(id) ON DELETE CASCADE,
    request_type    TEXT        NOT NULL
                    CHECK (request_type IN ('delete', 'data_present', 'data_shared', 'opt_out')),

    -- Ratios: 0.0000 – 1.0000
    approval_ratio  NUMERIC(5,4) CHECK (approval_ratio BETWEEN 0 AND 1),
    denial_ratio    NUMERIC(5,4) CHECK (denial_ratio   BETWEEN 0 AND 1),
    avg_days        NUMERIC(6,2) CHECK (avg_days >= 0),

    -- How many data points these ratios are based on (useful for weighting)
    sample_size     INTEGER      NOT NULL DEFAULT 0 CHECK (sample_size >= 0),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (broker_id, request_type)
);

COMMENT ON TABLE  brokers.broker_stats IS 'Manually curated removal outcome metrics per broker per request type. Will be updated by broker_vanyshr_stats aggregation once live data pipeline is built.';
COMMENT ON COLUMN brokers.broker_stats.sample_size IS 'Number of data points behind these ratios. Used for confidence weighting when merging with live app stats.';


-- ============================================================================
-- SECTION 6: brokers.broker_vanyshr_stats — live app outcome placeholder
-- ============================================================================
-- Scaffold only. Logic to aggregate into broker_stats is deferred.
-- Each row = one removal/scan outcome recorded by the Vanyshr app.

CREATE TABLE brokers.broker_vanyshr_stats (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id          UUID        NOT NULL REFERENCES brokers.brokers(id) ON DELETE CASCADE,
    user_profile_id    UUID        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    request_type       TEXT        NOT NULL
                       CHECK (request_type IN ('delete', 'data_present', 'data_shared', 'opt_out')),
    outcome            TEXT
                       CHECK (outcome IN ('approved', 'denied', 'pending', 'no_record')),
    days_to_resolution NUMERIC(6,2) CHECK (days_to_resolution >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- TODO: when live data pipeline is ready —
    --   1. Add a scheduled job / edge function that aggregates rows from this table
    --      into broker_stats (weighted merge with existing sample_size).
    --   2. Add a `synced_to_broker_stats_at` column here to track what has been rolled up.
    --   3. Consider partitioning by created_at once volume grows.
);

COMMENT ON TABLE brokers.broker_vanyshr_stats IS 'Placeholder: raw per-removal outcome events from the Vanyshr app. Future pipeline will aggregate these into broker_stats.approval_ratio / denial_ratio / avg_days.';


-- ============================================================================
-- SECTION 7: Re-add FKs from public tables to brokers.brokers
-- ============================================================================

ALTER TABLE public.exposures
    ADD CONSTRAINT exposures_broker_id_fkey
        FOREIGN KEY (broker_id) REFERENCES brokers.brokers(id) ON DELETE SET NULL;

ALTER TABLE public.user_todos
    ADD CONSTRAINT user_todos_broker_id_fkey
        FOREIGN KEY (broker_id) REFERENCES brokers.brokers(id) ON DELETE SET NULL;


-- ============================================================================
-- SECTION 8: Indexes
-- ============================================================================

-- Parent/child hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_brokers_parent
    ON brokers.brokers(parent_broker_id)
    WHERE parent_broker_id IS NOT NULL;

-- Dashboard + scan scheduler filtering
CREATE INDEX IF NOT EXISTS idx_brokers_priority_active
    ON brokers.brokers(removal_priority, is_active);

-- Scraper/opt-out automation dispatch
CREATE INDEX IF NOT EXISTS idx_brokers_scrape_type
    ON brokers.brokers(scrape_type) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_brokers_opt_out_type
    ON brokers.brokers(opt_out_type) WHERE is_active = true;

-- Stats lookup by broker
CREATE INDEX IF NOT EXISTS idx_broker_stats_broker
    ON brokers.broker_stats(broker_id);

-- Live stats lookup by broker + outcome
CREATE INDEX IF NOT EXISTS idx_broker_vanyshr_stats_broker
    ON brokers.broker_vanyshr_stats(broker_id, request_type);


-- ============================================================================
-- SECTION 9: updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION brokers.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_brokers_updated_at
    BEFORE UPDATE ON brokers.brokers
    FOR EACH ROW EXECUTE FUNCTION brokers.set_updated_at();

CREATE TRIGGER trg_broker_stats_updated_at
    BEFORE UPDATE ON brokers.broker_stats
    FOR EACH ROW EXECUTE FUNCTION brokers.set_updated_at();


-- ============================================================================
-- SECTION 10: Grants
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA brokers TO service_role;
GRANT USAGE ON SCHEMA brokers TO authenticated;

-- service_role: full access (edge functions, admin tooling, seeding)
GRANT ALL ON ALL TABLES IN SCHEMA brokers TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA brokers TO service_role;

-- authenticated: read-only (app displays broker names, opt-out URLs, etc.)
GRANT SELECT ON brokers.brokers      TO authenticated;
GRANT SELECT ON brokers.broker_stats TO authenticated;
-- broker_vanyshr_stats: service_role only (raw outcome data, not exposed to client)


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- New schema:
--   brokers.brokers              — full broker registry (replaces public.brokers)
--   brokers.broker_stats         — manually curated metrics (replaces nothing — new)
--   brokers.broker_vanyshr_stats — placeholder for live outcome data (scaffold only)
--
-- Removed:
--   public.brokers (+ CASCADE dropped broker_category_map's FKs)
--   public.broker_categories
--   public.broker_category_map
--
-- Updated FKs:
--   public.exposures.broker_id  → brokers.brokers(id)
--   public.user_todos.broker_id → brokers.brokers(id)
-- ============================================================================
