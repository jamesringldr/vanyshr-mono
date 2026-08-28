-- ============================================================================
-- Migration: 20260828034500_pending_profile_found_and_drop_fk.sql
-- ============================================================================
-- 1. Composite `IS NOT NULL` on a SELECT * INTO record is false when any
--    column is null, so intro scans were skipped and signup returned
--    "Quick scan not found". Use FOUND instead.
-- 2. pending_profiles.source_quick_scan_id still FKs to the old
--    quickscan.quick_scans parent. Intro-scan ids live on quickscans, so
--    the insert would fail next. Drop the FK (same pattern as
--    user_profiles.source_quick_scan_id — provenance breadcrumb, not a
--    cascade key).
-- ============================================================================

ALTER TABLE quickscan.pending_profiles
  DROP CONSTRAINT IF EXISTS pending_profiles_source_quick_scan_id_fkey;

COMMENT ON COLUMN quickscan.pending_profiles.source_quick_scan_id IS
  'Originating scan id (quickscan.quickscans or legacy quickscan.quick_scans). '
  'Not a foreign key — the scan is purged on its own schedule; this uuid is a '
  'provenance breadcrumb and may point at either parent table.';


CREATE OR REPLACE FUNCTION public.create_pending_profile(
    p_scan_id uuid,
    p_email   text DEFAULT NULL,
    p_source  text DEFAULT 'quickscan'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, quickscan
AS $fn$
DECLARE
    v_intro      RECORD;
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_source     TEXT;
    v_phone      JSONB;
    v_address    JSONB;
    v_email_row  JSONB;
    v_alias      TEXT;
    v_digits     TEXT;
    v_fmt_phone  TEXT;
BEGIN
    v_source := CASE WHEN p_source IN ('invite', 'quickscan') THEN p_source ELSE 'quickscan' END;

    SELECT * INTO v_intro FROM quickscan.quickscans WHERE id = p_scan_id;

    IF FOUND THEN
        INSERT INTO quickscan.pending_profiles (
            id, first_name, last_name, email,
            signup_status, source, source_quick_scan_id
        ) VALUES (
            v_profile_id,
            initcap(trim(COALESCE(v_intro.search_input->>'first_name', ''))),
            initcap(trim(COALESCE(v_intro.search_input->>'last_name', ''))),
            NULLIF(trim(COALESCE(p_email, '')), ''),
            'pending_user',
            v_source,
            p_scan_id
        );

        UPDATE quickscan.quickscans
        SET purge_after = GREATEST(purge_after, NOW() + INTERVAL '7 days')
        WHERE id = p_scan_id;

        INSERT INTO quickscan.pending_phones (
            pending_profile_id, number, is_primary, source
        )
        SELECT
            v_profile_id,
            CASE
                WHEN length(right(regexp_replace(p.normalized_value, '\D', '', 'g'), 10)) = 10 THEN
                    '(' || substr(right(regexp_replace(p.normalized_value, '\D', '', 'g'), 10), 1, 3)
                    || ') '
                    || substr(right(regexp_replace(p.normalized_value, '\D', '', 'g'), 10), 4, 3)
                    || '-'
                    || substr(right(regexp_replace(p.normalized_value, '\D', '', 'g'), 10), 7, 4)
                ELSE p.raw_value
            END,
            FALSE,
            'quick_scan'
        FROM quickscan.phones p
        WHERE p.quickscans_id = p_scan_id
          AND p.duplicate_of IS NULL;

        INSERT INTO quickscan.pending_emails (
            pending_profile_id, email, source
        )
        SELECT
            v_profile_id,
            lower(trim(p.normalized_value)),
            'quick_scan'
        FROM quickscan.emails p
        WHERE p.quickscans_id = p_scan_id
          AND p.duplicate_of IS NULL
          AND p.confirmed
          AND trim(p.normalized_value) <> ''
        ON CONFLICT (pending_profile_id, email) DO NOTHING;

        INSERT INTO quickscan.pending_addresses (
            pending_profile_id, full_address, is_current, source
        )
        SELECT
            v_profile_id,
            NULLIF(trim(p.raw_value), ''),
            p.is_current,
            'quick_scan'
        FROM quickscan.addresses p
        WHERE p.quickscans_id = p_scan_id
          AND p.duplicate_of IS NULL
          AND NULLIF(trim(p.raw_value), '') IS NOT NULL;

        INSERT INTO quickscan.pending_aliases (
            pending_profile_id, name, source
        )
        SELECT
            v_profile_id,
            initcap(trim(p.raw_value)),
            'quick_scan'
        FROM quickscan.aliases p
        WHERE p.quickscans_id = p_scan_id
          AND p.duplicate_of IS NULL
          AND trim(p.raw_value) <> '';

        RETURN jsonb_build_object(
            'success',    true,
            'profile_id', v_profile_id,
            'scan_id',    p_scan_id
        );
    END IF;

    SELECT * INTO v_scan FROM quickscan.quick_scans WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    INSERT INTO quickscan.pending_profiles (
        id, first_name, last_name, email,
        signup_status, source, source_quick_scan_id
    ) VALUES (
        v_profile_id,
        initcap(trim(COALESCE(v_scan.search_input->>'first_name', ''))),
        initcap(trim(COALESCE(v_scan.search_input->>'last_name', ''))),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_user',
        v_source,
        p_scan_id
    );

    UPDATE quickscan.quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id,
        purge_after          = NOW() + INTERVAL '7 days'
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

            INSERT INTO quickscan.pending_phones (
                pending_profile_id, number, is_primary, source
            ) VALUES (
                v_profile_id,
                v_fmt_phone,
                COALESCE((v_phone->>'is_primary')::boolean, FALSE),
                'quick_scan'
            );
        END LOOP;
    END IF;

    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'emails') = 'array'
    THEN
        FOR v_email_row IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'emails')
        LOOP
            CONTINUE WHEN v_email_row->>'email' IS NULL
                       OR trim(v_email_row->>'email') = '';

            INSERT INTO quickscan.pending_emails (
                pending_profile_id, email, source
            ) VALUES (
                v_profile_id,
                lower(trim(v_email_row->>'email')),
                'quick_scan'
            )
            ON CONFLICT (pending_profile_id, email) DO NOTHING;
        END LOOP;
    END IF;

    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'addresses') = 'array'
    THEN
        FOR v_address IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'addresses')
        LOOP
            INSERT INTO quickscan.pending_addresses (
                pending_profile_id,
                full_address, street, city, state, zip,
                is_current, source
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
                'quick_scan'
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

            INSERT INTO quickscan.pending_aliases (
                pending_profile_id, name, source
            ) VALUES (
                v_profile_id, initcap(trim(v_alias)), 'quick_scan'
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', v_profile_id,
        'scan_id',    p_scan_id
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_pending_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pending_profile(uuid, text, text) TO service_role;
