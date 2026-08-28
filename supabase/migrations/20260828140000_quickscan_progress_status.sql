-- ============================================================================
-- quickscan_progress.status — per-line lifecycle for the loading drawer
-- ============================================================================
-- The drawer renders each log line with an indicator whose colour is its
-- state, and derives each *stage's* state from the lines under it. Deriving
-- that from a "✓"/"✗" glyph at the front of the message worked but tied
-- presentation to copy — an edited string silently changed a colour. This
-- makes it explicit.
--
--   active   in flight; newest one in a stage draws the ripple loader
--   success  finished cleanly (green)
--   failed   broker unreachable / step could not complete (red)
--   summary  the stage's closing one-liner. Its presence is what marks the
--            stage complete, so exactly one is written per stage.
--
-- `step` already carries the stage id and is reused as-is.

ALTER TABLE quickscan.quickscan_progress
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'success', 'failed', 'summary'));

COMMENT ON COLUMN quickscan.quickscan_progress.status IS
    'Line lifecycle: active | success | failed | summary. A stage is complete '
    'once it has a summary row; active while it has rows but none; pending '
    'when it has no rows at all.';

COMMENT ON COLUMN quickscan.quickscan_progress.step IS
    'Stage id this line belongs to: confirm | criteria | brokers | darkweb | '
    'report. Groups the drawer''s log under its stage heading.';
