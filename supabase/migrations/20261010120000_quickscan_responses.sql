-- ============================================================================
-- Migration: 20261010120000_quickscan_responses.sql
-- Purpose: quickscan.quickscan_responses -- answers to the /finding-your-data
--          question carousel, one row per question per intro scan.
-- ============================================================================
-- Answers are given before signup, so they hang off quickscan.quickscans (the
-- only identity at that point) like every other intro-scan child: ON DELETE
-- CASCADE, so the reaper purges them with the parent after its 7-day
-- purge_after. Member conversion copies what it keeps into public.user_*.
--
-- question_key is stable and versioned (e.g. 'reasons_v1'); bump the version
-- when a question's meaning changes rather than mixing old and new answers.
-- answer holds stable option ids (e.g. ["exposure","privacy"]), never labels,
-- so copy can be reworded freely. skipped = true records an explicit Skip,
-- which is different from never reaching the question.
--
-- Written only by the save-scan-response edge function (service role). Access
-- follows the quickscan schema's grants; RLS on with no policies, like the
-- other quickscan children.
-- ============================================================================

CREATE TABLE quickscan.quickscan_responses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id   uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    question_key    text NOT NULL,
    answer          jsonb NOT NULL DEFAULT '[]'::jsonb,
    skipped         boolean NOT NULL DEFAULT false,
    answered_at     timestamptz NOT NULL DEFAULT now(),

    -- One answer per question per scan; re-answering (Back, then a new pick) upserts.
    CONSTRAINT quickscan_responses_scan_question_key UNIQUE (quickscans_id, question_key)
);

COMMENT ON TABLE quickscan.quickscan_responses IS
    'Answers to the /finding-your-data question carousel, one row per question per intro scan. '
    'Purged with the parent quickscans row.';

ALTER TABLE quickscan.quickscan_responses ENABLE ROW LEVEL SECURITY;

-- Explicit, in case this runs as a role other than the one whose default
-- privileges the quickscan schema set up (20260819120000_quickscan_schema.sql).
REVOKE ALL ON quickscan.quickscan_responses FROM anon, authenticated;
GRANT ALL ON quickscan.quickscan_responses TO service_role;
