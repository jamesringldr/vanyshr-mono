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
