-- ============================================================================
-- Migration: 20260828031500_create_pending_profile_from_intro_quickscans.sql
-- ============================================================================
-- Description: Point create_pending_profile() at the live intro-scan parent
--              (quickscan.quickscans) and copy harvested PII from the child
--              tables. Keep the old quick_scans + profile_data path as a
--              fallback so admin/invite scans still convert.
--
-- The consumer funnel writes to quickscan.quickscans (intro-scan). Signup
-- still looked up quickscan.quick_scans, so a finished intro scan returned
-- "Quick scan not found" at the magic-link step.
-- ============================================================================


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

    -- ── Live intro-scan path ──────────────────────────────────────────────────
    SELECT * INTO v_intro FROM quickscan.quickscans WHERE id = p_scan_id;

    -- FOUND, not `v_intro IS NOT NULL`: a composite IS NOT NULL is false when
    -- any column on the row is null, which is true of almost every intro scan.
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

        -- Do not overwrite pipeline status (full_profile_scan_complete, etc.).
        -- Extending purge_after is the signup-initiated grace window.
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
          AND p.duplicate_of IS NULL;

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

    -- ── Legacy admin/invite path (quick_scans + profile_data blob) ────────────
    SELECT * INTO v_scan FROM quickscan.quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
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

COMMENT ON FUNCTION public.create_pending_profile(uuid, text, text) IS
  'Mint a quickscan.pending_profiles row from a scan. Prefers the live '
  'intro-scan parent (quickscan.quickscans + child tables); falls back to '
  'legacy quickscan.quick_scans.profile_data for admin/invite scans.';


-- When the magic link is clicked, close out whichever parent table the
-- pending row actually came from. Also promote Leakcheck breaches from the
-- intro-scan tables (old path still reads quickscan_enrichment).

