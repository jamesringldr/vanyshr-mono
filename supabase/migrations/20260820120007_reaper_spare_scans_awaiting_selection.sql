-- ============================================================================
-- Migration: 20260820120007_reaper_spare_scans_awaiting_selection.sql
-- ============================================================================
-- Description: Stop the scan-timeout reaper from killing scans that are
--              legitimately waiting on the user.
--
-- 20260820120003 repointed 'cleanup-stuck-scanning-scans' at
-- quickscan.quick_scans after the partition moved the table. That fixed a job
-- that had been failing every minute for ~20 hours -- and in doing so turned a
-- dormant job into an active hazard, because its predicate does not fit the
-- pilot flow.
--
-- The job fails anything sitting in status='scanning' for 2 minutes. But the
-- pilot sequence enters 'scanning' when Phase 1 starts and STAYS there while
-- the user reads the results modal and picks which person is them. Two minutes
-- is nowhere near long enough for that, so every real scan was being marked
-- 'failed' mid-session:
--
--   4 browser scans on 2026-08-20, all killed at 140-200s, all with complete
--   Phase 1 results already stored, all reading
--   "Scan timed out — edge function did not complete in time".
--
-- The distinction the predicate was missing is whether Phase 1 actually
-- produced anything. candidate_matches is the evidence:
--
--   * empty  -> the edge function died before storing results. Genuinely
--               stuck; this is what the safety net is for.
--   * present -> Phase 1 succeeded and we are waiting on a human. Not stuck.
--
-- So the reaper now checks that, and a second clause retires abandoned
-- selections separately -- as 'expired' rather than 'failed', because nothing
-- failed: the person walked away. 30 minutes matches the long-declared
-- quick_scans.expires_at TTL.
--
-- Both statuses are in quick_scans_status_check.
-- ============================================================================

DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron not installed — skipping reaper update.';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        'cleanup-stuck-scanning-scans',
        '* * * * *',
        $job$
        -- (1) Genuinely stuck: 'scanning', nothing stored, edge function gone.
        UPDATE quickscan.quick_scans
           SET status        = 'failed',
               error_message = 'Scan timed out — edge function did not complete in time',
               updated_at    = now()
         WHERE status = 'scanning'
           AND updated_at < now() - interval '2 minutes'
           AND (candidate_matches IS NULL OR candidate_matches = '{}'::jsonb);

        -- (2) Abandoned at the picker: results exist, nobody chose. Not a
        --     failure -- expire it.
        UPDATE quickscan.quick_scans
           SET status     = 'expired',
               updated_at = now()
         WHERE status = 'scanning'
           AND updated_at < now() - interval '30 minutes'
           AND candidate_matches IS NOT NULL
           AND candidate_matches <> '{}'::jsonb;
        $job$
    );
END
$migration$;


-- ============================================================================
-- Migration complete
-- ============================================================================
-- The 2-minute safety net still catches a dead edge function, but can no
-- longer fail a scan whose results are sitting on screen awaiting a click.
--
-- NOT retroactive: scans already marked 'failed' by the old predicate are left
-- as they are. They are test traffic, and rewriting historical status would
-- misrepresent what happened at the time.
-- ============================================================================
