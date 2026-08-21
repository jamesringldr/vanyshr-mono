-- ============================================================================
-- Migration: 20260821120000_intro_quickscans.sql
-- ============================================================================
-- Description: Top-level row for the rebuilt intro-scan sequence.
--
-- The existing quickscan.quick_scans table is left untouched (old pipeline).
-- This table is the parent of every new intro-scan child we add. Nested PII
-- hangs off quickscans.id with ON DELETE CASCADE. The reaper deletes from
-- THIS table where purge_after <= now(); children go with the parent.
--
-- Member conversion (later): copy into public.user_*, then
--   UPDATE ... SET purge_after = now()
-- so the same reaper removes the intro row. If the copy fails, the 7-day
-- clock is unchanged.
-- ============================================================================


CREATE TABLE quickscan.quickscans (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Same value as id unless the writer passes one. Browser, URLs, and row
    -- share one identifier.
    session_id             text NOT NULL,
    search_input           jsonb NOT NULL,
    summary_urls           jsonb NOT NULL DEFAULT '{}'::jsonb,
    summary_result_counts  jsonb NOT NULL DEFAULT '{}'::jsonb,
    profile_selected       boolean NOT NULL DEFAULT false,
    -- Pipeline position. Open text on purpose — we add values as steps land
    -- instead of migrating a CHECK every time.
    status                 text NOT NULL DEFAULT 'created',
    -- Funnel watermark: farthest screen reached, never moved backwards.
    deepest_page           text NOT NULL DEFAULT 'form',
    signup_status          text NOT NULL DEFAULT 'in_progress'
                           CHECK (signup_status IN (
                               'in_progress',
                               'abandoned',
                               'report',
                               'member'
                           )),
    -- UI countdown. NULL until the risk summary first loads.
    visible_until          timestamptz,
    -- Hard delete. Insert = created_at + 7 days. Member copy success = now().
    purge_after            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    -- Central, for eyeballing in SQL. Sort with created_at, not this.
    time_sort              text NOT NULL,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.quickscans IS
    'Intro-scan parent row. Created on form submit before any scrape. '
    'Old pipeline remains on quickscan.quick_scans.';

COMMENT ON COLUMN quickscan.quickscans.session_id IS
    'Per-submit identifier. Defaults to id::text so the client carries one uuid.';

COMMENT ON COLUMN quickscan.quickscans.search_input IS
    '{first_name, last_name, zip, city, state}. City/state resolved before insert.';

COMMENT ON COLUMN quickscan.quickscans.summary_urls IS
    '{zaba, fps, npd, anywho} — the summary URLs we built, not the pages.';

COMMENT ON COLUMN quickscan.quickscans.summary_result_counts IS
    '{zaba: n, fps: n, ...} counts only. Result rows live on child tables.';

COMMENT ON COLUMN quickscan.quickscans.profile_selected IS
    'True only if the user picked a card. Independent of status.';

COMMENT ON COLUMN quickscan.quickscans.status IS
    'Machine pipeline. Starts at created. Not the pick, not the conversion.';

COMMENT ON COLUMN quickscan.quickscans.deepest_page IS
    'Farthest funnel screen reached. Never rewritten to an earlier page.';

COMMENT ON COLUMN quickscan.quickscans.signup_status IS
    'Funnel outcome. in_progress at insert. member wins over report.';

COMMENT ON COLUMN quickscan.quickscans.visible_until IS
    'User-facing access clock. NULL until risk summary loads, then now()+5min. '
    'Reset on more-time. Report-without-signup sets now()+5 days.';

COMMENT ON COLUMN quickscan.quickscans.purge_after IS
    'Hard-delete deadline. Insert default created_at+7 days. After a successful '
    'copy into public.user_*, set to now() so the reaper removes this row and '
    'all CASCADE children.';

COMMENT ON COLUMN quickscan.quickscans.time_sort IS
    'America/Chicago mm.dd.yy-hh.mm for reading rows. ORDER BY created_at, not this.';


CREATE INDEX idx_quickscans_purge_after
    ON quickscan.quickscans (purge_after);

CREATE INDEX idx_quickscans_created_at
    ON quickscan.quickscans (created_at DESC);


CREATE OR REPLACE FUNCTION quickscan.quickscans_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;
    IF NEW.session_id IS NULL OR NEW.session_id = '' THEN
        NEW.session_id := NEW.id::text;
    END IF;
    IF NEW.purge_after IS NULL THEN
        NEW.purge_after := NEW.created_at + interval '7 days';
    END IF;
    NEW.time_sort := to_char(
        NEW.created_at AT TIME ZONE 'America/Chicago',
        'MM.DD.YY-HH24.MI'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER quickscans_before_insert
    BEFORE INSERT ON quickscan.quickscans
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.quickscans_before_insert();


CREATE OR REPLACE FUNCTION quickscan.quickscans_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER quickscans_set_updated_at
    BEFORE UPDATE ON quickscan.quickscans
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.quickscans_set_updated_at();
