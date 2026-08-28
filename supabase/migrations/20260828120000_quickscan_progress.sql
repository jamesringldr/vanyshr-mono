-- ============================================================================
-- quickscan_progress: Real-time progress logging for scan operations
-- ============================================================================
-- Stores granular progress messages as edge functions execute scan steps.
-- Frontend polls this table to show live progress in the drawer.
-- Follows quickscan schema retention model: purge_after ensures cleanup.

CREATE TABLE quickscan.quickscan_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id uuid NOT NULL REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    message text NOT NULL,
    step text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    purge_after timestamp with time zone NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

COMMENT ON TABLE quickscan.quickscan_progress IS
    'Progress log entries for scan operations. Each message represents a '
    'sub-step completion or status update (e.g., "Matched 3 brokers", '
    '"Extracting emails..."). Frontend polls this to populate the progress '
    'drawer with real-time updates.';

COMMENT ON COLUMN quickscan.quickscan_progress.quickscans_id IS
    'Foreign key to the quickscan this progress entry belongs to.';

COMMENT ON COLUMN quickscan.quickscan_progress.message IS
    'Human-readable progress message to display (e.g., "Initiating full profile scan...").';

COMMENT ON COLUMN quickscan.quickscan_progress.step IS
    'Optional categorization: "full_profile", "emails", etc. Used for filtering/routing.';

COMMENT ON COLUMN quickscan.quickscan_progress.purge_after IS
    'Retention deadline. Scans purge entries in this table along with all quickscan data.';

CREATE INDEX idx_quickscan_progress_quickscans_id
    ON quickscan.quickscan_progress(quickscans_id);

CREATE INDEX idx_quickscan_progress_created_at
    ON quickscan.quickscan_progress(created_at DESC);
