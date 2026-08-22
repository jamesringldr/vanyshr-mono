-- ============================================================================
-- selected_summary_result_fallback
-- ============================================================================
-- No-Zaba fallback: when Zaba returns zero results for a scan but fps/npd/
-- anywho found the person, the selection modal shows their (matched)
-- summary_results candidates instead -- see summary-scan/index.ts. The
-- picked row there is a summary_results id, not a full_profile_results id,
-- so it can't go in selected_full_profile_result_id (that column has a hard
-- FK to quickscan.full_profile_results). Same pick semantics, separate
-- column instead.
--
-- Exactly one of selected_full_profile_result_id / selected_summary_result_id
-- is set once a pick is made -- not enforced via CHECK since both are
-- legitimately NULL before any pick happens.
-- ============================================================================

ALTER TABLE quickscan.quickscans
    ADD COLUMN selected_summary_result_id
        uuid REFERENCES quickscan.summary_results(id) ON DELETE SET NULL;

COMMENT ON COLUMN quickscan.quickscans.selected_summary_result_id IS
    'Fallback pick when Zaba returned no results for this scan -- points at '
    'the fps/npd/anywho summary_results row the user picked instead. See '
    'selected_full_profile_result_id for the normal (Zaba) case.';
