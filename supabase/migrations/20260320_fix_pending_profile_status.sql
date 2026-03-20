-- ============================================================================
-- Migration: 20260320_fix_pending_profile_status.sql
-- ============================================================================
-- Description: Fix create_pending_profile() to write 'pending_user' and
--              remove the dead 1-arg overload introduced by 20260318.
--
-- Background:
--   20260318_beta_access.sql intended to change the initial signup_status from
--   'pending_auth' → 'pending_user' so that validate_access_code() can advance
--   the profile forward. However, it used CREATE OR REPLACE on a 1-arg signature
--   (p_scan_id UUID), which created a NEW overload rather than replacing the
--   canonical 2-arg version (p_scan_id UUID, p_email TEXT). The Edge Function
--   always calls the 2-arg version, so the status remained 'pending_auth' and
--   validate_access_code()'s guard clause (WHERE signup_status = 'pending_user')
--   matched 0 rows on every submission.
--
-- Fixes:
--   1. DROP the dead 1-arg overload from 20260318 (punchlist #5)
--   2. CREATE OR REPLACE the canonical 2-arg version with 'pending_user' (punchlist #1)
-- ============================================================================


-- ============================================================================
-- SECTION 1: Drop the dead 1-arg overload
-- ============================================================================
-- This was accidentally created by 20260318 when it used CREATE OR REPLACE
-- on a different signature. It is never called by any Edge Function (which
-- always passes two named args) and has divergent behavior: it omits the
-- user_preferences INSERT and initcap() normalization from 20260314.

DROP FUNCTION IF EXISTS public.create_pending_profile(UUID);


-- ============================================================================
-- SECTION 2: Update canonical 2-arg function — 'pending_auth' → 'pending_user'
-- ============================================================================
-- This is the only change from the 20260314 version: signup_status is now
-- written as 'pending_user' so the beta funnel can advance the profile via
-- validate_access_code() and join_waitlist().
--
-- When a user later submits their email on /signup and the magic link is sent,
-- a separate mechanism (link-auth-to-profile or equivalent) is responsible for
-- advancing status to 'pending_auth'. This function only fires at the
-- "Start Vanyshing" click — before the beta gate modal is shown.

CREATE OR REPLACE FUNCTION public.create_pending_profile(
    p_scan_id uuid,
    p_email   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
    -- phone helpers
    v_digits     TEXT;
    v_fmt_phone  TEXT;
BEGIN
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

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
        initcap(trim(COALESCE(v_scan.search_input->>'first_name', ''))),
        initcap(trim(COALESCE(v_scan.search_input->>'last_name', ''))),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_user',
        p_scan_id,
        FALSE,
        0
    );

    INSERT INTO user_preferences (user_id) VALUES (v_profile_id);

    PERFORM initialize_onboarding_steps(v_profile_id);

    UPDATE quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;

    -- ── Phones ────────────────────────────────────────────────────────────────
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'phones') = 'array'
    THEN
        FOR v_phone IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'phones')
        LOOP
            CONTINUE WHEN v_phone->>'number' IS NULL
                       OR trim(v_phone->>'number') = '';

            v_digits := right(regexp_replace(v_phone->>'number', '\D', '', 'g'), 10);

            IF length(v_digits) = 10 THEN
                v_fmt_phone := '(' || substr(v_digits, 1, 3) || ') '
                             || substr(v_digits, 4, 3) || '-'
                             || substr(v_digits, 7, 4);
            ELSE
                v_fmt_phone := trim(v_phone->>'number');
            END IF;

            INSERT INTO user_phones (
                user_id, number, is_primary,
                source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                v_fmt_phone,
                COALESCE((v_phone->>'is_primary')::boolean, FALSE),
                'quick_scan',
                'unverified'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- ── Addresses ─────────────────────────────────────────────────────────────
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
                NULLIF(initcap(trim(COALESCE(v_address->>'street', ''))), ''),
                NULLIF(initcap(trim(COALESCE(v_address->>'city', ''))), ''),
                NULLIF(
                    CASE
                        WHEN length(trim(COALESCE(v_address->>'state', ''))) <= 2
                        THEN upper(trim(v_address->>'state'))
                        ELSE initcap(trim(v_address->>'state'))
                    END,
                ''),
                NULLIF(trim(COALESCE(v_address->>'zip', '')), ''),
                COALESCE((v_address->>'is_current')::boolean, FALSE),
                'quick_scan',
                'unverified'
            );
        END LOOP;
    END IF;

    -- ── Aliases ───────────────────────────────────────────────────────────────
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
                initcap(trim(v_alias)),
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
$function$;

GRANT EXECUTE ON FUNCTION public.create_pending_profile(UUID, TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
--
--   create_pending_profile(p_scan_id UUID)       [DROPPED]
--     Dead 1-arg overload from 20260318 — was never called by any Edge Function.
--
--   create_pending_profile(p_scan_id UUID, p_email TEXT DEFAULT NULL)  [UPDATED]
--     signup_status: 'pending_auth' → 'pending_user'
--     All other logic identical to 20260314 (initcap normalization,
--     user_preferences seed, phone/address/alias population).
-- ============================================================================
