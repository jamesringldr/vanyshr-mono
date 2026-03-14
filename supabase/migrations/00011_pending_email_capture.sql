-- ============================================================================
-- Migration: 00011_pending_email_capture.sql
-- ============================================================================
-- Moves email capture earlier in the signup funnel — at the point the user
-- submits their email on /signup, before they click the magic link.
--
-- This enables an "abandoned cart" re-engagement strategy: users who submit
-- their email but never click the magic link have a pending_auth profile with
-- their email address, allowing follow-up nudge campaigns.
--
-- Changes:
--   1. Drop the old create_pending_profile(UUID) signature
--   2. Replace with create_pending_profile(UUID, TEXT) — accepts p_email
--      and writes it to user_profiles.email immediately on profile creation
-- ============================================================================


-- ============================================================================
-- SECTION 1: DROP OLD FUNCTION SIGNATURE
-- ============================================================================
-- PostgreSQL treats functions with different argument counts as distinct
-- overloads. Drop the old one-argument version to avoid ambiguity.

DROP FUNCTION IF EXISTS create_pending_profile(UUID);


-- ============================================================================
-- SECTION 2: CREATE NEW SIGNATURE — create_pending_profile(UUID, TEXT)
-- ============================================================================
-- p_email is optional (DEFAULT NULL) so existing callers without email
-- continue to work, but the magic-link page will always pass it.

CREATE OR REPLACE FUNCTION create_pending_profile(
    p_scan_id UUID,
    p_email   TEXT DEFAULT NULL
)
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
    -- email is written immediately when provided so the pending profile can be
    -- used for re-engagement emails if the user never clicks the magic link.
    INSERT INTO user_profiles (
        id,
        first_name,
        last_name,
        email,
        signup_status,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        COALESCE(v_scan.search_input->>'first_name', ''),
        COALESCE(v_scan.search_input->>'last_name', ''),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_auth',
        p_scan_id,
        FALSE,
        0
    );

    -- Seed a blank preferences row so the frontend can always UPDATE.
    INSERT INTO user_preferences (user_id) VALUES (v_profile_id);

    -- Seed the four onboarding step rows.
    PERFORM initialize_onboarding_steps(v_profile_id);

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
-- SECTION 3: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_pending_profile(UUID, TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- create_pending_profile(p_scan_id UUID, p_email TEXT DEFAULT NULL)
--   • Writes p_email to user_profiles.email on profile creation
--   • Enables re-engagement for pending_auth profiles that never confirm auth
-- ============================================================================
