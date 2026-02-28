-- ============================================================================
-- Migration: 00008_breach_status.sql
-- ============================================================================
-- Description: Upgrades the data_breaches table from a binary is_acknowledged
--   flag to a richer status field ('new' | 'unresolved' | 'resolved'), fixes
--   RLS to use get_current_user_profile_id() (aligned with 00005 pattern),
--   updates get_user_dashboard_stats(), and adds pg_cron scheduling comment.
-- ============================================================================


-- ============================================================================
-- SECTION 1: ADD STATUS COLUMN AND MIGRATE EXISTING ROWS
-- ============================================================================

-- Add new status column
ALTER TABLE data_breaches
    ADD COLUMN IF NOT EXISTS status TEXT
        NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'unresolved', 'resolved'));

-- Add timestamp for when status was last changed
ALTER TABLE data_breaches
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- Migrate existing rows:
--   acknowledged (is_acknowledged = TRUE)  → resolved
--   unacknowledged (is_acknowledged = FALSE) → new (already covered by default)
UPDATE data_breaches
    SET status = 'resolved', status_updated_at = acknowledged_at
    WHERE is_acknowledged = TRUE;


-- ============================================================================
-- SECTION 2: UPDATE INDEXES
-- ============================================================================

-- Drop old partial index on is_acknowledged
DROP INDEX IF EXISTS idx_data_breaches_unacked;

-- New composite index supporting status-filtered queries
CREATE INDEX IF NOT EXISTS idx_data_breaches_status
    ON data_breaches(user_id, status);


-- ============================================================================
-- SECTION 3: FIX RLS — USE get_current_user_profile_id() INSTEAD OF auth.uid()
-- ============================================================================
-- The data_breaches.user_id references user_profiles.id (own UUID), NOT
-- auth.users.id. So auth.uid() comparisons are wrong. The correct approach
-- (aligned with 00005) is to resolve via get_current_user_profile_id().

DROP POLICY IF EXISTS "Users can view own breaches"   ON data_breaches;
DROP POLICY IF EXISTS "Users can update own breaches" ON data_breaches;

CREATE POLICY "Users can view own breaches" ON data_breaches
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Users can update own breaches" ON data_breaches
    FOR UPDATE TO authenticated
    USING (user_id = get_current_user_profile_id())
    WITH CHECK (user_id = get_current_user_profile_id());


-- ============================================================================
-- SECTION 4: UPDATE get_user_dashboard_stats()
-- ============================================================================
-- Change is_acknowledged = FALSE → status = 'new'

CREATE OR REPLACE FUNCTION get_user_dashboard_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_exposures',      (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id),
        'active_exposures',     (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id AND status IN ('found', 'queued', 'removal_requested', 'removal_in_progress')),
        'removed_exposures',    (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id AND status IN ('removed', 'verified_removed')),
        'pending_removals',     (SELECT COUNT(*) FROM removal_requests r JOIN exposures e ON r.exposure_id = e.id WHERE e.user_id = p_user_id AND r.status IN ('pending', 'submitted', 'processing')),
        'brokers_with_data',    (SELECT COUNT(DISTINCT broker_id) FROM exposures WHERE user_id = p_user_id AND status NOT IN ('removed', 'verified_removed', 'ignored')),
        'unread_notifications', (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = FALSE),
        'pending_todos',        (SELECT COUNT(*) FROM user_todos WHERE user_id = p_user_id AND status = 'pending'),
        'last_scan_at',         (SELECT MAX(completed_at) FROM scan_history WHERE user_id = p_user_id AND status = 'completed'),
        'data_breaches',        (SELECT COUNT(*) FROM data_breaches WHERE user_id = p_user_id AND status = 'new')
    ) INTO v_stats;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 5: pg_cron SCHEDULING (INFORMATIONAL — see note below)
-- ============================================================================
-- To schedule the weekly breach scan, run the following AFTER enabling the
-- pg_cron and pg_net extensions via Supabase Dashboard:
--   Database → Extensions → pg_cron  (enable)
--   Database → Extensions → pg_net   (enable)
--
-- Also set these custom config params in Supabase Dashboard:
--   Database → Settings → Custom config:
--     app.supabase_url    = https://<your-project-ref>.supabase.co
--     app.service_role_key = <your-service-role-key>
--
-- Then run:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   SELECT cron.schedule(
--     'weekly-breach-scan',
--     '0 3 * * 1',
--     $$SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/breach-scan-all',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--     )$$
--   );
--
-- Alternatively, use Supabase Dashboard → Database → Cron Jobs to add the job
-- manually without needing custom config params.
--
-- Verify scheduling:
--   SELECT * FROM cron.job;
-- ============================================================================


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
--   1. data_breaches.status TEXT ('new'|'unresolved'|'resolved') DEFAULT 'new'
--   2. data_breaches.status_updated_at TIMESTAMPTZ
--   3. Existing acknowledged rows → status='resolved'
--   4. Old partial index replaced with idx_data_breaches_status(user_id, status)
--   5. RLS policies updated to use get_current_user_profile_id()
--   6. get_user_dashboard_stats() updated: is_acknowledged=FALSE → status='new'
-- ============================================================================
