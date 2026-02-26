-- ============================================================================
-- Migration: 00005_profile_schema_update.sql
-- ============================================================================
-- Description: Decouples user_profiles from auth.users to support pre-auth
--   profile creation, introduces dedicated typed tables per data type to
--   replace the generic monitored_data_points table, and splits the old
--   convert_quick_scan_to_user() function into two stage-specific functions.
--
-- Changes:
--   1.  Helper function: get_current_user_profile_id() for RLS
--   2.  user_profiles: decouple id FK, add auth_user_id / signup_status / email
--   3.  quick_scans: add 'pending_signup' status
--   4.  Drop monitored_data_points (replaced by typed tables)
--   5.  exposures: matched_data_points UUID[] → JSONB
--   6.  New table: user_phones
--   7.  New table: user_emails
--   8.  New table: user_addresses
--   9.  New table: user_aliases
--   10. Update RLS on all tables that join to user_profiles
--   11. Drop convert_quick_scan_to_user(); add create_pending_profile()
--       and link_auth_to_profile()
--   12. Update get_user_dashboard_stats() for new tables
--   13. Grants
-- ============================================================================


-- ============================================================================
-- SECTION 1: PRE-REQUISITE COLUMN + HELPER FUNCTION
-- auth_user_id must exist on user_profiles before the helper function that
-- references it can be created, so the FK drop and column addition are
-- pulled to the very top of the migration.
-- ============================================================================

-- Remove the foreign-key link between id and auth.users(id).
-- The id column stays as the primary key — it just no longer references auth.
ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- New column: auth_user_id — populated after magic link auth completes.
-- Nullable because the row is created before the user authenticates.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS auth_user_id UUID
        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Helper function — requires auth_user_id to exist (added above).
-- Returns the user_profiles.id (own UUID) for the current authenticated user.
-- Used in all RLS policies on tables that join to user_profiles.
CREATE OR REPLACE FUNCTION get_current_user_profile_id()
RETURNS UUID AS $$
    SELECT id FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- SECTION 2: REMAINING user_profiles CHANGES
-- (FK drop and auth_user_id column already handled in Section 1 above)
-- ============================================================================

-- New column: signup_status — tracks where the user is in the sign-up funnel.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS signup_status TEXT DEFAULT 'pending_auth'
        CHECK (signup_status IN ('pending_auth', 'active', 'suspended'));

-- New column: email — the account / primary monitoring email.
-- Populated in link_auth_to_profile() when the magic link is confirmed.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS email TEXT;

-- Remove the single phone column — per-number tracking lives in user_phones.
ALTER TABLE user_profiles
    DROP COLUMN IF EXISTS phone;

-- Drop old RLS policies that used auth.uid() = id (no longer valid).
DROP POLICY IF EXISTS "Users can view own profile"   ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- New RLS policies — use auth_user_id for identity checks.
-- Inserts are handled exclusively via service-role edge functions;
-- authenticated users can only read / update their own row.
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid());

-- Service role policy already exists from 00003; no change needed.


-- ============================================================================
-- SECTION 3: UPDATE quick_scans STATUS CONSTRAINT
-- Adds 'pending_signup' — set when the user clicks "Start Vanyshing for FREE"
-- and create_pending_profile() runs, before magic-link auth completes.
-- ============================================================================

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
        'pending_signup'    -- NEW: profile row created, awaiting magic-link auth
    ));


-- ============================================================================
-- SECTION 4: DROP monitored_data_points
-- The four typed tables below fully replace this generic table.
-- CASCADE drops any dependent objects (indexes, triggers, policies).
-- ============================================================================

DROP TABLE IF EXISTS monitored_data_points CASCADE;


-- ============================================================================
-- SECTION 5: UPDATE exposures.matched_data_points
-- Was UUID[] referencing monitored_data_points rows.
-- Now JSONB so a single exposure can reference matches across typed tables.
-- Shape: [{"type": "phone", "id": "<uuid>"}, {"type": "address", "id": "<uuid>"}]
-- ============================================================================

ALTER TABLE exposures
    DROP COLUMN IF EXISTS matched_data_points;

ALTER TABLE exposures
    ADD COLUMN matched_data_points JSONB DEFAULT '[]';


