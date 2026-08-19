-- ============================================================================
-- Migration: 20260819120005_fix_create_pending_profile_overload.sql
-- ============================================================================
-- Description: Retarget the 3-arg create_pending_profile overload — the one
--              production actually calls — and drop the 2-arg overload.
--
-- The bug this fixes (introduced by 20260819120002):
--   Two overloads existed in the database:
--       create_pending_profile(uuid, text)
--       create_pending_profile(uuid, text, text)   -- adds p_source
--
--   20260819120002 rewrote only the 2-arg version to write into
--   quickscan.pending_*. But BOTH live callers pass p_source:
--       supabase/functions/create-pending-profile/index.ts:52
--       supabase/functions/admin-parse-html/index.ts:113
--   …so production resolves to the 3-arg overload, which still wrote pre-auth
--   PII into public.user_profiles / user_phones / user_addresses /
--   user_aliases. The partition was silently bypassed for every new signup.
--
--   The two overloads also made the function ambiguous to any caller passing
--   exactly two arguments (42725: function is not unique), because the 3-arg
--   version's p_source has a DEFAULT.
--
-- Fix: the 3-arg version becomes canonical and writes to quickscan; the 2-arg
--      version is dropped so no ambiguity — and no path back into public — is
--      left behind.
-- ============================================================================


-- ============================================================================
-- SECTION 1: Drop the 2-arg overload
-- ============================================================================
-- Nothing calls it: both Edge Function call sites pass p_source. Removing it
-- also resolves the "function is not unique" ambiguity for 2-arg callers.

DROP FUNCTION IF EXISTS public.create_pending_profile(uuid, text);


-- ============================================================================
-- SECTION 2: Canonical 3-arg version, writing into quickscan
-- ============================================================================
-- Body is identical to the 2-arg version from 20260819120002, except that
-- `source` comes from p_source (the caller's intent: 'invite' for admin
-- concierge flows, 'quickscan' for organic) rather than being inherited from
-- the scan row.

CREATE OR REPLACE FUNCTION public.create_pending_profile(
    p_scan_id uuid,
    p_email   text DEFAULT NULL,
    p_source  text DEFAULT 'quickscan'
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
        CASE WHEN p_source IN ('invite', 'quickscan') THEN p_source ELSE 'quickscan' END,
        p_scan_id
    );

    -- Submitting an email is the signal that this person initiated signup —
    -- promote the scan from the ~30-minute anonymous deadline to the 7-day
    -- grace window.
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

    -- ── Emails (harvested during enrichment) ──────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.create_pending_profile(UUID, TEXT, TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- public.create_pending_profile(uuid, text)        DROPPED
-- public.create_pending_profile(uuid, text, text)  canonical, writes quickscan
--
-- Lesson for future edits: check pg_proc for overloads before CREATE OR
-- REPLACE. Replacing one signature leaves the others live and silently
-- diverging, which is how the original 'pending_auth' bug in 20260318 happened
-- too (see 20260320100001).
-- ============================================================================
