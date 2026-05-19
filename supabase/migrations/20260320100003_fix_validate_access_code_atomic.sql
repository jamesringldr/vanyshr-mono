-- ============================================================================
-- Migration: 20260320_fix_validate_access_code_atomic.sql
-- ============================================================================
-- Description: Make validate_access_code() use_count check+increment atomic.
--
-- Background (punchlist #4):
--   The non-atomic pattern from 20260318 (and carried into the #2 fix):
--     IF use_count >= max_uses THEN RETURN error; END IF;
--     UPDATE access_codes SET use_count = use_count + 1 ...
--   Two concurrent requests for a max_uses = 1 code both read use_count = 0,
--   both pass the check, both increment → use_count ends at 2 for a limit of 1.
--
-- Fix:
--   Collapse the check and increment into a single atomic UPDATE:
--     UPDATE access_codes SET use_count = use_count + 1
--     WHERE id = v_code.id AND (max_uses IS NULL OR use_count < max_uses)
--     RETURNING id INTO v_updated_id;
--   Postgres row-level locking ensures only one concurrent writer wins.
--   If v_updated_id IS NULL the limit was already reached.
--
-- Operation order (supersedes 20260320_fix_validate_access_code.sql):
--   1. Validate code (existence, active, expired)
--   2. Atomically claim a use (check + increment in one statement)
--      → bail here if limit reached, profile untouched
--   3. Advance profile status (pending_user → accessed_pending_signup)
--      → if profile not in expected state: compensate by decrementing use_count
--        and return error
--
--   Claiming the scarce resource (code use) before touching the profile keeps
--   compensation simple: a failed profile update just gives the use back.
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
    v_code       RECORD;
    v_updated_id UUID;
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

    -- Atomically claim a use: the WHERE clause IS the limit check.
    -- Both the check and the increment happen in one statement so concurrent
    -- requests cannot both pass the limit. Only the first writer wins the row lock;
    -- the second sees the already-incremented count and gets no rows back.
    UPDATE public.access_codes
    SET use_count  = use_count + 1,
        updated_at = NOW()
    WHERE id = v_code.id
      AND (max_uses IS NULL OR use_count < max_uses)
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has reached its usage limit');
    END IF;

    -- Use claimed. Now advance the profile status.
    -- Guard: only move forward from pending_user.
    UPDATE public.user_profiles
    SET signup_status = 'accessed_pending_signup',
        updated_at    = NOW()
    WHERE id           = p_profile_id
      AND signup_status = 'pending_user';

    IF NOT FOUND THEN
        -- Profile wasn't in the expected state — give the use back before returning.
        UPDATE public.access_codes
        SET use_count  = use_count - 1,
            updated_at = NOW()
        WHERE id = v_code.id;

        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile not found or not in expected state'
        );
    END IF;

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
--     use_count check+increment is now a single atomic UPDATE ... RETURNING.
--     Operation order: validate → claim use (atomic) → advance profile
--       → compensate (decrement use) on profile failure.
--     Supersedes the non-atomic version from 20260320_fix_validate_access_code.sql.
-- ============================================================================
