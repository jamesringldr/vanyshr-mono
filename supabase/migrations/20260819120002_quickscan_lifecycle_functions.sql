-- ============================================================================
-- Migration: 20260819120002_quickscan_lifecycle_functions.sql
-- ============================================================================
-- Description: Retarget the pre-auth lifecycle onto the `quickscan` schema.
--
--   create_pending_profile()   now writes quickscan.pending_*  (was public.user_*)
--   promote_pending_profile()  NEW — copies pending → public.user_* on auth
--   link_auth_to_profile()     now promotes instead of mutating in place
--   get_quick_scan_profile()   NEW — replaces the anon-key read of quick_scans
--
-- Identity note: a promoted profile REUSES the pending profile's UUID as its
--   public.user_profiles.id. This is load-bearing — magic-link.tsx puts that id
--   in sessionStorage and in the magic-link redirect URL, then hands it back to
--   link-auth-to-profile after the round trip. Minting a new id on promotion
--   would break that handoff.
-- ============================================================================


-- ============================================================================
-- SECTION 1: create_pending_profile() → quickscan.pending_*
-- ============================================================================
-- Behaviour changes from the previous version:
--   • Writes quickscan.pending_* instead of public.user_*.
--   • No longer seeds user_preferences or onboarding steps — those are
--     post-auth concerns and now happen at promotion time. Creating them for
--     someone who never authenticates was pure liability.
--   • Extends the originating scan's purge_after to +7 days: submitting an
--     email is the signal that this person initiated signup and has earned the
--     grace window. Anonymous scans keep their ~30-minute deadline.
--
-- Signature and return shape are unchanged, so create-pending-profile/index.ts
-- needs no edit.

CREATE OR REPLACE FUNCTION public.create_pending_profile(
    p_scan_id uuid,
    p_email   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_email_row  JSONB;
    v_alias      TEXT;
    v_digits     TEXT;
    v_fmt_phone  TEXT;
BEGIN
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
        COALESCE(v_scan.source, 'quickscan'),
        p_scan_id
    );

    -- The visitor initiated signup — promote the scan from the ~30-minute
    -- anonymous deadline to the 7-day grace window.
    UPDATE quickscan.quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id,
        purge_after          = NOW() + INTERVAL '7 days'
    WHERE id = p_scan_id;

    -- ── Phones ────────────────────────────────────────────────────────────────
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

    -- ── Emails (harvested by Phase 2 enrichment) ──────────────────────────────
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

    -- ── Addresses ─────────────────────────────────────────────────────────────
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

    -- ── Aliases ───────────────────────────────────────────────────────────────
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
$function$;

GRANT EXECUTE ON FUNCTION public.create_pending_profile(UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 2: promote_pending_profile() — the conversion moment
-- ============================================================================
-- Copies a pending profile and all of its PII from `quickscan` into `public`,
-- seeds the post-auth scaffolding that create_pending_profile no longer
-- creates, then deletes the source rows.
--
-- The DELETE is the point: after promotion there is exactly one copy of this
-- person's data, in public, governed by RLS. Nothing is left behind in
-- quickscan for the purge job to find or for a future leak to expose.
--
-- Idempotency: if the id already exists in public.user_profiles the function
-- returns success without re-copying. The auth callback can fire more than
-- once (there is a DB trigger that may race the Edge Function), so this must
-- be safe to call twice.

CREATE OR REPLACE FUNCTION public.promote_pending_profile(
    p_pending_id   UUID,
    p_auth_user_id UUID,
    p_email        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_pending RECORD;
    v_existing RECORD;
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

    -- ── Close out and clear the pre-auth copy ────────────────────────────────
    -- Cascade removes pending_phones/emails/addresses/aliases.
    DELETE FROM quickscan.pending_profiles WHERE id = v_pending.id;

    -- The scan itself has served its purpose. Drop its retention deadline and
    -- mark it complete; it is no longer purge-eligible because the person
    -- converted, and their data now lives in public.
    UPDATE quickscan.quick_scans
    SET status       = 'completed',
        completed_at = NOW(),
        purge_after  = NULL
    WHERE id = v_pending.source_quick_scan_id;

    RETURN jsonb_build_object(
        'success',      true,
        'profile_id',   v_pending.id,
        'auth_user_id', p_auth_user_id
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.promote_pending_profile(UUID, UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 3: link_auth_to_profile() — now a thin wrapper over promotion
-- ============================================================================
-- The old version UPDATEd public.user_profiles in place, because the row
-- already existed there pre-auth. It no longer does — the row lives in
-- quickscan.pending_profiles until this call. Signature and return shape are
-- unchanged so link-auth-to-profile/index.ts needs no edit.
--
-- The "already linked" branch the Edge Function special-cases still works:
-- promote_pending_profile() returns success with note='already promoted'.

CREATE OR REPLACE FUNCTION public.link_auth_to_profile(
    p_profile_id   UUID,
    p_auth_user_id UUID,
    p_email        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN public.promote_pending_profile(p_profile_id, p_auth_user_id, p_email);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.link_auth_to_profile(UUID, UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 4: get_quick_scan_profile() — replaces the anon-key table read
-- ============================================================================
-- pre-profile.tsx used to do:
--     supabase.from("quick_scans").select("profile_data, converted_to_user_id")
-- with the anon key. quick_scans is no longer reachable that way (no USAGE on
-- the schema for anon), so that read becomes this SECURITY DEFINER RPC.
--
-- It returns only the two fields that page actually needs, scoped to a single
-- scan id the caller already possesses. It deliberately does not accept a
-- filter or return a list — an anon caller can only fetch a scan whose uuid
-- they already hold.

CREATE OR REPLACE FUNCTION public.get_quick_scan_profile(p_scan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, quickscan
AS $function$
DECLARE
    v_scan RECORD;
BEGIN
    SELECT profile_data, converted_to_user_id
    INTO v_scan
    FROM quickscan.quick_scans
    WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'success',              true,
        'profile_data',         v_scan.profile_data,
        'converted_to_user_id', v_scan.converted_to_user_id
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_quick_scan_profile(UUID) TO anon, authenticated, service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Unchanged signatures (no Edge Function edits needed):
--   create_pending_profile(UUID, TEXT)
--   link_auth_to_profile(UUID, UUID, TEXT)
--
-- New:
--   promote_pending_profile(UUID, UUID, TEXT)   service_role
--   get_quick_scan_profile(UUID)                anon + authenticated
--
-- Frontend edit still required:
--   apps/app/src/pages/scan/pre-profile.tsx:590 — replace the
--   .from("quick_scans") read with .rpc("get_quick_scan_profile", ...)
-- ============================================================================
