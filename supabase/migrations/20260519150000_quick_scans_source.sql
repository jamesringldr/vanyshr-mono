-- ============================================================================
-- Migration: 20260519150000_quick_scans_source.sql
-- ============================================================================
-- Description: Add signup funnel source to quick_scans (invite | quickscan).
-- ============================================================================

ALTER TABLE public.quick_scans
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'quickscan';

ALTER TABLE public.quick_scans
    DROP CONSTRAINT IF EXISTS quick_scans_source_check;

ALTER TABLE public.quick_scans
    ADD CONSTRAINT quick_scans_source_check
    CHECK (source IN ('invite', 'quickscan'));

COMMENT ON COLUMN public.quick_scans.source IS
    'How the scan was created: quickscan (public funnel) or invite (admin/concierge).';

CREATE INDEX IF NOT EXISTS idx_quick_scans_source
    ON public.quick_scans (source)
    WHERE source = 'invite';

-- Backfill invite scans from linked profiles.
UPDATE public.quick_scans qs
SET source = 'invite'
FROM public.user_profiles up
WHERE up.source_quick_scan_id = qs.id
  AND up.source = 'invite';

-- Invite welcome: validate quick_scans.source instead of user_profiles.source.
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
        'scan_id',     p_scan_id,
        'profile_id',  v_profile_id
    );
END;
$function$;
