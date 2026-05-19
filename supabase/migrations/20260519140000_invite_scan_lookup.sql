-- ============================================================================
-- Migration: 20260519140000_invite_scan_lookup.sql
-- ============================================================================
-- Description: Invite welcome page uses quick_scans.id in the URL and reads
--              first_name from quick_scans.search_input (not user_profiles).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invite_scan(p_scan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_scan           RECORD;
    v_profile_id     uuid;
    v_profile_status text;
BEGIN
    IF p_scan_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'scan_id_required');
    END IF;

    SELECT id, search_input
    INTO v_scan
    FROM public.quick_scans
    WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    SELECT up.id, up.signup_status
    INTO v_profile_id, v_profile_status
    FROM public.user_profiles up
    WHERE up.source_quick_scan_id = p_scan_id
      AND up.source = 'invite'
    ORDER BY up.created_at DESC
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
    END IF;

    IF v_profile_status NOT IN (
        'pending_user',
        'pending_auth',
        'accessed_pending_signup',
        'waitlisted'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'unavailable');
    END IF;

    RETURN jsonb_build_object(
        'success',     true,
        'first_name',  NULLIF(trim(COALESCE(v_scan.search_input->>'first_name', '')), ''),
        'scan_id',     p_scan_id,
        'profile_id',  v_profile_id
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invite_scan(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_invite_scan(uuid) IS
    'Anon-safe invite lookup for /invite?id=<quick_scans.id>. Returns search_input.first_name only.';
