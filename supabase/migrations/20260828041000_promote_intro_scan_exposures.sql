-- ============================================================================
-- Migration: 20260828041000_promote_intro_scan_exposures.sql
-- ============================================================================
-- Description: On conversion, copy the selected intro-scan match group's
--              broker listings into public.exposures. New signups only —
--              existing accounts are not backfilled. Falls back to the
--              legacy quickscan_dedup_groups members list when the pending
--              row came from quick_scans rather than quickscans.
-- ============================================================================

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
    v_pending    RECORD;
    v_existing   RECORD;
    v_breaches   INT := 0;
    v_lc         INT := 0;
    v_exposures  INT := 0;
    v_legacy     INT := 0;
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

        -- ── Intro-scan broker listings → public.exposures ─────────────────
        WITH selected AS (
            SELECT
                qs.id AS scan_id,
                COALESCE(fp.match_group_id, sr.match_group_id) AS match_group_id,
                qs.selected_full_profile_result_id,
                qs.selected_summary_result_id
            FROM quickscan.quickscans qs
            LEFT JOIN quickscan.full_profile_results fp
                ON fp.id = qs.selected_full_profile_result_id
            LEFT JOIN quickscan.summary_results sr
                ON sr.id = qs.selected_summary_result_id
            WHERE qs.id = v_pending.source_quick_scan_id
        ),
        listings AS (
            SELECT
                fpr.target AS slug,
                0 AS source_rank,
                NULLIF(trim(COALESCE(fpr.raw->>'profile_url', sr.profile_url, '')), '') AS profile_url,
                NULLIF(trim(COALESCE(fpr.raw->>'full_name', sr.full_name, '')), '') AS full_name,
                NULLIF(trim(COALESCE(fpr.raw->>'address', sr.address, '')), '') AS address,
                NULLIF(trim(COALESCE(fpr.raw->>'age', sr.age::text, '')), '') AS age
            FROM selected s
            JOIN quickscan.full_profile_results fpr
                ON fpr.quickscans_id = s.scan_id
               AND (
                    fpr.id = s.selected_full_profile_result_id
                    OR (s.match_group_id IS NOT NULL AND fpr.match_group_id = s.match_group_id)
                   )
            LEFT JOIN quickscan.summary_results sr ON sr.id = fpr.summary_result_id
            WHERE fpr.status IN ('success', 'partial')

            UNION ALL

            SELECT
                sr.target,
                1,
                NULLIF(trim(sr.profile_url), ''),
                NULLIF(trim(sr.full_name), ''),
                NULLIF(trim(sr.address), ''),
                sr.age::text
            FROM selected s
            JOIN quickscan.summary_results sr
                ON sr.quickscans_id = s.scan_id
               AND (
                    sr.id = s.selected_summary_result_id
                    OR (s.match_group_id IS NOT NULL AND sr.match_group_id = s.match_group_id)
                   )
            WHERE sr.status IN ('success', 'partial')
              AND NOT EXISTS (
                    SELECT 1
                    FROM quickscan.full_profile_results fpr
                    WHERE fpr.quickscans_id = s.scan_id
                      AND fpr.target = sr.target
                      AND (
                            fpr.summary_result_id = sr.id
                            OR (s.match_group_id IS NOT NULL AND fpr.match_group_id = s.match_group_id)
                          )
              )
        ),
        ranked AS (
            SELECT DISTINCT ON (slug) *
            FROM listings
            WHERE profile_url IS NOT NULL
            ORDER BY slug, source_rank
        )
        INSERT INTO public.exposures (
            user_id, broker_id, profile_url, profile_identifier,
            data_snapshot, status, found_in_scan_id, first_found_at, last_seen_at
        )
        SELECT
            v_pending.id,
            b.id,
            r.profile_url,
            r.slug,
            jsonb_strip_nulls(jsonb_build_object(
                'broker_slug',  b.slug,
                'broker_name',  b.name,
                'company_url',  b.company_url,
                'name',         r.full_name,
                'full_name',    r.full_name,
                'address',      r.address,
                'age',          r.age,
                'profile_url',  r.profile_url
            )),
            'found',
            v_pending.source_quick_scan_id,
            NOW(),
            NOW()
        FROM ranked r
        JOIN brokers.brokers b ON b.slug = r.slug
        WHERE NOT EXISTS (
            SELECT 1 FROM public.exposures e
            WHERE e.user_id = v_pending.id
              AND e.broker_id = b.id
              AND COALESCE(e.profile_url, '') = COALESCE(r.profile_url, '')
        );

        GET DIAGNOSTICS v_exposures = ROW_COUNT;

        -- Legacy quick_scans: members of the enrichment's selected dedup group.
        IF v_exposures = 0 THEN
            WITH members AS (
                SELECT
                    lower(NULLIF(trim(COALESCE(
                        m->'summary'->>'broker',
                        m->>'broker',
                        ''
                    )), '')) AS slug,
                    NULLIF(trim(COALESCE(
                        m->'summary'->>'profile_url',
                        m->>'profile_url',
                        ''
                    )), '') AS profile_url,
                    NULLIF(trim(COALESCE(
                        m->'summary'->>'full_name',
                        m->>'full_name',
                        ''
                    )), '') AS full_name,
                    NULLIF(trim(COALESCE(
                        m->'summary'->>'address',
                        m->>'address',
                        ''
                    )), '') AS address,
                    NULLIF(trim(COALESCE(
                        m->'summary'->>'age',
                        m->'summary'->>'age_range',
                        ''
                    )), '') AS age
                FROM quickscan.quickscan_enrichment en
                JOIN quickscan.quickscan_dedup_groups g ON g.id = en.dedup_group_id
                CROSS JOIN LATERAL jsonb_array_elements(
                    COALESCE(g.full_data->'members', '[]'::jsonb)
                ) AS m
                WHERE en.quick_scan_id = v_pending.source_quick_scan_id
            ),
            ranked AS (
                SELECT DISTINCT ON (slug) *
                FROM members
                WHERE slug IS NOT NULL AND profile_url IS NOT NULL
                ORDER BY slug
            )
            INSERT INTO public.exposures (
                user_id, broker_id, profile_url, profile_identifier,
                data_snapshot, status, found_in_scan_id, first_found_at, last_seen_at
            )
            SELECT
                v_pending.id,
                b.id,
                r.profile_url,
                r.slug,
                jsonb_strip_nulls(jsonb_build_object(
                    'broker_slug',  b.slug,
                    'broker_name',  b.name,
                    'company_url',  b.company_url,
                    'name',         r.full_name,
                    'full_name',    r.full_name,
                    'address',      r.address,
                    'age',          r.age,
                    'profile_url',  r.profile_url
                )),
                'found',
                v_pending.source_quick_scan_id,
                NOW(),
                NOW()
            FROM ranked r
            JOIN brokers.brokers b ON b.slug = r.slug
            WHERE NOT EXISTS (
                SELECT 1 FROM public.exposures e
                WHERE e.user_id = v_pending.id
                  AND e.broker_id = b.id
                  AND COALESCE(e.profile_url, '') = COALESCE(r.profile_url, '')
            );

            GET DIAGNOSTICS v_legacy = ROW_COUNT;
            v_exposures := v_exposures + v_legacy;
        END IF;
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
        'success',             true,
        'profile_id',          v_pending.id,
        'auth_user_id',        p_auth_user_id,
        'breaches_promoted',   v_breaches,
        'exposures_promoted',  v_exposures
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.promote_pending_profile(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_pending_profile(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.promote_pending_profile(uuid, uuid, text) IS
  'Convert a pending profile into a real user. Copies harvested PII, breaches, '
  'and selected intro-scan broker listings into public.exposures. Closes out '
  'whichever scan parent the pending row came from with a 30-day purge.';
