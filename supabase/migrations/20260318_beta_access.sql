-- ============================================================================
-- Migration: 20260318_beta_access.sql
-- ============================================================================
-- Description: Private beta access control.
--
--   1. Expand signup_status CHECK to include full beta funnel states
--   2. Update create_pending_profile() default status → 'pending_user'
--   3. access_codes table — shared multi-use (Option A) and user-specific (Option B)
--   4. validate_access_code() — validates code, increments use_count, advances profile status
--   5. join_waitlist() — captures waitlist email, advances profile status
--   6. purge_orphaned_beta_profiles() — cleanup job for abandoned pre-auth profiles
--
-- signup_status funnel:
--   pending_user            → "Start Vanyshing" clicked, modal shown, no action yet
--   waitlisted              → submitted waitlist email on modal
--   accessed_pending_signup → submitted valid access code, navigating to /signup
--   pending_auth            → email submitted on /signup, magic link sent (existing)
--   active                  → magic link clicked, fully authenticated (existing)
--   suspended               → account suspended (existing)
-- ============================================================================


-- ============================================================================
-- SECTION 1: Expand signup_status CHECK constraint
-- ============================================================================
-- Drop the existing 3-value check and replace with the full 6-value funnel.

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
        'suspended'
    ));

-- Update the column default so new rows land in 'pending_user' by default.
-- create_pending_profile() sets this explicitly, but the column default
-- should match the intended initial state.
ALTER TABLE user_profiles
    ALTER COLUMN signup_status SET DEFAULT 'pending_user';


-- ============================================================================
-- SECTION 2: Update create_pending_profile()
-- ============================================================================
-- Identical to the 00009 version except signup_status is now written as
-- 'pending_user' instead of 'pending_auth'.
-- The profile is anonymous at this point — no email, no auth, just a name
-- from the quick-scan form and a locked scan row.

