-- ============================================================================
-- Migration: 20260812_quickscan_cost_tracking.sql
-- ============================================================================
-- Description: Create quickscan_cost_tracking table for billing and rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quickscan_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference (nullable for anonymous sessions)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Session ID for anonymous user tracking
    session_id TEXT NOT NULL,

    -- Reference to quick_scan
    quick_scan_id UUID REFERENCES public.quick_scans(id) ON DELETE SET NULL,

    -- Reference to dedup group (if Phase 1). The foreign key is added in
    -- 20260812_quickscan_update_fks.sql, not here: migrations apply in
    -- filename order, and this file sorts before the tables it points at
    -- ("cost_tracking" < "dedup_groups" < "enrichment"), so an inline
    -- REFERENCES fails on a database built from this history.
    dedup_group_id UUID,

    -- Reference to enrichment (if Phase 2). Same reason.
    enrichment_id UUID,

    -- Phase tracking
    phase INT NOT NULL CHECK (phase IN (1, 2)),

    -- Cost breakdown
    phase1_cost_usd NUMERIC(6, 4) DEFAULT 0.0,
    phase2_cost_usd NUMERIC(6, 4) DEFAULT 0.0,
    total_cost_usd NUMERIC(6, 4) NOT NULL,

    -- Metrics
    brokers_searched INT DEFAULT 4,
    profiles_found INT DEFAULT 0,
    dedup_groups INT DEFAULT 0,
    emails_found INT DEFAULT 0,
    services_found INT DEFAULT 0,
    breaches_found INT DEFAULT 0,

    -- Timing
    duration_ms INT,

    -- Status
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Index for quick queries
    is_billable BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quickscan_cost_tracking_user_id
    ON public.quickscan_cost_tracking(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quickscan_cost_tracking_session_id
    ON public.quickscan_cost_tracking(session_id);

CREATE INDEX IF NOT EXISTS idx_quickscan_cost_tracking_created_at
    ON public.quickscan_cost_tracking(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quickscan_cost_tracking_phase
    ON public.quickscan_cost_tracking(phase, created_at DESC);

-- Composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_quickscan_cost_tracking_user_date
    ON public.quickscan_cost_tracking(user_id, created_at DESC)
    WHERE user_id IS NOT NULL AND is_billable = true;

-- Add comments
COMMENT ON TABLE public.quickscan_cost_tracking IS
    'Tracks all QuickScan API costs for billing, rate limiting, and cost analytics.';

COMMENT ON COLUMN public.quickscan_cost_tracking.phase IS
    'Phase 1 = summary search + dedup, Phase 2 = enrichment (email extraction + Holehe + Leakcheck)';

COMMENT ON COLUMN public.quickscan_cost_tracking.is_billable IS
    'Whether this search should be billed to the user (false for tests/internal searches)';

-- ============================================================================
-- HELPER FUNCTION: Calculate user cost for time period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_quickscan_costs(
    p_user_id UUID,
    p_lookback_days INT DEFAULT 30
)
RETURNS TABLE (
    total_cost_usd NUMERIC,
    phase1_cost_usd NUMERIC,
    phase2_cost_usd NUMERIC,
    phase1_count INT,
    phase2_count INT,
    last_search TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(qct.total_cost_usd), 0),
        COALESCE(SUM(CASE WHEN qct.phase = 1 THEN qct.total_cost_usd ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN qct.phase = 2 THEN qct.total_cost_usd ELSE 0 END), 0),
        COUNT(*) FILTER (WHERE phase = 1),
        COUNT(*) FILTER (WHERE phase = 2),
        MAX(qct.created_at)
    FROM public.quickscan_cost_tracking qct
    WHERE qct.user_id = p_user_id
        AND qct.is_billable = true
        AND qct.created_at > NOW() - (p_lookback_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_quickscan_costs(UUID, INT) TO authenticated, anon;
