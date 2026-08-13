-- ============================================================================
-- Migration: 20260812_quickscan_dedup_groups.sql
-- ============================================================================
-- Description: Create quickscan_dedup_groups table for Phase 1 deduplication results
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quickscan_dedup_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the quick_scan that triggered this dedup operation
    quick_scan_id UUID NOT NULL REFERENCES public.quick_scans(id) ON DELETE CASCADE,

    -- For anonymous users (session-based tracking)
    session_id TEXT,

    -- User reference (if authenticated)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Dedup group identifier (hash of name + location)
    dedup_id TEXT NOT NULL,

    -- Rank in the dedup list (1 = highest confidence, 2 = second, etc.)
    rank INT NOT NULL DEFAULT 1,

    -- Primary name from the group (from first member)
    primary_name TEXT NOT NULL,

    -- Resolved age (median from group members)
    primary_age INT,

    -- Primary location
    primary_city TEXT,
    primary_state TEXT,

    -- Confidence score (0-100, average match score across members)
    average_confidence NUMERIC(5, 2) NOT NULL,

    -- Age conflict indicator (ages differ by >3 years)
    age_conflict BOOLEAN DEFAULT false,
    age_note TEXT,

    -- List of broker sources (e.g., ["fps", "npd", "anywho", "zaba"])
    sources TEXT[] DEFAULT '{}',

    -- Number of members in this group
    members_count INT DEFAULT 0,

    -- Full dedup group data as JSONB (for detailed viewing)
    -- Structure:
    -- {
    --   dedup_id: string,
    --   members: [{
    --     broker: string,
    --     summary: {...},
    --     match_score: number
    --   }],
    --   age_conflict: boolean,
    --   age_note: string | null
    -- }
    full_data JSONB NOT NULL,

    -- Cost tracking
    phase1_cost_usd NUMERIC(6, 4) DEFAULT 0.0025,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quickscan_dedup_groups_quick_scan_id
    ON public.quickscan_dedup_groups(quick_scan_id);

CREATE INDEX IF NOT EXISTS idx_quickscan_dedup_groups_user_id
    ON public.quickscan_dedup_groups(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quickscan_dedup_groups_session_id
    ON public.quickscan_dedup_groups(session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quickscan_dedup_groups_dedup_id
    ON public.quickscan_dedup_groups(dedup_id);

CREATE INDEX IF NOT EXISTS idx_quickscan_dedup_groups_created_at
    ON public.quickscan_dedup_groups(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_quickscan_dedup_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quickscan_dedup_groups_updated_at
    BEFORE UPDATE ON public.quickscan_dedup_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_quickscan_dedup_groups_updated_at();

-- Add comments
COMMENT ON TABLE public.quickscan_dedup_groups IS
    'Stores deduplicated profile groups from Phase 1 of QuickScan. Multiple brokers matched and grouped by similarity.';

COMMENT ON COLUMN public.quickscan_dedup_groups.dedup_id IS
    'Unique identifier for this group (hash of name + location)';

COMMENT ON COLUMN public.quickscan_dedup_groups.average_confidence IS
    'Average match score (0-100) of all members in this group';

COMMENT ON COLUMN public.quickscan_dedup_groups.full_data IS
    'Complete DedupGroup JSONB structure with all members and their scores';
