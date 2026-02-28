-- ============================================================================
-- Migration: 00009_onboarding_project.sql
-- ============================================================================
-- Description: Introduces structured onboarding task tracking for the
--   /dashboard/tasks onboarding project. Replaces the coarse
--   onboarding_completed / onboarding_step fields with a per-step progress
--   table covering the four onboarding levels:
--
--     1. account_signup        — magic link confirmed (auto-completed)
--     2. data_verification     — phones / aliases / addresses / emails reviewed
--     3. notification_settings — notification preferences saved
--     4. removal_aggression    — removal aggressiveness selected
--
-- Changes:
--   1.  user_profiles: add removal_aggression column
--   2.  New table:    user_onboarding_progress
--   3.  New function: initialize_onboarding_steps(UUID)
--   4.  Updated:      create_pending_profile() → calls initialize_onboarding_steps
--   5.  Updated:      link_auth_to_profile()   → marks account_signup completed
--   6.  New view:     user_onboarding_summary
--   7.  Backfill existing profiles
--   8.  Grants
-- ============================================================================


-- ============================================================================
-- SECTION 1: removal_aggression COLUMN ON user_profiles
-- ============================================================================
-- Stores the user's chosen intensity level for automated data removal.
--   conservative — only submit for confirmed, high-confidence exposures
--   balanced     — default; automated removals with standard follow-up
--   aggressive   — repeated follow-ups + immediate action on re-listings
--   maximum      — all of the above + flag for legal escalation where available

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS removal_aggression TEXT DEFAULT 'balanced'
        CHECK (removal_aggression IN (
            'conservative',
            'balanced',
            'aggressive',
            'maximum'
        ));


-- ============================================================================
-- SECTION 2: user_onboarding_progress TABLE
-- ============================================================================
-- One row per user per onboarding step. Seeded by initialize_onboarding_steps()
-- when the profile is first created; updated as the user progresses.
--
-- progress_data shape per step:
--   account_signup:        {}
--   data_verification:     { "confirmed_count": 5, "rejected_count": 1, "total_count": 8 }
--   notification_settings: { "email_new_exposure": true, "email_weekly_summary": false, ... }
--   removal_aggression:    { "selected": "aggressive" }

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    step TEXT NOT NULL CHECK (step IN (
        'account_signup',        -- Level 1: magic link confirmed
        'data_verification',     -- Level 2: personal data items reviewed
        'notification_settings', -- Level 3: notification preferences set
        'removal_aggression'     -- Level 4: removal intensity chosen
    )),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Not yet visited
        'in_progress',  -- User has started but not finished
        'completed',    -- Finished
        'skipped'       -- User explicitly skipped (optional steps only)
    )),

    -- Step-specific context; shape documented above
    progress_data JSONB DEFAULT '{}',

    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),

    -- Enforce one row per user per step
    UNIQUE (user_id, step)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user
    ON user_onboarding_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status
    ON user_onboarding_progress(user_id, status);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_pending
    ON user_onboarding_progress(user_id)
    WHERE status = 'pending';

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_onboarding_progress_updated_at ON user_onboarding_progress;
CREATE TRIGGER trigger_onboarding_progress_updated_at
    BEFORE UPDATE ON user_onboarding_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own onboarding progress"          ON user_onboarding_progress;
DROP POLICY IF EXISTS "Service role full access onboarding_progress"      ON user_onboarding_progress;

CREATE POLICY "Users can manage own onboarding progress" ON user_onboarding_progress
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access onboarding_progress" ON user_onboarding_progress
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 3: initialize_onboarding_steps(p_user_id)
-- ============================================================================
-- Seeds the four onboarding step rows for a newly created profile.
-- Called inside create_pending_profile() immediately after the profile INSERT.
--
--   account_signup starts as 'in_progress' (the user is mid-signup at this point)
--   The other three steps start as 'pending'
--
-- Uses ON CONFLICT DO NOTHING so it is safe to call multiple times.

