-- ============================================================================
-- Migration: 20260820120003_fix_scan_timeout_cron.sql
-- ============================================================================
-- Description: Repoint the scan-timeout reaper at quickscan.quick_scans.
--
-- The job 'cleanup-stuck-scanning-scans' runs every minute and referenced
-- `quick_scans` unqualified. 20260819120000 moved that table from `public` to
-- the `quickscan` schema, and the job's search_path no longer resolves it, so
-- every run has failed since 2026-08-19 20:18 with:
--
--     ERROR: relation "quick_scans" does not exist
--
-- Last successful run was 20:17 — one minute before the partition landed. This
-- is an active production error firing 60 times an hour, not a latent one.
--
-- No user-visible symptom yet only because nothing is currently stuck in
-- status='scanning'. The job is a safety net that has been silently down: a
-- scan whose edge function dies mid-run stays 'scanning' forever instead of
-- being marked failed.
--
-- Uses cron.schedule() rather than cron.alter_job(): it upserts on job NAME, so
-- this is idempotent, does not hardcode jobid=1, and works on a fresh database
-- where the job does not exist yet.
--
-- 'failed' is deliberate and is a valid quick_scans_status_check value. An
-- earlier revision of this job tried status='error' and hit constraint
-- violations on 2026-08-08 — 'error' is not in the allowed set.
-- ============================================================================

DO $migration$
BEGIN
    -- pg_cron is an extension, not a guarantee. On a local/fresh database
    -- without it, skip rather than fail the whole migration chain.
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron not installed — skipping scan-timeout job repoint.';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        'cleanup-stuck-scanning-scans',
        '* * * * *',
        $job$
        UPDATE quickscan.quick_scans
           SET status        = 'failed',
               error_message = 'Scan timed out — edge function did not complete in time'
         WHERE status = 'scanning'
           AND updated_at < now() - interval '2 minutes';
        $job$
    );
END
$migration$;


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Changed: cron job 'cleanup-stuck-scanning-scans' now targets
--          quickscan.quick_scans instead of the unqualified (and since the
--          partition, non-existent) quick_scans.
--
-- The ~1,200 accumulated failure rows in cron.job_run_details are left in
-- place: they are an accurate audit trail of the outage, and job
-- 'cleanup-old-cron-run-details' already prunes non-'UPDATE 0' rows older
-- than 30 days, so they clear themselves.
-- ============================================================================
