-- ============================================================================
-- Migration: 20260519120000_user_profiles_source.sql
-- ============================================================================
-- Description: Add signup source to user_profiles (invite | quickscan),
--              expose minimal invite welcome data via get_invite_profile(),
--              and thread source through create_pending_profile().
-- ============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'quickscan';

ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_source_check;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_source_check
    CHECK (source IN ('invite', 'quickscan'));

COMMENT ON COLUMN public.user_profiles.source IS
    'How the profile was created: quickscan (public funnel) or invite (admin/concierge).';

CREATE INDEX IF NOT EXISTS idx_user_profiles_source
    ON public.user_profiles (source)
    WHERE source = 'invite';

-- Backfill existing rows created from quick scans.
UPDATE public.user_profiles
SET source = 'quickscan'
WHERE source IS NULL
   OR source = 'quickscan';

-- Minimal, anon-safe lookup for /invite?id=<profile_uuid>.
-- Returns first_name only for invite profiles still in the pre-auth funnel.
CREATE OR REPLACE FUNCTION public.get_invite_profile(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_row RECORD;
BEGIN
    IF p_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'profile_id_required');
    END IF;

    SELECT
        first_name,
        source,
        signup_status,
        source_quick_scan_id
    INTO v_row
    FROM public.user_profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_row.source IS DISTINCT FROM 'invite' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_source');
    END IF;

    IF v_row.signup_status NOT IN (
        'pending_user',
        'pending_auth',
        'accessed_pending_signup',
        'waitlisted'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'unavailable');
    END IF;

    RETURN jsonb_build_object(
        'success',    true,
        'first_name', NULLIF(trim(COALESCE(v_row.first_name, '')), ''),
        'scan_id',    v_row.source_quick_scan_id
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invite_profile(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.create_pending_profile(uuid, text);

CREATE OR REPLACE FUNCTION public.create_pending_profile(
    p_scan_id uuid,
    p_email   text DEFAULT NULL,
    p_source  text DEFAULT 'quickscan'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
    v_digits     TEXT;
    v_fmt_phone  TEXT;
    v_source     TEXT;
BEGIN
    v_source := lower(trim(COALESCE(p_source, 'quickscan')));
    IF v_source NOT IN ('invite', 'quickscan') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid source');
    END IF;

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
        source,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        initcap(trim(COALESCE(v_scan.search_input->>'first_name', ''))),
        initcap(trim(COALESCE(v_scan.search_input->>'last_name', ''))),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_user',
        v_source,
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

GRANT EXECUTE ON FUNCTION public.create_pending_profile(uuid, text, text) TO service_role;
