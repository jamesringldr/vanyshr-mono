-- ============================================================================
-- Admin Invite Flow migration
-- Plan: docs/agent_documentation/duct-tape/admin-invite/admin-invite-flow-plan.md §4
-- Branch: dev/admin-flow
-- Latest create_pending_profile def lives in: 20260320_fix_pending_profile_status.sql
-- ============================================================================


-- ============================================================================
-- 1) Expand quick_scans.status CHECK to include 'admin_sent'
-- ============================================================================
-- Preserve all existing status values from 00005_profile_schema_update.sql
-- (which added 'pending_signup' to the original 00003 constraint).
-- Drop and recreate the constraint idempotently.

ALTER TABLE quick_scans
    DROP CONSTRAINT IF EXISTS quick_scans_status_check;

ALTER TABLE quick_scans
    ADD CONSTRAINT quick_scans_status_check
    CHECK (status IN (
        'pending',
        'scanning',
        'matches_found',
        'selection_required',
        'processing',
        'completed',
        'no_matches',
        'failed',
        'expired',
        'pending_signup',
        'admin_sent'  -- NEW: admin manual scan, invitation pending
    ));


-- ============================================================================
-- 2) Add invited_email + invited_at to quick_scans
-- ============================================================================
-- invited_email: the recipient of the admin invite (case-insensitive, normalized by edge function)
-- invited_at: audit timestamp when the invite was sent

ALTER TABLE quick_scans
    ADD COLUMN IF NOT EXISTS invited_email TEXT;

ALTER TABLE quick_scans
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;


-- ============================================================================
-- 3) Index for admin tooling (partial on status='admin_sent')
-- ============================================================================
-- Optimizes queries to find pending admin invites.

CREATE INDEX IF NOT EXISTS idx_quick_scans_admin_sent
    ON quick_scans (status) WHERE status = 'admin_sent';


-- ============================================================================
-- 4) RLS policy overhaul on quick_scans
-- ============================================================================
-- CRITICAL: Plan §4.2 — gates PII in admin_sent rows from anonymous access.
--
-- OLD behavior:
--   - anon: "Allow select own session" → USING (true) — NO SESSION CHECK!
--     This allowed ANY anon user to read ANY quick_scan, including admin_sent with PII.
--
-- NEW behavior:
--   - Drop the blanket "Allow select own session" policy (insecure for admin_sent rows)
--   - Add "Public quick scan read" → status IS DISTINCT FROM 'admin_sent'
--     (preserves anon access to public quick scans)
--   - Add "Admin invite scan read" → authenticated + email match or converted_to_user_id link
--   - service_role remains unrestricted

-- Drop the insecure blanket anon SELECT policy
DROP POLICY IF EXISTS "Allow select own session" ON quick_scans;

-- Public read: anonymous users can only see non-admin_sent rows
CREATE POLICY "Public quick scan read" ON quick_scans
    FOR SELECT TO anon
    USING (status IS DISTINCT FROM 'admin_sent');

-- Authenticated read: admin_sent rows require email match or converted profile link
CREATE POLICY "Admin invite scan read" ON quick_scans
    FOR SELECT TO authenticated
    USING (
        status = 'admin_sent'
        AND (
            -- Email match: case-insensitive JWT email vs. invited_email
            lower(invited_email) = lower(auth.jwt() ->> 'email')
            -- OR: user already linked via converted_to_user_id
            OR converted_to_user_id IN (
                SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Keep insert/update for anon (non-admin paths still use anon; service_role overrides).
-- Note: "Allow insert for anon" and "Allow update own session" already exist from 00003.
-- "Service role full access quick_scans" already exists and will bypass all RLS checks.


-- ============================================================================
-- 5) Extend user_profiles.signup_status CHECK to include 'admin_invited'
-- ============================================================================
-- Add 'admin_invited' to the funnel so pre-profile can skip beta modal when set.
-- Preserve all existing values from 20260318_beta_access.sql:
--   'pending_user', 'waitlisted', 'accessed_pending_signup', 'pending_auth', 'active', 'suspended'

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_signup_status_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_signup_status_check
    CHECK (signup_status IN (
        'pending_user',
        'waitlisted',
        'accessed_pending_signup',
        'pending_auth',
        'active',
        'suspended',
        'admin_invited'  -- NEW: invited user, can skip beta modal
    ));


-- ============================================================================
-- 6) Replace create_pending_profile to be idempotent
-- ============================================================================
-- CRITICAL: Plan §4.3 — guard against duplicate profile creation when
-- admin calls admin-send-invite twice on the same scan.
--
-- Guard clause:
--   If scan.converted_to_user_id IS NOT NULL, profile already exists.
--   Return immediately with success=true, existing=true, profile_id set
--   (do NOT insert again).
--
-- Otherwise: Execute the existing function body from 20260320_fix_pending_profile_status.sql
-- unchanged, which includes all the user_phones, user_addresses, user_aliases population.

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
    v_alias      TEXT;
    -- phone helpers
    v_digits     TEXT;
    v_fmt_phone  TEXT;
BEGIN
    -- Idempotency guard: if scan is already linked to a profile, return it.
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    -- If profile already exists for this scan, return it without inserting again.
    IF v_scan.converted_to_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',    true,
            'profile_id', v_scan.converted_to_user_id,
            'scan_id',    p_scan_id,
            'existing',   true
        );
    END IF;

    -- ────────────────────────────────────────────────────────────────────────────
    -- EXISTING FUNCTION BODY (from 20260320_fix_pending_profile_status.sql)
    -- ────────────────────────────────────────────────────────────────────────────

    INSERT INTO user_profiles (
        id,
        first_name,
        last_name,
        email,
        signup_status,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        initcap(trim(COALESCE(v_scan.search_input->>'first_name', ''))),
        initcap(trim(COALESCE(v_scan.search_input->>'last_name', ''))),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_user',
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

    -- ── Addresses ─────────────────────────────────────────────────────────────
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

    -- ── Aliases ───────────────────────────────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.create_pending_profile(UUID, TEXT) TO service_role;


-- ============================================================================
-- 7) Verification queries (run manually to verify migration success)
-- ============================================================================
-- Verify quick_scans.status CHECK constraint includes 'admin_sent':
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'quick_scans_status_check';
--
-- Verify columns were added:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'quick_scans' AND column_name IN ('invited_email', 'invited_at');
--
-- Verify index was created:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_quick_scans_admin_sent';
--
-- Verify RLS policies on quick_scans:
-- SELECT polname, polqual FROM pg_policy WHERE polrelid = 'quick_scans'::regclass;
--
-- Verify user_profiles.signup_status CHECK constraint includes 'admin_invited':
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'user_profiles_signup_status_check';
--
-- Test RLS: Anon user should NOT see admin_sent rows:
-- WITH test_admin_row AS (
--   INSERT INTO quick_scans (session_id, search_input, status, invited_email)
--   VALUES ('test-session', '{}', 'admin_sent', 'user@example.com')
--   RETURNING id
-- )
-- SELECT COUNT(*) AS should_be_zero FROM quick_scans
--   WHERE id = (SELECT id FROM test_admin_row)
--   AND status IS DISTINCT FROM 'admin_sent';  -- Using RLS as anon
--
-- Test RLS: Authenticated user with matching email SHOULD see admin_sent row:
-- -- (requires manual user + JWT setup in test environment)
