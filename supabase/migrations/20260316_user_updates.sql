-- ============================================================================
-- Migration: 20260316_user_updates.sql
-- ============================================================================
-- Description: Creates the user_updates table for per-user notifications and
--   feature announcements. Supports both user-specific rows (auto-inserted by
--   app logic) and broadcast fan-out (admin-triggered via fan_out_broadcast_update()).
--   Status lifecycle: unread → dismissed | clicked | converted
-- ============================================================================


-- ============================================================================
-- SECTION 1: CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_updates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  action_text   TEXT,
  action_route  TEXT,
  type          TEXT        NOT NULL DEFAULT 'info'
                            CHECK (type IN ('info', 'tip', 'alert', 'action_required', 'new_feature')),
  icon          TEXT,
  status        TEXT        NOT NULL DEFAULT 'unread'
                            CHECK (status IN ('unread', 'dismissed', 'clicked', 'converted')),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- SECTION 2: INDEXES
-- ============================================================================

-- Primary query pattern: fetch unread updates for a user, newest first
CREATE INDEX IF NOT EXISTS idx_user_updates_user_status
  ON user_updates(user_id, status, created_at DESC);


-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_updates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own updates
CREATE POLICY "Users can view own updates" ON user_updates
  FOR SELECT TO authenticated
  USING (user_id = get_current_user_profile_id());

-- Authenticated users can update status on their own updates (dismiss, click, convert)
CREATE POLICY "Users can update own update status" ON user_updates
  FOR UPDATE TO authenticated
  USING (user_id = get_current_user_profile_id())
  WITH CHECK (user_id = get_current_user_profile_id());

-- Service role bypasses RLS (handles auto-inserts from edge functions and fan-out)


-- ============================================================================
-- SECTION 4: BROADCAST FAN-OUT FUNCTION
-- ============================================================================
-- Called by admin or a service-role edge function to push a broadcast update
-- to every active user. Returns the number of rows inserted.

CREATE OR REPLACE FUNCTION fan_out_broadcast_update(
  p_title       TEXT,
  p_message     TEXT,
  p_type        TEXT        DEFAULT 'new_feature',
  p_action_text TEXT        DEFAULT NULL,
  p_action_route TEXT       DEFAULT NULL,
  p_icon        TEXT        DEFAULT NULL,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO user_updates (user_id, title, message, type, action_text, action_route, icon, expires_at)
  SELECT id, p_title, p_message, p_type, p_action_text, p_action_route, p_icon, p_expires_at
  FROM user_profiles;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
--   1. user_updates table with status lifecycle (unread|dismissed|clicked|converted)
--   2. Composite index on (user_id, status, created_at DESC)
--   3. RLS: SELECT + UPDATE for authenticated users via get_current_user_profile_id()
--   4. fan_out_broadcast_update() SECURITY DEFINER function for admin broadcasts
-- ============================================================================
