-- ============================================================================
-- Migration: 00010_user_preferences.sql
-- ============================================================================
-- Introduces user_preferences as the canonical store for per-user settings
-- (removal strategy and notification tier), replacing the previous approach of
-- writing to user_profiles columns and reading back from localStorage.
--
-- Changes:
--   1. Create user_preferences table (one row per user)
--   2. RLS policies, updated_at trigger, grants
--   3. Backfill from existing user_profiles columns for current users
--   4. Seed blank rows for any profile that has no preferences row yet
--   5. Replace create_pending_profile() to seed a user_preferences row on signup
-- ============================================================================


-- ============================================================================
-- SECTION 1: CREATE user_preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id               UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Removal strategy chosen during onboarding (or settings page post-signup).
    -- NULL = not yet chosen by the user.
    removal_strategy      TEXT
        CHECK (removal_strategy IN ('aggressive', 'targeted')),

    -- Notification tier preset chosen during onboarding.
    -- NULL = not yet chosen.
    notification_tier     TEXT
        CHECK (notification_tier IN ('all', 'general', 'primary', 'critical', 'manual')),

    -- Full notification settings JSONB — matches the shape produced by
    -- notification_settings_for_tier() and stored when a tier is confirmed.
    notification_settings JSONB DEFAULT '{}',

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own preferences"          ON user_preferences;
DROP POLICY IF EXISTS "Service role full access user_preferences" ON user_preferences;

-- Authenticated users can read and update their own row.
-- Inserts are handled by create_pending_profile() (service role).
CREATE POLICY "Users can manage own preferences" ON user_preferences
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access user_preferences" ON user_preferences
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 2: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON user_preferences TO authenticated;
GRANT ALL ON user_preferences TO service_role;


-- ============================================================================
-- SECTION 3: BACKFILL FROM user_profiles
-- Migrate existing data for users who already completed these steps via the
-- old write path (user_profiles.removal_aggression / notification_tier).
-- ============================================================================

INSERT INTO user_preferences (
    user_id,
    removal_strategy,
    notification_tier,
    notification_settings
)
SELECT
    id,
    removal_aggression,
    notification_tier,
    COALESCE(notification_settings, '{}')
FROM user_profiles
WHERE removal_aggression IS NOT NULL
   OR notification_tier  IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
    SET
        removal_strategy      = EXCLUDED.removal_strategy,
        notification_tier     = EXCLUDED.notification_tier,
        notification_settings = EXCLUDED.notification_settings,
        updated_at            = NOW();


-- ============================================================================
-- SECTION 4: SEED BLANK ROWS FOR PROFILES WITHOUT PREFERENCES
-- Ensures every existing profile has a user_preferences row so that the
-- frontend can always UPDATE rather than needing to decide INSERT vs UPDATE.
-- ============================================================================

INSERT INTO user_preferences (user_id)
SELECT id FROM user_profiles
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- SECTION 5: UPDATE create_pending_profile()
-- Adds an INSERT into user_preferences immediately after the user_profiles row
-- is created, so new signups always have a preferences row from day one.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_pending_profile(p_scan_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
BEGIN
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    -- Create the user_profiles row.
    INSERT INTO user_profiles (
        id,
        first_name,
        last_name,
        signup_status,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        COALESCE(v_scan.search_input->>'first_name', ''),
        COALESCE(v_scan.search_input->>'last_name', ''),
        'pending_auth',
        p_scan_id,
        FALSE,
        0
    );

    -- Seed a blank preferences row so the frontend can always UPDATE.
    INSERT INTO user_preferences (user_id) VALUES (v_profile_id);

    -- Lock the scan so the cleanup job doesn't delete it during signup.
    UPDATE quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;

    -- Populate user_phones from profile_data (if universal-details ran first)
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'phones') = 'array'
    THEN
        FOR v_phone IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'phones')
        LOOP
            CONTINUE WHEN v_phone->>'number' IS NULL
                       OR trim(v_phone->>'number') = '';

            INSERT INTO user_phones (
                user_id, number, is_primary,
                source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                trim(v_phone->>'number'),
                COALESCE((v_phone->>'is_primary')::boolean, FALSE),
                'quick_scan',
                'unverified'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Populate user_addresses
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'addresses') = 'array'
    THEN
        FOR v_address IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'addresses')
        LOOP
            INSERT INTO user_addresses (
                user_id,
                full_address, street, city, state, zip,
                is_current, source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                NULLIF(trim(COALESCE(v_address->>'full_address', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'street', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'city', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'state', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'zip', '')), ''),
                COALESCE((v_address->>'is_current')::boolean, FALSE),
                'quick_scan',
                'unverified'
            );
        END LOOP;
    END IF;

    -- Populate user_aliases
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'aliases') = 'array'
    THEN
        FOR v_alias IN
            SELECT value FROM jsonb_array_elements_text(v_scan.profile_data->'aliases')
        LOOP
            CONTINUE WHEN v_alias IS NULL OR trim(v_alias) = '';

            INSERT INTO user_aliases (
                user_id, name, source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                trim(v_alias),
                'quick_scan',
                'unverified'
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', v_profile_id,
        'scan_id',    p_scan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- user_preferences (one row per user_profiles.id):
--   removal_strategy      TEXT  — 'aggressive' | 'targeted'   | NULL (unset)
--   notification_tier     TEXT  — 'all' | 'general' | ...     | NULL (unset)
--   notification_settings JSONB — full settings object from notification_settings_for_tier()
--
-- Onboarding completion now defined as:
--   onboarding_step >= 5            (profile data steps 1-5 done)
--   AND removal_strategy IS NOT NULL
--   AND notification_tier IS NOT NULL
-- ============================================================================