CREATE OR REPLACE FUNCTION public.promote_pending_profile(
    p_pending_id   uuid,
    p_auth_user_id uuid,
    p_email        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, quickscan
AS $fn$
DECLARE
    v_pending  RECORD;
    v_existing RECORD;
    v_breaches INT := 0;
    v_lc       INT := 0;
BEGIN
    SELECT * INTO v_existing FROM public.user_profiles WHERE id = p_pending_id;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',      true,
            'profile_id',   p_pending_id,
            'auth_user_id', v_existing.auth_user_id,
            'note',         'already promoted'
        );
    END IF;

    SELECT * INTO v_pending
    FROM quickscan.pending_profiles WHERE id = p_pending_id;

    IF v_pending IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Pending profile not found (may have been purged)'
        );
    END IF;

    INSERT INTO public.user_profiles (
        id, first_name, last_name, email,
        auth_user_id, signup_status,
        source, source_quick_scan_id,
        onboarding_completed, onboarding_step
    ) VALUES (
        v_pending.id,
        v_pending.first_name,
        v_pending.last_name,
        COALESCE(NULLIF(trim(p_email), ''), v_pending.email),
        p_auth_user_id,
        'active',
        v_pending.source,
        v_pending.source_quick_scan_id,
        FALSE,
        0
    );

    INSERT INTO public.user_preferences (user_id) VALUES (v_pending.id)
    ON CONFLICT DO NOTHING;

    PERFORM public.initialize_onboarding_steps(v_pending.id);

    UPDATE public.user_onboarding_progress
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE user_id = v_pending.id AND step = 'account_signup';

    INSERT INTO public.user_phones (
        user_id, number, is_primary, source, user_confirmed_status
    )
    SELECT pending_profile_id, number, is_primary, 'quick_scan', 'unverified'
    FROM quickscan.pending_phones
    WHERE pending_profile_id = v_pending.id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_addresses (
        user_id, full_address, street, city, state, zip,
        is_current, source, user_confirmed_status
    )
    SELECT pending_profile_id, full_address, street, city, state, zip,
           is_current, 'quick_scan', 'unverified'
    FROM quickscan.pending_addresses
    WHERE pending_profile_id = v_pending.id;

    INSERT INTO public.user_aliases (
        user_id, name, source, user_confirmed_status
    )
    SELECT pending_profile_id, name, 'quick_scan', 'unverified'
    FROM quickscan.pending_aliases
    WHERE pending_profile_id = v_pending.id;

    INSERT INTO public.user_emails (
        user_id, email, is_primary, source, user_confirmed_status
    )
    SELECT pending_profile_id, email, FALSE, 'quick_scan', 'unverified'
    FROM quickscan.pending_emails
    WHERE pending_profile_id = v_pending.id
    ON CONFLICT (user_id, email) DO NOTHING;

    INSERT INTO public.user_emails (
        user_id, email, is_primary, source, user_confirmed_status, confirmed_at
    ) VALUES (
        v_pending.id, p_email, TRUE, 'auth', 'confirmed', NOW()
    )
    ON CONFLICT (user_id, email) DO UPDATE
        SET is_primary            = TRUE,
            user_confirmed_status = 'confirmed',
            confirmed_at          = NOW(),
            source                = 'auth',
            updated_at            = NOW();

    IF v_pending.source_quick_scan_id IS NOT NULL THEN
        INSERT INTO public.data_breaches (
            user_id, breach_name, breach_title, breach_domain,
            breach_date, matched_email, status, hibp_data
        )
        SELECT
            v_pending.id,
            b->>'name',
            NULLIF(b->>'name', ''),
            NULLIF(b->>'source', ''),
            CASE
                WHEN b->>'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (b->>'date')::date
                WHEN b->>'date' ~ '^\d{4}-\d{2}$'       THEN ((b->>'date') || '-01')::date
                ELSE NULL
            END,
            (SELECT e.email FROM unnest(en.emails_found) AS e(email) LIMIT 1),
            'new',
            b
        FROM quickscan.quickscan_enrichment en
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(en.breaches, '[]'::jsonb)) AS b
        WHERE en.quick_scan_id = v_pending.source_quick_scan_id
          AND COALESCE(b->>'name', '') <> ''
        ON CONFLICT (user_id, breach_name, matched_email) DO NOTHING;

        GET DIAGNOSTICS v_breaches = ROW_COUNT;

        INSERT INTO public.data_breaches (
            user_id, breach_name, breach_title, breach_domain,
            breach_date, matched_email, status, hibp_data
        )
        SELECT
            v_pending.id,
            b->>'name',
            NULLIF(b->>'name', ''),
            NULLIF(b->>'source', ''),
            CASE
                WHEN b->>'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (b->>'date')::date
                WHEN b->>'date' ~ '^\d{4}-\d{2}$'       THEN ((b->>'date') || '-01')::date
                ELSE NULL
            END,
            lr.email,
            'new',
            b
        FROM quickscan.leakcheck_results lr
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(lr.breaches, '[]'::jsonb)) AS b
        WHERE lr.quickscans_id = v_pending.source_quick_scan_id
          AND lr.status = 'success'
          AND COALESCE(b->>'name', '') <> ''
        ON CONFLICT (user_id, breach_name, matched_email) DO NOTHING;

        GET DIAGNOSTICS v_lc = ROW_COUNT;
        v_breaches := v_breaches + v_lc;
    END IF;

    DELETE FROM quickscan.pending_profiles WHERE id = v_pending.id;

    UPDATE quickscan.quick_scans
    SET status       = 'completed',
        completed_at = NOW(),
        purge_after  = NOW() + INTERVAL '30 days'
    WHERE id = v_pending.source_quick_scan_id;

    UPDATE quickscan.quickscans
    SET signup_status = 'member',
        purge_after   = NOW() + INTERVAL '30 days'
    WHERE id = v_pending.source_quick_scan_id;

    RETURN jsonb_build_object(
        'success',           true,
        'profile_id',        v_pending.id,
        'auth_user_id',      p_auth_user_id,
        'breaches_promoted', v_breaches
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.promote_pending_profile(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_pending_profile(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.promote_pending_profile(uuid, uuid, text) IS
  'Convert a pending profile into a real user. Copies harvested PII, legacy '
  'quickscan_enrichment breaches, and intro-scan leakcheck_results. Closes out '
  'whichever scan parent the pending row came from with a 30-day purge.';
