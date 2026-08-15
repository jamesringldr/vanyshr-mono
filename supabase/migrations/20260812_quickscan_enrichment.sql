-- ============================================================================
-- Migration: 20260812_quickscan_enrichment.sql
-- ============================================================================
-- Description: Create quickscan_enrichment table for Phase 2 enrichment results
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quickscan_enrichment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the quick_scan
    quick_scan_id UUID NOT NULL REFERENCES public.quick_scans(id) ON DELETE CASCADE,

    -- Reference to the dedup group selected for enrichment
    dedup_group_id UUID NOT NULL REFERENCES public.quickscan_dedup_groups(id) ON DELETE CASCADE,

    -- For anonymous users (session-based tracking)
    session_id TEXT,

    -- User reference (if authenticated)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- ========================================================================
    -- EMAIL EXTRACTION (Phase 2a)
    -- ========================================================================
    emails_found TEXT[] DEFAULT '{}',
    emails_extracted_at TIMESTAMPTZ,

    -- ========================================================================
    -- HOLEHE ENRICHMENT (Phase 2b - Online Services)
    -- ========================================================================
    holehe_status TEXT DEFAULT 'pending' CHECK (holehe_status IN ('pending', 'success', 'failed', 'no_auth', 'timeout')),
    services_found TEXT[] DEFAULT '{}',  -- e.g., ["github", "linkedin", "twitter"]
    holehe_checked_at TIMESTAMPTZ,
    holehe_error_message TEXT,

    -- ========================================================================
    -- LEAKCHECK ENRICHMENT (Phase 2c - Data Breaches)
    -- ========================================================================
    leakcheck_status TEXT DEFAULT 'pending' CHECK (leakcheck_status IN ('pending', 'success', 'failed', 'no_auth', 'timeout')),

    -- Breach data as JSONB array:
    -- [{
    --   "name": "LinkedIn 2021",
    --   "date": "2021-05-15",
    --   "exposures": 500000,
    --   "url": "https://..."
    -- }]
    breaches JSONB DEFAULT '[]',
    leakcheck_checked_at TIMESTAMPTZ,
    leakcheck_error_message TEXT,

    -- ========================================================================
    -- CONSOLIDATED PROFILE (Final merged result)
    -- ========================================================================
    -- Complete ConsolidatedProfile structure as JSONB:
    -- {
    --   person_id: string,
    --   full_name: string,
    --   age: number,
    --   primary_address: {...},
    --   previous_addresses: [...],
    --   phone_numbers: [...],
    --   emails: [...],
    --   relatives: [...],
    --   associates: [...],
    --   properties: [...],
    --   services_found: [...],
    --   breaches: [...],
    --   confidence: number,
    --   sources: [...],
    --   metadata: {...}
    -- }
    consolidated_profile JSONB,

    -- ========================================================================
    -- COST TRACKING
    -- ========================================================================
    phase1_cost_usd NUMERIC(6, 4) DEFAULT 0.0,
    phase2_cost_usd NUMERIC(6, 4) DEFAULT 0.0,
    total_cost_usd NUMERIC(6, 4) DEFAULT 0.0,

    -- ========================================================================
    -- TIMING METRICS
    -- ========================================================================
    email_extract_ms INT,
    holehe_ms INT,
    leakcheck_ms INT,
    consolidate_ms INT,
    total_phase2_ms INT,

    -- ========================================================================
    -- TIMESTAMPS & STATUS
    -- ========================================================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Soft delete
    is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quickscan_enrichment_quick_scan_id
    ON public.quickscan_enrichment(quick_scan_id);

CREATE INDEX IF NOT EXISTS idx_quickscan_enrichment_dedup_group_id
    ON public.quickscan_enrichment(dedup_group_id);

CREATE INDEX IF NOT EXISTS idx_quickscan_enrichment_user_id
    ON public.quickscan_enrichment(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quickscan_enrichment_session_id
    ON public.quickscan_enrichment(session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quickscan_enrichment_created_at
    ON public.quickscan_enrichment(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_quickscan_enrichment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quickscan_enrichment_updated_at
    BEFORE UPDATE ON public.quickscan_enrichment
    FOR EACH ROW
    EXECUTE FUNCTION update_quickscan_enrichment_updated_at();

-- Add comments
COMMENT ON TABLE public.quickscan_enrichment IS
    'Stores Phase 2 enrichment results: Holehe (online services), Leakcheck (breaches), and consolidated profile.';

COMMENT ON COLUMN public.quickscan_enrichment.consolidated_profile IS
    'Final merged profile data from all sources, including enrichment metadata.';

COMMENT ON COLUMN public.quickscan_enrichment.services_found IS
    'Online services discovered via Holehe (e.g., GitHub, LinkedIn, Twitter)';

COMMENT ON COLUMN public.quickscan_enrichment.breaches IS
    'Data breach records found via Leakcheck API';