CREATE OR REPLACE FUNCTION initialize_onboarding_steps(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_onboarding_progress (user_id, step, status, started_at)
    VALUES
        (p_user_id, 'account_signup',        'in_progress', NOW()),
        (p_user_id, 'data_verification',     'pending',     NULL),
        (p_user_id, 'notification_settings', 'pending',     NULL),
        (p_user_id, 'removal_aggression',    'pending',     NULL)
    ON CONFLICT (user_id, step) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 4: REPLACE create_pending_profile()
-- ============================================================================
-- Identical to the 00005 version except for the addition of:
--   PERFORM initialize_onboarding_steps(v_profile_id);
-- placed after the user_profiles INSERT.

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

    -- Seed the four onboarding step rows for this profile.
    PERFORM initialize_onboarding_steps(v_profile_id);

    -- Lock the scan so the cleanup job doesn't delete it while signup is pending.
    UPDATE quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;

    -- ----------------------------------------------------------------
    -- Populate user_phones (only if profile_data was persisted by
    -- the universal-details edge function before this CTA was clicked)
    -- ----------------------------------------------------------------
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

    -- ----------------------------------------------------------------
    -- Populate user_addresses
    -- ----------------------------------------------------------------
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

    -- ----------------------------------------------------------------
    -- Populate user_aliases
    -- ----------------------------------------------------------------
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
-- SECTION 5: REPLACE link_auth_to_profile()
-- ============================================================================
-- Identical to the 00005 version except for the addition of:
--   UPDATE user_onboarding_progress ... WHERE step = 'account_signup'
-- placed after the user_profiles UPDATE.

CREATE OR REPLACE FUNCTION link_auth_to_profile(
    p_profile_id   UUID,
    p_auth_user_id UUID,
    p_email        TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_profile_id;

    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    IF v_profile.auth_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile is already linked to an auth user'
        );
    END IF;

    -- Link auth identity and activate the account.
    UPDATE user_profiles
    SET
        auth_user_id  = p_auth_user_id,
        email         = p_email,
        signup_status = 'active',
        updated_at    = NOW()
    WHERE id = p_profile_id;

    -- Mark the account_signup onboarding step as completed.
    UPDATE user_onboarding_progress
    SET
        status       = 'completed',
        completed_at = NOW(),
        updated_at   = NOW()
    WHERE user_id = p_profile_id
      AND step     = 'account_signup';

    -- Insert the magic-link email into user_emails.
    INSERT INTO user_emails (
        user_id, email, is_primary,
        source, user_confirmed_status, confirmed_at
    ) VALUES (
        p_profile_id, p_email, TRUE,
        'auth', 'confirmed', NOW()
    )
    ON CONFLICT (user_id, email) DO UPDATE
        SET
            is_primary            = TRUE,
            user_confirmed_status = 'confirmed',
            confirmed_at          = NOW(),
            source                = 'auth',
            updated_at            = NOW();

    -- Close out the originating quick_scan.
    UPDATE quick_scans
    SET
        status       = 'completed',
        completed_at = NOW()
    WHERE id = v_profile.source_quick_scan_id;

    RETURN jsonb_build_object(
        'success',      true,
        'profile_id',   p_profile_id,
        'auth_user_id', p_auth_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 6: user_onboarding_summary VIEW
-- ============================================================================
-- Convenience view returning per-user onboarding completion stats.
-- Used by the /dashboard/tasks onboarding project card.
--
-- Columns:
--   user_id              — user_profiles.id
--   steps_completed      — count of steps with status = 'completed'
--   steps_total          — always 4 (one row per step)
--   is_fully_complete    — TRUE when all steps are 'completed' or 'skipped'
--   last_completed_at    — timestamp of the most recently completed step
--
-- Note: view is not materialized — always reflects live data.

DROP VIEW IF EXISTS user_onboarding_summary;

CREATE VIEW user_onboarding_summary AS
SELECT
    user_id,
    COUNT(*)                                    FILTER (WHERE status = 'completed') AS steps_completed,
    COUNT(*)                                                                        AS steps_total,
    BOOL_AND(status IN ('completed', 'skipped'))                                   AS is_fully_complete,
    MAX(completed_at)                           FILTER (WHERE status = 'completed') AS last_completed_at
FROM user_onboarding_progress
GROUP BY user_id;


-- ============================================================================
-- SECTION 7: BACKFILL EXISTING PROFILES
-- ============================================================================
-- For any profiles that already exist, seed the four step rows.
-- Profiles with signup_status = 'active' have completed account_signup.
-- Profiles with onboarding_completed = TRUE have also completed data_verification.
-- notification_settings and removal_aggression default to 'pending' for all.

DO $$
DECLARE
    v_profile RECORD;
BEGIN
    FOR v_profile IN SELECT id, signup_status, onboarding_completed FROM user_profiles LOOP

        -- Seed all four steps (ON CONFLICT DO NOTHING is safe for re-runs)
        INSERT INTO user_onboarding_progress (user_id, step, status, started_at)
        VALUES
            (v_profile.id, 'account_signup',        'in_progress', NOW()),
            (v_profile.id, 'data_verification',     'pending',     NULL),
            (v_profile.id, 'notification_settings', 'pending',     NULL),
            (v_profile.id, 'removal_aggression',    'pending',     NULL)
        ON CONFLICT (user_id, step) DO NOTHING;

        -- Mark account_signup completed for active accounts
        IF v_profile.signup_status = 'active' THEN
            UPDATE user_onboarding_progress
            SET status = 'completed', completed_at = NOW()
            WHERE user_id = v_profile.id AND step = 'account_signup';
        END IF;

        -- Mark data_verification completed if onboarding flow was finished
        IF v_profile.onboarding_completed = TRUE THEN
            UPDATE user_onboarding_progress
            SET status = 'completed', completed_at = NOW(), started_at = NOW()
            WHERE user_id = v_profile.id AND step = 'data_verification';
        END IF;

    END LOOP;
END;
$$;


-- ============================================================================
-- SECTION 8: GRANTS
-- ============================================================================

-- Authenticated users can read and update their own rows (RLS enforces ownership)
GRANT SELECT, INSERT, UPDATE ON user_onboarding_progress TO authenticated;
GRANT ALL                     ON user_onboarding_progress TO service_role;

-- View is readable by authenticated users; ownership is enforced via
-- the underlying table's RLS when queried with a user_id filter.
GRANT SELECT ON user_onboarding_summary TO authenticated;
GRANT SELECT ON user_onboarding_summary TO service_role;

-- initialize_onboarding_steps is called inside create_pending_profile (service_role)
GRANT EXECUTE ON FUNCTION initialize_onboarding_steps(UUID) TO service_role;

-- create_pending_profile and link_auth_to_profile remain service_role only
GRANT EXECUTE ON FUNCTION create_pending_profile(UUID)           TO service_role;
GRANT EXECUTE ON FUNCTION link_auth_to_profile(UUID, UUID, TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema changes after this migration:
--
--  user_profiles              + removal_aggression TEXT ('conservative'|'balanced'|
--                               'aggressive'|'maximum') DEFAULT 'balanced'
--                               onboarding_completed / onboarding_step retained
--                               but superseded by user_onboarding_progress
--
--  user_onboarding_progress   NEW — one row per user per step
--                               step:   'account_signup' | 'data_verification'
--                                       'notification_settings' | 'removal_aggression'
--                               status: 'pending' | 'in_progress' | 'completed' | 'skipped'
--                               progress_data: JSONB (step-specific context)
--
--  user_onboarding_summary    NEW VIEW — steps_completed / steps_total / is_fully_complete
--
--  create_pending_profile()   UPDATED — calls initialize_onboarding_steps() after INSERT
--  link_auth_to_profile()     UPDATED — marks account_signup step as 'completed'
--  initialize_onboarding_steps() NEW — seeds 4 step rows for a given profile UUID
-- ============================================================================
