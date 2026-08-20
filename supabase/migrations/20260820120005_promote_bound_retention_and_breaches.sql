-- ============================================================================
-- Migration: 20260820120005_promote_bound_retention_and_breaches.sql
-- ============================================================================
-- Description: Two fixes to promote_pending_profile() — stop conversion from
--              making pre-auth PII immortal, and carry breaches across.
--              (docs/SCHEMA_REVIEW.md §4, docs/PUNCHLIST.md §3.2)
--
-- FIX 1 — the retention bug.
--   The function ended with:
--
--       UPDATE quickscan.quick_scans
--       SET status='completed', completed_at=NOW(), purge_after=NULL
--
--   with a comment explaining the row "is no longer purge-eligible because the
--   person converted." The comment states the intent exactly backwards.
--   purge_expired() filters on `purge_after IS NOT NULL AND purge_after < NOW()`,
--   so NULL does not retire a row — it makes it IMMORTAL. And that row still
--   holds the full pre-auth scrape in search_input and profile_data.
--
--   The correlation in production is exact: all 16 NULL-purge_after scans are
--   converted ones, every one carrying PII in both columns. The documented
--   model ("source rows deleted on conversion") is inverted in practice — the
--   pre-auth copy is the ONE thing that never expires.
--
--   Now set to NOW() + 30 days: long enough to support a new account and
--   investigate a bad conversion, bounded enough to actually expire.
--
--   ⚠️  This changes NEW conversions only. The 16 existing rows are left alone
--       on purpose — see docs/PUNCHLIST.md §3.3. Sweeping them here would make
--       16 real people's PII purge-eligible as a side effect of a function fix,
--       which is a decision that deserves to be made deliberately.
--
-- FIX 2 — promote breaches.
--   The function copied pending_phones/addresses/aliases/emails but never
--   touched quickscan_enrichment, so breaches died at the exact moment someone
--   became a customer. Harmless while Phase 2 stored nothing; now that it does
--   (20260820120000-4), it is real data loss.
--
--   ⚠️  ONLY breaches are promoted. The other two enrichment outputs have no
--       destination in `public`, and this migration does NOT invent one:
--
--       • Holehe services (github, spotify, …): there is NO table for online
--         accounts anywhere in `public` — no %account%/%service%/%social%
--         table exists. public.exposures is NOT it: exposures.broker_id is
--         NOT NULL and references brokers.brokers, i.e. it models data-broker
--         listings with a removal workflow. An online account is not a broker.
--
--       • Broker listings from Phase 1 would legitimately belong in
--         public.exposures — but brokers.brokers currently has ZERO rows, and
--         broker_id is NOT NULL, so no exposure row can be created at all
--         until that table is populated.
--
--   Both are tracked in docs/PUNCHLIST.md rather than bodged in here.
-- ============================================================================


CREATE OR REPLACE FUNCTION public.promote_pending_profile(
    p_pending_id   uuid,
    p_auth_user_id uuid,
    p_email        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_pending  RECORD;
    v_existing RECORD;
    v_breaches INT := 0;
BEGIN
    -- Already promoted? Nothing to do.
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

    -- ── Core profile ──────────────────────────────────────────────────────────
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

    -- Post-auth scaffolding, deliberately not created before this moment.
    INSERT INTO public.user_preferences (user_id) VALUES (v_pending.id)
    ON CONFLICT DO NOTHING;

    PERFORM public.initialize_onboarding_steps(v_pending.id);

    UPDATE public.user_onboarding_progress
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE user_id = v_pending.id AND step = 'account_signup';

    -- ── Harvested PII ─────────────────────────────────────────────────────────
    -- Column names match by design, so these stay straight copies.
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

    -- The authenticated magic-link address — pre-confirmed, primary.
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

    -- ── Enrichment: breaches ─────────────────────────────────────────────────
    -- Sourced from every enrichment row belonging to the scan, not just the one
    -- quick_scans.enrichment_id points at, so a re-run that produced a second
    -- row cannot silently drop breaches.
    --
    -- ON CONFLICT rides the existing UNIQUE (user_id, breach_name,
    -- matched_email), making this idempotent.
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
            -- Provider dates are free-form. Accept YYYY-MM-DD, widen YYYY-MM to
            -- the first of the month, and give up rather than raise: one
            -- unparseable date must not abort somebody's signup.
            CASE
                WHEN b->>'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (b->>'date')::date
                WHEN b->>'date' ~ '^\d{4}-\d{2}$'       THEN ((b->>'date') || '-01')::date
                ELSE NULL
            END,
            -- Breach records carry no per-breach email; the enrichment's first
            -- harvested address is the best available attribution. It is part
            -- of the dedupe key, so keep it stable.
            (SELECT e.email FROM unnest(en.emails_found) AS e(email) LIMIT 1),
            'new',
            -- Column is named for HIBP but is the only raw-payload slot here.
            -- Kept so `url` and `source` are not lost on promotion.
            b
        FROM quickscan.quickscan_enrichment en
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(en.breaches, '[]'::jsonb)) AS b
        WHERE en.quick_scan_id = v_pending.source_quick_scan_id
          AND COALESCE(b->>'name', '') <> ''
        ON CONFLICT (user_id, breach_name, matched_email) DO NOTHING;

        GET DIAGNOSTICS v_breaches = ROW_COUNT;
    END IF;

    -- ── Close out and clear the pre-auth copy ────────────────────────────────
    -- Cascade removes pending_phones/emails/addresses/aliases.
    DELETE FROM quickscan.pending_profiles WHERE id = v_pending.id;

    -- The scan has served its purpose. Give it a BOUNDED deadline: the previous
    -- NULL did not retire the row, it exempted it from purge_expired() forever
    -- while it still held the full pre-auth scrape.
    UPDATE quickscan.quick_scans
    SET status       = 'completed',
        completed_at = NOW(),
        purge_after  = NOW() + INTERVAL '30 days'
    WHERE id = v_pending.source_quick_scan_id;

    RETURN jsonb_build_object(
        'success',           true,
        'profile_id',        v_pending.id,
        'auth_user_id',      p_auth_user_id,
        'breaches_promoted', v_breaches
    );
END;
$function$;

COMMENT ON FUNCTION public.promote_pending_profile(uuid, uuid, text) IS
  'Convert a pending profile into a real user. Copies harvested PII and any '
  'breaches from quickscan_enrichment, then sets the source scan to expire in '
  '30 days -- NOT NULL, which would exempt it from purge_expired() forever. '
  'Holehe services and broker listings are NOT promoted: no public table '
  'models online accounts, and public.exposures requires a brokers.brokers row '
  '(that table is empty). See docs/PUNCHLIST.md.';
