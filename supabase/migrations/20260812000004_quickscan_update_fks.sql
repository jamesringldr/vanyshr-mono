-- ============================================================================
-- Migration: 20260812_quickscan_update_fks.sql
-- ============================================================================
-- Description: Update quick_scans table with FK references to dedup_groups and enrichment
-- ============================================================================

-- Add new columns to quick_scans table
ALTER TABLE public.quick_scans
    ADD COLUMN IF NOT EXISTS dedup_group_id UUID REFERENCES public.quickscan_dedup_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS enrichment_id UUID REFERENCES public.quickscan_enrichment(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN public.quick_scans.dedup_group_id IS
    'Reference to the primary dedup group from Phase 1 (can have multiple in quickscan_dedup_groups table)';

COMMENT ON COLUMN public.quick_scans.enrichment_id IS
    'Reference to the enrichment result from Phase 2';

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_quick_scans_dedup_group_id
    ON public.quick_scans(dedup_group_id)
    WHERE dedup_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quick_scans_enrichment_id
    ON public.quick_scans(enrichment_id)
    WHERE enrichment_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- quickscan_cost_tracking foreign keys
-- ---------------------------------------------------------------------------
-- These live here rather than inline in 20260812_quickscan_cost_tracking.sql
-- because migrations apply in filename order and that file sorts before both
-- tables it references ("cost_tracking" < "dedup_groups" < "enrichment").
-- Declared inline, they failed on any database built from this history with
-- 'relation "public.quickscan_dedup_groups" does not exist'.
--
-- Guarded so this is a no-op where the constraints already exist, which is the
-- case on any database that applied the original inline version.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'quickscan_cost_tracking_dedup_group_id_fkey'
    ) THEN
        ALTER TABLE public.quickscan_cost_tracking
            ADD CONSTRAINT quickscan_cost_tracking_dedup_group_id_fkey
            FOREIGN KEY (dedup_group_id)
            REFERENCES public.quickscan_dedup_groups(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'quickscan_cost_tracking_enrichment_id_fkey'
    ) THEN
        ALTER TABLE public.quickscan_cost_tracking
            ADD CONSTRAINT quickscan_cost_tracking_enrichment_id_fkey
            FOREIGN KEY (enrichment_id)
            REFERENCES public.quickscan_enrichment(id) ON DELETE SET NULL;
    END IF;
END $$;
