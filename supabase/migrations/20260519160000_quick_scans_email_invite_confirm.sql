-- ============================================================================
-- Migration: 20260519160000_quick_scans_email_invite_confirm.sql
-- ============================================================================

ALTER TABLE public.quick_scans
    ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.quick_scans.email IS
    'Optional invite recipient email; pre-fills magic-link signup when set.';

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

    SELECT id, search_input, source, email
    INTO v_scan
    FROM public.quick_scans
    WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_scan.source IS DISTINCT FROM 'invite' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
    END IF;

    SELECT up.id, up.signup_status
    INTO v_profile_id, v_profile_status
    FROM public.user_profiles up
    WHERE up.source_quick_scan_id = p_scan_id
    ORDER BY up.created_at DESC
    LIMIT 1;

    IF v_profile_id IS NOT NULL
       AND v_profile_status NOT IN (
           'pending_user',
           'pending_auth',
           'accessed_pending_signup',
           'waitlisted'
       )
    THEN
        RETURN jsonb_build_object('success', false, 'error', 'unavailable');
    END IF;

    RETURN jsonb_build_object(
        'success',     true,
        'first_name',  NULLIF(trim(COALESCE(v_scan.search_input->>'first_name', '')), ''),
        'last_name',   NULLIF(trim(COALESCE(v_scan.search_input->>'last_name', '')), ''),
        'city',        NULLIF(trim(COALESCE(v_scan.search_input->>'city', '')), ''),
        'state',       NULLIF(trim(COALESCE(v_scan.search_input->>'state', '')), ''),
        'zip_code',    NULLIF(trim(COALESCE(v_scan.search_input->>'zip_code', '')), ''),
        'email',       NULLIF(trim(COALESCE(v_scan.email, '')), ''),
        'scan_id',     p_scan_id,
        'profile_id',  v_profile_id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_invite_scan(
    p_scan_id   uuid,
    p_first_name text,
    p_last_name  text,
    p_city       text,
    p_state      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_scan RECORD;
BEGIN
    IF p_scan_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'scan_id_required');
    END IF;

    SELECT id, search_input, source
    INTO v_scan
    FROM public.quick_scans
    WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_scan.source IS DISTINCT FROM 'invite' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
    END IF;

    UPDATE public.quick_scans
    SET search_input = COALESCE(v_scan.search_input, '{}'::jsonb) || jsonb_build_object(
        'first_name', NULLIF(trim(COALESCE(p_first_name, '')), ''),
        'last_name',  NULLIF(trim(COALESCE(p_last_name, '')), ''),
        'city',       NULLIF(trim(COALESCE(p_city, '')), ''),
        'state',      NULLIF(trim(COALESCE(p_state, '')), '')
    )
    WHERE id = p_scan_id;

    UPDATE public.user_profiles
    SET
        first_name = initcap(trim(COALESCE(p_first_name, ''))),
        last_name  = initcap(trim(COALESCE(p_last_name, ''))),
        updated_at = NOW()
    WHERE source_quick_scan_id = p_scan_id;

    RETURN jsonb_build_object('success', true, 'scan_id', p_scan_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_invite_scan(uuid, text, text, text, text) TO anon, authenticated;