CREATE OR REPLACE FUNCTION create_pending_profile(p_scan_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
BEGIN
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    INSERT INTO user_profiles (
        id,
        first_name,
        last_name,
        signup_status,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        COALESCE(v_scan.search_input->>'first_name', ''),
        COALESCE(v_scan.search_input->>'last_name', ''),
        'pending_user',
        p_scan_id,
        FALSE,
        0
    );

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

            INSERT INTO user_phones (
                user_id, number, is_primary,
                source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                trim(v_phone->>'number'),
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
                NULLIF(trim(COALESCE(v_address->>'street',       '')), ''),
                NULLIF(trim(COALESCE(v_address->>'city',         '')), ''),
                NULLIF(trim(COALESCE(v_address->>'state',        '')), ''),
                NULLIF(trim(COALESCE(v_address->>'zip',          '')), ''),
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
                trim(v_alias),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 3: access_codes table
-- ============================================================================
-- Supports two modes:
--
--   Option A — shared multi-use code
--     max_uses                = NULL (unlimited) or an integer cap
--     reserved_for_profile_id = NULL
--     Example: one code handed out to all beta testers
--
--   Option B — user-specific single-use code (future, low-priority)
--     max_uses                = 1
--     reserved_for_profile_id = <waitlisted profile UUID>
--     Sent directly to a waitlisted user's email

CREATE TABLE IF NOT EXISTS public.access_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        NOT NULL UNIQUE,
    description TEXT,

    -- NULL = unlimited uses; integer = hard cap
    max_uses    INTEGER     CHECK (max_uses IS NULL OR max_uses > 0),
    use_count   INTEGER     NOT NULL DEFAULT 0 CHECK (use_count >= 0),

    -- Option B: restrict to a specific waitlisted profile
    -- NULL = anyone with the code can use it (Option A)
    reserved_for_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    is_active   BOOLEAN     NOT NULL DEFAULT true,
    expires_at  TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.access_codes IS 'Beta access codes. NULL max_uses = unlimited (shared). Set reserved_for_profile_id + max_uses=1 for user-specific codes.';
COMMENT ON COLUMN public.access_codes.max_uses   IS 'NULL = unlimited uses. Integer = hard cap on total redemptions.';
COMMENT ON COLUMN public.access_codes.reserved_for_profile_id IS 'Option B: code is reserved for a specific waitlisted profile. NULL = shared code (Option A).';

CREATE INDEX IF NOT EXISTS idx_access_codes_code
    ON public.access_codes(code) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_access_codes_reserved
    ON public.access_codes(reserved_for_profile_id)
    WHERE reserved_for_profile_id IS NOT NULL;

-- Normalize code to uppercase on insert or update so lookups are always consistent
CREATE OR REPLACE FUNCTION public.normalize_access_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.code = UPPER(TRIM(NEW.code));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_codes_normalize ON public.access_codes;
CREATE TRIGGER trg_access_codes_normalize
    BEFORE INSERT OR UPDATE ON public.access_codes
    FOR EACH ROW EXECUTE FUNCTION public.normalize_access_code();

DROP TRIGGER IF EXISTS trg_access_codes_updated_at ON public.access_codes;
CREATE TRIGGER trg_access_codes_updated_at
    BEFORE UPDATE ON public.access_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: service_role only — codes are never read or written directly from the client
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access access_codes" ON public.access_codes
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- SECTION 4: validate_access_code()
-- ============================================================================
-- Called by the validate-access-code edge function when a user submits a code
-- on the private beta modal.
--
-- Validates in order:
--   1. Code exists
--   2. is_active = true
--   3. Not expired
--   4. use_count < max_uses (skip if max_uses is NULL)
--
-- On success:
--   • Increments use_count atomically
--   • Updates profile signup_status → 'accessed_pending_signup'
--     (only if profile is currently 'pending_user' — prevents double-spend)
--
-- Returns: { success, profile_id } | { success: false, error }

CREATE OR REPLACE FUNCTION public.validate_access_code(
    p_code       TEXT,
    p_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code RECORD;
BEGIN
    SELECT * INTO v_code
    FROM public.access_codes
    WHERE code = UPPER(TRIM(p_code));

    IF v_code IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid access code');
    END IF;

    IF NOT v_code.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code is no longer active');
    END IF;

    IF v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has expired');
    END IF;

    IF v_code.max_uses IS NOT NULL AND v_code.use_count >= v_code.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has reached its usage limit');
    END IF;

    -- Atomically increment use_count
    UPDATE public.access_codes
    SET use_count  = use_count + 1,
        updated_at = NOW()
    WHERE id = v_code.id;

    -- Advance profile status (guard: only move forward from pending_user)
    UPDATE public.user_profiles
    SET signup_status = 'accessed_pending_signup',
        updated_at    = NOW()
    WHERE id           = p_profile_id
      AND signup_status = 'pending_user';

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', p_profile_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_access_code(TEXT, UUID) TO service_role;


-- ============================================================================
-- SECTION 5: join_waitlist()
-- ============================================================================
-- Called by the join-waitlist edge function when a user submits their email
-- on the private beta modal without an access code.
--
-- On success:
--   • Updates profile signup_status → 'waitlisted'
--   • Writes email to user_profiles.email
--   • Upserts email into user_emails (source = 'user_input', unverified)
--
-- Returns: { success, profile_id } | { success: false, error }

CREATE OR REPLACE FUNCTION public.join_waitlist(
    p_profile_id UUID,
    p_email      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id           = p_profile_id
          AND signup_status = 'pending_user'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found or not in pending state');
    END IF;

    UPDATE public.user_profiles
    SET signup_status = 'waitlisted',
        email         = LOWER(TRIM(p_email)),
        updated_at    = NOW()
    WHERE id = p_profile_id;

    INSERT INTO public.user_emails (
        user_id, email, is_primary,
        source, user_confirmed_status
    ) VALUES (
        p_profile_id,
        LOWER(TRIM(p_email)),
        TRUE,
        'user_input',
        'unverified'
    )
    ON CONFLICT (user_id, email) DO UPDATE
        SET is_primary = TRUE,
            updated_at = NOW();

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', p_profile_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist(UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 6: purge_orphaned_beta_profiles()
-- ============================================================================
-- Removes pre-auth profiles that were created but never converted.
-- Targets: pending_user (saw gate, did nothing) and
--          accessed_pending_signup (entered code, never requested magic link).
--
-- Cleanup order:
--   1. Unlock + expire the linked quick_scans rows first
--   2. Delete user_profiles rows (CASCADE handles child rows:
--      user_phones, user_addresses, user_aliases, user_onboarding_progress)
--
-- Intended for a scheduled cron job. Default threshold: 7 days.
-- Returns the number of profiles deleted.

CREATE OR REPLACE FUNCTION public.purge_orphaned_beta_profiles(
    p_older_than_days INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Unlock associated quick_scans so the standard cleanup job can expire them
    UPDATE public.quick_scans
    SET converted_to_user_id = NULL,
        status               = 'expired'
    WHERE converted_to_user_id IN (
        SELECT id FROM public.user_profiles
        WHERE signup_status IN ('pending_user', 'accessed_pending_signup')
          AND auth_user_id  IS NULL
          AND created_at     < NOW() - (p_older_than_days || ' days')::INTERVAL
    );

    -- Delete the orphaned profiles (CASCADE cleans up child rows)
    DELETE FROM public.user_profiles
    WHERE signup_status IN ('pending_user', 'accessed_pending_signup')
      AND auth_user_id  IS NULL
      AND created_at     < NOW() - (p_older_than_days || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_orphaned_beta_profiles(INTEGER) TO service_role;


-- ============================================================================
-- SECTION 7: Grants
-- ============================================================================

GRANT ALL ON public.access_codes TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Changes:
--
--  user_profiles
--    signup_status CHECK expanded:
--      + 'pending_user'            (was missing — now the initial state)
--      + 'waitlisted'              (new)
--      + 'accessed_pending_signup' (new)
--      existing: 'pending_auth', 'active', 'suspended'
--    signup_status DEFAULT changed from 'pending_auth' → 'pending_user'
--
--  create_pending_profile()
--    signup_status written as 'pending_user' (was 'pending_auth')
--
--  access_codes (NEW TABLE)
--    id, code (UNIQUE), description
--    max_uses (NULL = unlimited), use_count
--    reserved_for_profile_id (Option B: single-use user-specific codes)
--    is_active, expires_at, created_at, updated_at
--    RLS: service_role only
--
--  validate_access_code(p_code TEXT, p_profile_id UUID) → JSONB
--    Validates code, increments use_count, sets profile → 'accessed_pending_signup'
--    service_role only
--
--  join_waitlist(p_profile_id UUID, p_email TEXT) → JSONB
--    Sets profile → 'waitlisted', writes email to user_profiles + user_emails
--    service_role only
--
--  purge_orphaned_beta_profiles(p_older_than_days INTEGER DEFAULT 7) → INTEGER
--    Deletes pending_user + accessed_pending_signup profiles older than threshold
--    Unlocks associated quick_scans before deletion
--    service_role only — wire to a scheduled cron job
-- ============================================================================
