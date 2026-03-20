-- ============================================================================
-- Migration: 20260320_fix_validate_access_code.sql
-- ============================================================================
-- Description: Fix validate_access_code() — add FOUND check and reorder ops.
--
-- Background (punchlist #2):
--   The original function incremented use_count first, then updated the profile
--   status, but never checked whether the profile UPDATE actually matched a row.
--   If the profile was in the wrong state (e.g. still 'pending_auth' due to the
--   bug fixed in 20260320_fix_pending_profile_status.sql), use_count was still
--   incremented and the function still returned { success: true }, silently
--   wasting a code use and leaving the profile unchanged.
--
-- Fix (also partially addresses punchlist #4):
--   1. Advance the profile status FIRST (before touching use_count)
--   2. Check FOUND — return a clear error if the profile wasn't in 'pending_user'
--   3. Only increment use_count after the profile update succeeds
--
--   Reordering means a profile in the wrong state never consumes a code use.
--   The full atomic race-condition fix (punchlist #4) is a separate migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_access_code(
    p_code       TEXT,
    p_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code RECORD;
BEGIN
    SELECT * INTO v_code
    FROM public.access_codes
    WHERE code = UPPER(TRIM(p_code));

    IF v_code IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid access code');
    END IF;

    IF NOT v_code.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code is no longer active');
    END IF;

    IF v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has expired');
    END IF;

    IF v_code.max_uses IS NOT NULL AND v_code.use_count >= v_code.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has reached its usage limit');
    END IF;

    -- Advance profile status BEFORE incrementing use_count.
    -- If the profile isn't in 'pending_user', return an error without
    -- consuming a code use.
    UPDATE public.user_profiles
    SET signup_status = 'accessed_pending_signup',
        updated_at    = NOW()
    WHERE id           = p_profile_id
      AND signup_status = 'pending_user';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile not found or not in expected state'
        );
    END IF;

    -- Profile advanced — now safe to record the use.
    UPDATE public.access_codes
    SET use_count  = use_count + 1,
        updated_at = NOW()
    WHERE id = v_code.id;

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', p_profile_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_access_code(TEXT, UUID) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
--
--   validate_access_code(p_code TEXT, p_profile_id UUID)  [UPDATED]
--     Operation order changed:
--       Before: validate → increment use_count → update profile (no FOUND check)
--       After:  validate → update profile → FOUND check → increment use_count
--     A profile in the wrong state now returns { success: false, error: '...' }
--     and does not consume a code use.
-- ============================================================================