-- ============================================================================
-- SECTION 6: user_phones
-- One row per phone number per user.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_phones (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- The number itself
    number      TEXT NOT NULL,
    -- phone_type intentionally omitted (dropped in 00006)
    is_primary  BOOLEAN DEFAULT FALSE,

    -- Onboarding confirmation state
    user_confirmed_status TEXT DEFAULT 'unverified'
        CHECK (user_confirmed_status IN ('unverified', 'confirmed', 'rejected')),
    confirmed_at TIMESTAMPTZ,

    -- Where this record came from
    source TEXT DEFAULT 'user_input'
        CHECK (source IN ('quick_scan', 'user_input', 'scan_discovery')),

    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_phones_user
    ON user_phones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phones_primary
    ON user_phones(user_id) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_phones_active
    ON user_phones(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_phones_unverified
    ON user_phones(user_id) WHERE user_confirmed_status = 'unverified';

DROP TRIGGER IF EXISTS trigger_user_phones_updated_at ON user_phones;
CREATE TRIGGER trigger_user_phones_updated_at
    BEFORE UPDATE ON user_phones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own phones"          ON user_phones;
DROP POLICY IF EXISTS "Service role full access user_phones" ON user_phones;
CREATE POLICY "Users can manage own phones" ON user_phones
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access user_phones" ON user_phones
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 7: user_emails
-- One row per email address per user.
-- The auth / magic-link email is inserted here with source = 'auth' and
-- user_confirmed_status = 'confirmed' by link_auth_to_profile().
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_emails (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    email      TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,

    -- Onboarding confirmation state
    user_confirmed_status TEXT DEFAULT 'unverified'
        CHECK (user_confirmed_status IN ('unverified', 'confirmed', 'rejected')),
    confirmed_at TIMESTAMPTZ,

    -- 'auth' = the Supabase magic-link email (pre-confirmed)
    source TEXT DEFAULT 'user_input'
        CHECK (source IN ('quick_scan', 'user_input', 'scan_discovery', 'auth')),

    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_emails_user
    ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_primary
    ON user_emails(user_id) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_emails_active
    ON user_emails(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_emails_unverified
    ON user_emails(user_id) WHERE user_confirmed_status = 'unverified';

DROP TRIGGER IF EXISTS trigger_user_emails_updated_at ON user_emails;
CREATE TRIGGER trigger_user_emails_updated_at
    BEFORE UPDATE ON user_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own emails"          ON user_emails;
DROP POLICY IF EXISTS "Service role full access user_emails" ON user_emails;
CREATE POLICY "Users can manage own emails" ON user_emails
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access user_emails" ON user_emails
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 8: user_addresses
-- One row per address per user.
-- Stores both structured fields (street / city / state / zip) and a
-- pre-formatted full_address string for scraper-sourced data that arrives
-- without a fully parsed structure.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_addresses (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Structured fields (populated during onboarding confirmation)
    street       TEXT,
    city         TEXT,
    state        TEXT,
    zip          TEXT,
    -- Raw string fallback (populated from quick-scan JSONB)
    full_address TEXT,

    is_current BOOLEAN DEFAULT FALSE,

    -- Onboarding confirmation state
    user_confirmed_status TEXT DEFAULT 'unverified'
        CHECK (user_confirmed_status IN ('unverified', 'confirmed', 'rejected')),
    confirmed_at TIMESTAMPTZ,

    source TEXT DEFAULT 'user_input'
        CHECK (source IN ('quick_scan', 'user_input', 'scan_discovery')),

    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user
    ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_current
    ON user_addresses(user_id) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_addresses_active
    ON user_addresses(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_addresses_unverified
    ON user_addresses(user_id) WHERE user_confirmed_status = 'unverified';

DROP TRIGGER IF EXISTS trigger_user_addresses_updated_at ON user_addresses;
CREATE TRIGGER trigger_user_addresses_updated_at
    BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own addresses"          ON user_addresses;
DROP POLICY IF EXISTS "Service role full access user_addresses" ON user_addresses;
CREATE POLICY "Users can manage own addresses" ON user_addresses
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access user_addresses" ON user_addresses
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 9: user_aliases
-- One row per alternate name per user (nicknames, maiden names, initials, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_aliases (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    name TEXT NOT NULL,

    -- Onboarding confirmation state
    user_confirmed_status TEXT DEFAULT 'unverified'
        CHECK (user_confirmed_status IN ('unverified', 'confirmed', 'rejected')),
    confirmed_at TIMESTAMPTZ,

    source TEXT DEFAULT 'user_input'
        CHECK (source IN ('quick_scan', 'user_input', 'scan_discovery')),

    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_aliases_user
    ON user_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aliases_active
    ON user_aliases(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_aliases_unverified
    ON user_aliases(user_id) WHERE user_confirmed_status = 'unverified';

DROP TRIGGER IF EXISTS trigger_user_aliases_updated_at ON user_aliases;
CREATE TRIGGER trigger_user_aliases_updated_at
    BEFORE UPDATE ON user_aliases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own aliases"          ON user_aliases;
DROP POLICY IF EXISTS "Service role full access user_aliases" ON user_aliases;
CREATE POLICY "Users can manage own aliases" ON user_aliases
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

CREATE POLICY "Service role full access user_aliases" ON user_aliases
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 10: UPDATE RLS ON ALL TABLES THAT JOIN TO user_profiles
-- Previously these used  USING (user_id = auth.uid())  because user_profiles.id
-- equalled auth.users.id.  Now they must resolve through auth_user_id.
-- get_current_user_profile_id() returns the profile UUID for the current session.
-- ============================================================================

-- family_members
DROP POLICY IF EXISTS "Users can manage own family members" ON family_members;
CREATE POLICY "Users can manage own family members" ON family_members
    FOR ALL TO authenticated
    USING (owner_user_id = get_current_user_profile_id());

-- exposures
DROP POLICY IF EXISTS "Users can view own exposures" ON exposures;
CREATE POLICY "Users can view own exposures" ON exposures
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications"   ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = get_current_user_profile_id());

-- activity_log
DROP POLICY IF EXISTS "Users can view own activity" ON activity_log;
CREATE POLICY "Users can view own activity" ON activity_log
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());

-- user_todos
DROP POLICY IF EXISTS "Users can manage own todos" ON user_todos;
CREATE POLICY "Users can manage own todos" ON user_todos
    FOR ALL TO authenticated
    USING (user_id = get_current_user_profile_id());

-- scan_history
DROP POLICY IF EXISTS "Users can view own scan history" ON scan_history;
CREATE POLICY "Users can view own scan history" ON scan_history
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());

-- data_breaches
DROP POLICY IF EXISTS "Users can view own breaches"  ON data_breaches;
DROP POLICY IF EXISTS "Users can update own breaches" ON data_breaches;
CREATE POLICY "Users can view own breaches" ON data_breaches
    FOR SELECT TO authenticated
    USING (user_id = get_current_user_profile_id());
CREATE POLICY "Users can update own breaches" ON data_breaches
    FOR UPDATE TO authenticated
    USING (user_id = get_current_user_profile_id());


-- ============================================================================
-- SECTION 11: REPLACE convert_quick_scan_to_user() WITH TWO STAGE FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS convert_quick_scan_to_user(UUID, UUID);


-- ----------------------------------------------------------------------------
-- create_pending_profile(p_scan_id)
-- ----------------------------------------------------------------------------
-- Called by a service-role edge function when the user clicks
-- "Start Vanyshing for FREE" on the pre-profile page.
--
-- What it does:
--   • Creates a user_profiles row (no auth_user_id yet, signup_status = 'pending_auth')
--   • Populates user_phones / user_addresses / user_aliases from profile_data JSONB
--     (guards against NULL profile_data gracefully — user fills in onboarding manually)
--   • Sets quick_scans.status = 'pending_signup'
--   • Sets quick_scans.converted_to_user_id = new profile id so the cleanup
--     job does not prematurely expire this scan
--
-- Returns: { success, profile_id, scan_id }
-- The frontend stores profile_id in sessionStorage for the auth callback.
-- ----------------------------------------------------------------------------

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

    -- Create the user_profiles row.
    -- first_name / last_name come from what the user typed into the quick-scan form.
    -- email and auth_user_id are NULL until link_auth_to_profile() runs.
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
        'pending_auth',
        p_scan_id,
        FALSE,
        0
    );

    -- Lock the scan so the cleanup job doesn't delete it while signup is pending.
    UPDATE quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;

    -- ----------------------------------------------------------------
    -- Populate user_phones (only if profile_data was persisted by
    -- the universal-details edge function before this CTA was clicked)
    -- ----------------------------------------------------------------
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

    -- ----------------------------------------------------------------
    -- Populate user_addresses
    -- ----------------------------------------------------------------
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
                NULLIF(trim(COALESCE(v_address->>'street', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'city', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'state', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'zip', '')), ''),
                COALESCE((v_address->>'is_current')::boolean, FALSE),
                'quick_scan',
                'unverified'
            );
        END LOOP;
    END IF;

    -- ----------------------------------------------------------------
    -- Populate user_aliases
    -- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- link_auth_to_profile(p_profile_id, p_auth_user_id, p_email)
-- ----------------------------------------------------------------------------
-- Called by a service-role edge function in the Supabase auth callback
-- (after the user clicks the magic link and Supabase confirms their email).
--
-- What it does:
--   • Links auth.users.id → user_profiles.auth_user_id
--   • Sets user_profiles.email and signup_status = 'active'
--   • Inserts the auth email into user_emails as primary + confirmed
--     (uses ON CONFLICT in case the email also appears in quick-scan data)
--   • Marks the originating quick_scan as 'completed'
--
-- Returns: { success, profile_id, auth_user_id }
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION link_auth_to_profile(
    p_profile_id   UUID,
    p_auth_user_id UUID,
    p_email        TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_profile_id;

    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    IF v_profile.auth_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile is already linked to an auth user'
        );
    END IF;

    -- Link auth identity and activate the account.
    UPDATE user_profiles
    SET
        auth_user_id  = p_auth_user_id,
        email         = p_email,
        signup_status = 'active',
        updated_at    = NOW()
    WHERE id = p_profile_id;

    -- Insert the magic-link email into user_emails.
    -- source = 'auth' skips the unverified state — Supabase already confirmed it.
    -- ON CONFLICT handles the edge case where the same email was scraped from
    -- a data broker and already exists as an unverified quick_scan row.
    INSERT INTO user_emails (
        user_id, email, is_primary,
        source, user_confirmed_status, confirmed_at
    ) VALUES (
        p_profile_id, p_email, TRUE,
        'auth', 'confirmed', NOW()
    )
    ON CONFLICT (user_id, email) DO UPDATE
        SET
            is_primary            = TRUE,
            user_confirmed_status = 'confirmed',
            confirmed_at          = NOW(),
            source                = 'auth',
            updated_at            = NOW();

    -- Close out the originating quick_scan.
    UPDATE quick_scans
    SET
        status       = 'completed',
        completed_at = NOW()
    WHERE id = v_profile.source_quick_scan_id;

    RETURN jsonb_build_object(
        'success',      true,
        'profile_id',   p_profile_id,
        'auth_user_id', p_auth_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 12: UPDATE get_user_dashboard_stats()
-- Adds monitored counts from the new typed tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_dashboard_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        -- Exposure counts (unchanged)
        'total_exposures',      (SELECT COUNT(*) FROM exposures   WHERE user_id = p_user_id),
        'active_exposures',     (SELECT COUNT(*) FROM exposures   WHERE user_id = p_user_id
                                    AND status IN ('found','queued','removal_requested','removal_in_progress')),
        'removed_exposures',    (SELECT COUNT(*) FROM exposures   WHERE user_id = p_user_id
                                    AND status IN ('removed','verified_removed')),
        'pending_removals',     (SELECT COUNT(*) FROM removal_requests r
                                    JOIN exposures e ON r.exposure_id = e.id
                                    WHERE e.user_id = p_user_id
                                    AND r.status IN ('pending','submitted','processing')),
        'brokers_with_data',    (SELECT COUNT(DISTINCT broker_id) FROM exposures
                                    WHERE user_id = p_user_id
                                    AND status NOT IN ('removed','verified_removed','ignored')),
        -- Notification / todo counts (unchanged)
        'unread_notifications', (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = FALSE),
        'pending_todos',        (SELECT COUNT(*) FROM user_todos   WHERE user_id = p_user_id AND status = 'pending'),
        'last_scan_at',         (SELECT MAX(completed_at) FROM scan_history
                                    WHERE user_id = p_user_id AND status = 'completed'),
        'data_breaches',        (SELECT COUNT(*) FROM data_breaches
                                    WHERE user_id = p_user_id AND is_acknowledged = FALSE),
        -- Monitored data point counts from new typed tables
        'monitored_phones',     (SELECT COUNT(*) FROM user_phones    WHERE user_id = p_user_id AND is_active = TRUE),
        'monitored_emails',     (SELECT COUNT(*) FROM user_emails    WHERE user_id = p_user_id AND is_active = TRUE),
        'monitored_addresses',  (SELECT COUNT(*) FROM user_addresses WHERE user_id = p_user_id AND is_active = TRUE),
        'monitored_aliases',    (SELECT COUNT(*) FROM user_aliases   WHERE user_id = p_user_id AND is_active = TRUE),
        -- Onboarding progress
        'pending_verifications', (
            SELECT  COALESCE(p.cnt, 0) + COALESCE(e.cnt, 0)
                  + COALESCE(a.cnt, 0) + COALESCE(al.cnt, 0)
            FROM (SELECT COUNT(*) AS cnt FROM user_phones    WHERE user_id = p_user_id AND user_confirmed_status = 'unverified' AND is_active = TRUE) p,
                 (SELECT COUNT(*) AS cnt FROM user_emails    WHERE user_id = p_user_id AND user_confirmed_status = 'unverified' AND is_active = TRUE) e,
                 (SELECT COUNT(*) AS cnt FROM user_addresses WHERE user_id = p_user_id AND user_confirmed_status = 'unverified' AND is_active = TRUE) a,
                 (SELECT COUNT(*) AS cnt FROM user_aliases   WHERE user_id = p_user_id AND user_confirmed_status = 'unverified' AND is_active = TRUE) al
        )
    ) INTO v_stats;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 13: GRANTS
-- ============================================================================

-- Helper function available to authenticated users (called inside RLS policies)
GRANT EXECUTE ON FUNCTION get_current_user_profile_id() TO authenticated;

-- Stage functions are service-role only — never called directly from the client
GRANT EXECUTE ON FUNCTION create_pending_profile(UUID)               TO service_role;
GRANT EXECUTE ON FUNCTION link_auth_to_profile(UUID, UUID, TEXT)     TO service_role;

-- Dashboard stats can be called by the authenticated user for their own profile
GRANT EXECUTE ON FUNCTION get_user_dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard_stats(UUID) TO service_role;

-- New typed tables — authenticated users interact via RLS-enforced policies
GRANT SELECT, INSERT, UPDATE, DELETE ON user_phones    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_emails    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_aliases   TO authenticated;

GRANT ALL ON user_phones    TO service_role;
GRANT ALL ON user_emails    TO service_role;
GRANT ALL ON user_addresses TO service_role;
GRANT ALL ON user_aliases   TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema summary after this migration:
--
--  user_profiles         id (own UUID), auth_user_id (nullable FK → auth.users),
--                        signup_status, email, first_name, last_name,
--                        date_of_birth, source_quick_scan_id, onboarding_*
--
--  quick_scans           + 'pending_signup' status value
--
--  user_phones           per-number rows with user_confirmed_status + source
--  user_emails           per-email rows   with user_confirmed_status + source
--  user_addresses        per-address rows with user_confirmed_status + source
--  user_aliases          per-alias rows   with user_confirmed_status + source
--
--  exposures             matched_data_points now JSONB
--                        [{"type":"phone","id":"<uuid>"}, ...]
--
--  monitored_data_points DROPPED — replaced by typed tables above
--
--  DROPPED:  convert_quick_scan_to_user(UUID, UUID)
--  NEW:      create_pending_profile(UUID)        → service_role only
--            link_auth_to_profile(UUID, UUID, TEXT) → service_role only
--            get_current_user_profile_id()       → authenticated (used by RLS)
-- ============================================================================
