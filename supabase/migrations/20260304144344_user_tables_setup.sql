-- ============================================================================
-- Migration: 20260304_user_tables_setup.sql
-- ============================================================================
-- Description: Comprehensive audit and hardening of all user-facing tables.
--   Fixes a critical RLS bug on removal_requests, collapses removal_aggression
--   to a 2-value enum, replaces notification_settings with the ManualSettings
--   structure, adds missing columns/policies, and introduces an auto-profile
--   creation trigger on auth.users.
--
-- Tables addressed:
--   user_profiles        — collapse removal_aggression to aggressive|targeted
--                          replace notification_settings JSONB structure
--                          add notification_tier to track preset vs manual
--   removal_requests     — FIX critical RLS bug (auth.uid() ≠ profile id)
--                          add INSERT + UPDATE policies for authenticated users
--   exposures            — add UPDATE policy (currently SELECT-only)
--   scan_history         — add updated_at + trigger
--   data_breaches        — add updated_at + trigger
--   notifications        — add DELETE policy
--   user_todos           — tighten FOR ALL policy with explicit WITH CHECK
--   auth.users           — add trigger: auto-create user_profiles on any signup
--
-- Safe to run on existing data: all DDL statements are idempotent.
-- Does NOT drop any existing tables or columns.
-- ============================================================================


-- ============================================================================
-- SECTION 1: notification_settings — replace JSONB structure
-- ============================================================================
-- The existing notification_settings JSONB uses a flat schema:
--   {push_enabled, email_new_exposure, email_weekly_summary, email_removal_complete}
--
-- This does not match the ManualSettings interface used by both:
--   /onboarding/notifications  — tier selector (presets)
--   /settings/notifications    — manual toggle page (source of truth)
--
-- Design: tiers are presets that write the SAME fields as the manual page.
-- Selecting "general" = writing the general-preset values to notification_settings.
-- Customizing on /settings/notifications = writing individual values + setting
-- notification_tier = 'manual'.
--
-- New structure matches ManualSettings exactly:
--   alerts.darkWebBreach       boolean
--   alerts.brokerExposure      boolean
--   alerts.tasks               'new' | 'reminders' | 'none'
--   scanActivity.brokerScanComplete    boolean
--   scanActivity.darkWebScanComplete   boolean
--   removalActivity.submitted  boolean
--   removalActivity.confirmed  boolean
--   recapReports.securitySnapshot  'weekly' | 'monthly' | 'manual'
--   recapReports.removalRecap  boolean
--   productUpdates.featureAnnouncements boolean
--   productUpdates.dealsDiscounts       boolean
--   newsInfo.newsletter        boolean
--   newsInfo.securityTips      boolean
--   newsInfo.cyberSecurityAlerts boolean
--
-- Tier presets (used below and in the trigger):
--
--   all:
--     everything on; securitySnapshot = 'weekly'; tasks = 'new'
--
--   general  [DEFAULT — mirrors ManualNotifications DEFAULT_SETTINGS]:
--     alerts + scanActivity + removalActivity + recapReports + cyberSecurityAlerts
--     no productUpdates, no newsletter, no securityTips
--
--   primary:
--     alerts + scanActivity + recapReports
--     no removalActivity, no productUpdates, no news
--
--   critical  (1–3/week):
--     alerts only + monthly recap; tasks = 'reminders'; scanActivity off

-- Step 1a: update the column DEFAULT to the 'general' preset structure

ALTER TABLE user_profiles
    ALTER COLUMN notification_settings
    SET DEFAULT '{
        "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
        "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
        "removalActivity": {"submitted": true,  "confirmed": true},
        "recapReports":    {"securitySnapshot": "weekly", "removalRecap": true},
        "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
        "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": true}
    }'::jsonb;

-- Step 1b: add notification_tier column if it doesn't already exist.
-- Must come BEFORE the backfill UPDATE that references this column.

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS notification_tier TEXT
        NOT NULL DEFAULT 'general'
        CHECK (notification_tier IN ('all', 'general', 'primary', 'critical', 'manual'));

-- Step 1c: backfill any existing rows that still have the old flat structure.
-- Identify old-structure rows by the absence of the 'alerts' key.
-- Migrate to 'general' preset as a safe default.

UPDATE user_profiles
    SET
        notification_settings = '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
            "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
            "removalActivity": {"submitted": true,  "confirmed": true},
            "recapReports":    {"securitySnapshot": "weekly", "removalRecap": true},
            "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
            "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": true}
        }'::jsonb,
        notification_tier = 'general'
    WHERE notification_settings->>'alerts' IS NULL;

-- Step 1d: create a helper function that returns the notification_settings JSONB
-- for a given tier. Used in the trigger (Section 10) and can be called from
-- edge functions when applying a preset.
--
-- Usage: SELECT public.notification_settings_for_tier('primary');

CREATE OR REPLACE FUNCTION public.notification_settings_for_tier(p_tier TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_tier
        WHEN 'all' THEN '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
            "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
            "removalActivity": {"submitted": true,  "confirmed": true},
            "recapReports":    {"securitySnapshot": "weekly", "removalRecap": true},
            "productUpdates":  {"featureAnnouncements": true,  "dealsDiscounts": true},
            "newsInfo":        {"newsletter": true,  "securityTips": true,  "cyberSecurityAlerts": true}
        }'::jsonb

        WHEN 'general' THEN '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
            "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
            "removalActivity": {"submitted": true,  "confirmed": true},
            "recapReports":    {"securitySnapshot": "weekly", "removalRecap": true},
            "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
            "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": true}
        }'::jsonb

        WHEN 'primary' THEN '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
            "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
            "removalActivity": {"submitted": false, "confirmed": false},
            "recapReports":    {"securitySnapshot": "weekly", "removalRecap": false},
            "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
            "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": false}
        }'::jsonb

        WHEN 'critical' THEN '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "reminders"},
            "scanActivity":    {"brokerScanComplete": false, "darkWebScanComplete": false},
            "removalActivity": {"submitted": false, "confirmed": false},
            "recapReports":    {"securitySnapshot": "monthly", "removalRecap": true},
            "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
            "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": false}
        }'::jsonb

        -- 'manual' has no preset; caller writes notification_settings directly
        ELSE '{
            "alerts":          {"darkWebBreach": true,  "brokerExposure": true,  "tasks": "new"},
            "scanActivity":    {"brokerScanComplete": true,  "darkWebScanComplete": true},
            "removalActivity": {"submitted": true,  "confirmed": true},
            "recapReports":    {"securitySnapshot": "weekly", "removalRecap": true},
            "productUpdates":  {"featureAnnouncements": false, "dealsDiscounts": false},
            "newsInfo":        {"newsletter": false, "securityTips": false, "cyberSecurityAlerts": true}
        }'::jsonb
    END;
$$;

GRANT EXECUTE ON FUNCTION public.notification_settings_for_tier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_settings_for_tier(TEXT) TO service_role;


-- ============================================================================
-- SECTION 2: removal_aggression — collapse to 2-value enum (Option B)
-- ============================================================================
-- Old CHECK: conservative | balanced | aggressive | maximum
-- New CHECK: aggressive | targeted
--
-- Vocabulary:
--   aggressive — broadcast removals to the full 200+ broker network
--   targeted   — only remove where data is confirmed found (privacy-first)
--
-- Row migration map:
--   conservative → targeted  (remove only confirmed = privacy-first intent)
--   balanced     → targeted  (balanced is closer to targeted than aggressive)
--   aggressive   → aggressive
--   maximum      → aggressive (maximum intensity collapses to aggressive)
--
-- Default changes from 'balanced' to 'aggressive' (recommended in the UI).

-- Step 2a: drop old CHECK first so the UPDATE can safely write 'targeted'
ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_removal_aggression_check;

-- Step 2b: migrate existing rows (now unconstrained)
UPDATE user_profiles
    SET removal_aggression = CASE
        WHEN removal_aggression IN ('conservative', 'balanced') THEN 'targeted'
        WHEN removal_aggression IN ('aggressive',   'maximum')  THEN 'aggressive'
        ELSE 'aggressive'  -- fallback for any unexpected value
    END
    WHERE removal_aggression IS NOT NULL;

-- Step 2c: change the column DEFAULT
ALTER TABLE user_profiles
    ALTER COLUMN removal_aggression SET DEFAULT 'aggressive';

-- Step 2d: add new 2-value CHECK
ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_removal_aggression_check
        CHECK (removal_aggression IN ('aggressive', 'targeted'));


-- ============================================================================
-- SECTION 3: scan_history — add updated_at + trigger
-- ============================================================================
-- scan_history.status transitions (pending → in_progress → completed → failed)
-- but had no updated_at column.

ALTER TABLE scan_history
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE scan_history
    SET updated_at = COALESCE(completed_at, started_at, created_at)
    WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS trigger_scan_history_updated_at ON scan_history;
CREATE TRIGGER trigger_scan_history_updated_at
    BEFORE UPDATE ON scan_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 4: data_breaches — add updated_at + trigger
-- ============================================================================
-- data_breaches.status changes (new → unresolved → resolved) but had no
-- generic updated_at for row-level auditing.

ALTER TABLE data_breaches
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE data_breaches
    SET updated_at = COALESCE(status_updated_at, acknowledged_at, created_at)
    WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS trigger_data_breaches_updated_at ON data_breaches;
CREATE TRIGGER trigger_data_breaches_updated_at
    BEFORE UPDATE ON data_breaches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 5: removal_requests — fix critical RLS bug
-- ============================================================================
-- BUG (from 00003, not fixed in 00005):
--   The SELECT policy used auth.uid() to filter exposures.user_id, but
--   exposures.user_id is user_profiles.id (own UUID) — not auth.users.id.
--   This meant zero removal requests were ever visible to any authenticated user.
--
-- Fix: use get_current_user_profile_id() throughout.
--
-- INSERT + UPDATE policies are also added — previously absent, meaning
-- authenticated users could not initiate or track DIY removals.

DROP POLICY IF EXISTS "Users can view own removal requests"   ON removal_requests;
DROP POLICY IF EXISTS "Users can insert own removal requests" ON removal_requests;
DROP POLICY IF EXISTS "Users can update own removal requests" ON removal_requests;
DROP POLICY IF EXISTS "Users can manage own removal requests" ON removal_requests;

CREATE POLICY "Users can view own removal requests" ON removal_requests
    FOR SELECT TO authenticated
    USING (
        exposure_id IN (
            SELECT id FROM exposures
            WHERE user_id = get_current_user_profile_id()
        )
    );

CREATE POLICY "Users can insert own removal requests" ON removal_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        exposure_id IN (
            SELECT id FROM exposures
            WHERE user_id = get_current_user_profile_id()
        )
    );

CREATE POLICY "Users can update own removal requests" ON removal_requests
    FOR UPDATE TO authenticated
    USING (
        exposure_id IN (
            SELECT id FROM exposures
            WHERE user_id = get_current_user_profile_id()
        )
    )
    WITH CHECK (
        exposure_id IN (
            SELECT id FROM exposures
            WHERE user_id = get_current_user_profile_id()
        )
    );


-- ============================================================================
-- SECTION 6: exposures — add UPDATE policy
-- ============================================================================
-- 00005 set only a SELECT policy. ExposuresView.tsx line 667 does:
--   .from('exposures').update({ status })
-- Without an UPDATE policy this silently returns an empty result set.

DROP POLICY IF EXISTS "Users can update own exposures" ON exposures;

CREATE POLICY "Users can update own exposures" ON exposures
    FOR UPDATE TO authenticated
    USING     (user_id = get_current_user_profile_id())
    WITH CHECK (user_id = get_current_user_profile_id());


-- ============================================================================
-- SECTION 7: notifications — add DELETE policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE TO authenticated
    USING (user_id = get_current_user_profile_id());


-- ============================================================================
-- SECTION 8: user_todos — add WITH CHECK to FOR ALL policy
-- ============================================================================
-- The 00003 "Users can manage own todos" policy used FOR ALL but omitted
-- WITH CHECK, leaving an INSERT bypass vector. Recreate with both clauses.

DROP POLICY IF EXISTS "Users can manage own todos" ON user_todos;

CREATE POLICY "Users can manage own todos" ON user_todos
    FOR ALL TO authenticated
    USING     (user_id = get_current_user_profile_id())
    WITH CHECK (user_id = get_current_user_profile_id());


-- ============================================================================
-- SECTION 9: Additional indexes
-- ============================================================================

-- Covers the removal_requests RLS subquery (exposure_id → status filtering)
CREATE INDEX IF NOT EXISTS idx_removal_requests_exposure_status
    ON removal_requests(exposure_id, status);

-- Supports notification_tier queries (settings page, onboarding state checks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_notif_tier
    ON user_profiles(notification_tier);

-- scan_history and data_breaches updated_at for dashboard sort/filter
CREATE INDEX IF NOT EXISTS idx_scan_history_updated
    ON scan_history(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_breaches_updated
    ON data_breaches(user_id, updated_at DESC);


-- ============================================================================
-- SECTION 10: Auto-profile creation trigger on auth.users
-- ============================================================================
-- Creates (or links) a user_profiles row whenever a new auth.users row is
-- inserted. This handles both the quick-scan signup flow and any future
-- direct-signup path.
--
-- ── Verified Supabase behavior ──────────────────────────────────────────────
-- Trigger type: AFTER INSERT ON auth.users
--   • AFTER (not BEFORE) is correct: NEW.id is fully committed, safe to FK
--     reference from user_profiles.auth_user_id.
--   • Magic link for an EXISTING email = Supabase authenticates the existing
--     auth.users row, no INSERT fires, no trigger, no duplicate profiles.
--     This is confirmed Supabase/GoTrue behavior.
--
-- ── Two cases ───────────────────────────────────────────────────────────────
-- Guard A — raw_user_meta_data.profile_id IS NOT NULL
--   The quick-scan flow calls create_pending_profile() before auth, which
--   creates a user_profiles row and seeds scan data. The magic link is sent
--   with that profile's UUID in raw_user_meta_data.profile_id.
--   Action: link auth_user_id to the existing profile (UPSERT-safe: if for
--   any reason the profile doesn't exist yet, create it with that UUID).
--   This effectively replaces the link_auth_to_profile() edge function call
--   at the DB level. The edge function should be updated to be idempotent
--   (return success:true when already linked) to avoid breaking the callback.
--
-- Guard B — no profile_id in metadata (direct signup, no prior scan)
--   Create a fresh profile. Seed onboarding steps. Auto-confirm auth email.
--
-- ── Frontend requirement ─────────────────────────────────────────────────────
-- For Guard A to fire reliably, pass profile_id when sending the magic link:
--   supabase.auth.signInWithOtp({
--     email,
--     options: { data: { profile_id: profileId, source_quick_scan_id: scanId } }
--   })
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_meta           JSONB    := NEW.raw_user_meta_data;
    v_profile_id     UUID;
    v_scan_id        UUID;
    v_first_name     TEXT;
    v_last_name      TEXT;
    v_profile_exists BOOLEAN  := FALSE;
BEGIN
    -- ── Guard A: quick-scan → magic-link flow ──────────────────────────────
    -- profile_id was embedded in the magic link metadata by the frontend.

    IF (v_meta->>'profile_id') IS NOT NULL THEN

        BEGIN
            v_profile_id := (v_meta->>'profile_id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            -- Malformed UUID in metadata — fall through to Guard B
            v_profile_id := NULL;
        END;

        IF v_profile_id IS NOT NULL THEN

            -- Check whether create_pending_profile() already created the row
            SELECT EXISTS (
                SELECT 1 FROM public.user_profiles WHERE id = v_profile_id
            ) INTO v_profile_exists;

            IF v_profile_exists THEN
                -- Profile exists: link auth identity and activate
                UPDATE public.user_profiles
                SET
                    auth_user_id  = NEW.id,
                    email         = COALESCE(email, NEW.email),
                    signup_status = 'active',
                    updated_at    = NOW()
                WHERE id = v_profile_id
                  AND auth_user_id IS NULL;  -- only if not already linked

                -- Mark account_signup onboarding step complete
                UPDATE public.user_onboarding_progress
                SET
                    status       = 'completed',
                    completed_at = NOW(),
                    updated_at   = NOW()
                WHERE user_id = v_profile_id
                  AND step     = 'account_signup';

                -- Upsert the auth email as primary + confirmed
                INSERT INTO public.user_emails (
                    user_id, email, is_primary,
                    source, user_confirmed_status, confirmed_at
                ) VALUES (
                    v_profile_id, NEW.email, TRUE,
                    'auth', 'confirmed', NOW()
                )
                ON CONFLICT (user_id, email) DO UPDATE
                    SET
                        is_primary            = TRUE,
                        user_confirmed_status = 'confirmed',
                        confirmed_at          = NOW(),
                        source                = 'auth',
                        updated_at            = NOW();

            ELSE
                -- Profile doesn't exist (edge case: trigger fires before edge fn)
                -- Create it with the provided UUID so the edge fn sees it on insert
                v_first_name := COALESCE(NULLIF(trim(v_meta->>'first_name'), ''), '');
                v_last_name  := COALESCE(NULLIF(trim(v_meta->>'last_name'),  ''), '');

                BEGIN
                    v_scan_id := (v_meta->>'source_quick_scan_id')::uuid;
                EXCEPTION WHEN invalid_text_representation THEN
                    v_scan_id := NULL;
                END;

                INSERT INTO public.user_profiles (
                    id, auth_user_id, first_name, last_name, email,
                    signup_status, subscription_tier, subscription_status,
                    source_quick_scan_id, onboarding_completed, onboarding_step
                ) VALUES (
                    v_profile_id, NEW.id, v_first_name, v_last_name, NEW.email,
                    'active', 'free', 'active',
                    v_scan_id, FALSE, 0
                );

                PERFORM public.initialize_onboarding_steps(v_profile_id);

                UPDATE public.user_onboarding_progress
                SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE user_id = v_profile_id AND step = 'account_signup';

                INSERT INTO public.user_emails (
                    user_id, email, is_primary,
                    source, user_confirmed_status, confirmed_at
                ) VALUES (
                    v_profile_id, NEW.email, TRUE,
                    'auth', 'confirmed', NOW()
                )
                ON CONFLICT (user_id, email) DO NOTHING;
            END IF;

            RETURN NEW;
        END IF;
    END IF;

    -- ── Guard B: direct signup — no prior scan ─────────────────────────────
    -- No profile_id in metadata. Create a fresh profile.

    -- Safety: skip if a profile is somehow already linked to this auth id
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = NEW.id LIMIT 1) THEN
        RETURN NEW;
    END IF;

    v_profile_id := gen_random_uuid();
    v_first_name := COALESCE(NULLIF(trim(v_meta->>'first_name'), ''), '');
    v_last_name  := COALESCE(NULLIF(trim(v_meta->>'last_name'),  ''), '');

    INSERT INTO public.user_profiles (
        id, auth_user_id, first_name, last_name, email,
        signup_status, subscription_tier, subscription_status,
        onboarding_completed, onboarding_step
    ) VALUES (
        v_profile_id, NEW.id, v_first_name, v_last_name, NEW.email,
        'active', 'free', 'active',
        FALSE, 0
    );

    PERFORM public.initialize_onboarding_steps(v_profile_id);

    UPDATE public.user_onboarding_progress
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE user_id = v_profile_id AND step = 'account_signup';

    INSERT INTO public.user_emails (
        user_id, email, is_primary,
        source, user_confirmed_status, confirmed_at
    ) VALUES (
        v_profile_id, NEW.email, TRUE,
        'auth', 'confirmed', NOW()
    )
    ON CONFLICT (user_id, email) DO NOTHING;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- A profile creation failure must NOT block authentication.
    -- Log as a warning; the user can still log in and the support team
    -- can backfill the missing profile.
    RAISE WARNING 'handle_new_auth_user: failed for auth uid=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- supabase_auth_admin is the role GoTrue uses to run its own mutations on auth.users
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;


-- ============================================================================
-- SECTION 11: link_auth_to_profile() — idempotency fix
-- ============================================================================
-- The version from 00009 returns success:false when auth_user_id is already set,
-- regardless of whether it's the same auth user. With the trigger now linking
-- profiles atomically on auth.users INSERT, the edge function may arrive to find
-- the work already done. This update makes the function idempotent:
--
--   already linked to THIS auth user  → success: true  (trigger ran first, all good)
--   already linked to a DIFFERENT uid → success: false  (genuine conflict)
--   not yet linked                    → proceed as before

CREATE OR REPLACE FUNCTION public.link_auth_to_profile(
    p_profile_id   UUID,
    p_auth_user_id UUID,
    p_email        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_profile_id;

    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- Idempotent: already linked to this exact auth user (trigger ran first)
    IF v_profile.auth_user_id = p_auth_user_id THEN
        RETURN jsonb_build_object(
            'success',      true,
            'profile_id',   p_profile_id,
            'auth_user_id', p_auth_user_id
        );
    END IF;

    -- Genuine conflict: profile claimed by a different auth user
    IF v_profile.auth_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile is linked to a different auth user'
        );
    END IF;

    -- Not yet linked: do the full link
    UPDATE user_profiles
    SET
        auth_user_id  = p_auth_user_id,
        email         = COALESCE(email, p_email),
        signup_status = 'active',
        updated_at    = NOW()
    WHERE id = p_profile_id;

    UPDATE user_onboarding_progress
    SET
        status       = 'completed',
        completed_at = NOW(),
        updated_at   = NOW()
    WHERE user_id = p_profile_id
      AND step     = 'account_signup';

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
$$;

GRANT EXECUTE ON FUNCTION public.link_auth_to_profile(UUID, UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 12: Service-role policy re-confirmations
-- ============================================================================
-- removal_requests and exposures service_role policies were set in 00003 but
-- are re-stated here for clarity alongside the new authenticated policies.

DROP POLICY IF EXISTS "Service role full access removal_requests" ON removal_requests;
CREATE POLICY "Service role full access removal_requests" ON removal_requests
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access exposures" ON exposures;
CREATE POLICY "Service role full access exposures" ON exposures
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- SECTION 13: Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE            ON removal_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE            ON exposures        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE    ON notifications    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE    ON user_todos       TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_settings_for_tier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_settings_for_tier(TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema changes after this migration:
--
--  user_profiles
--    notification_settings JSONB — DEFAULT and all old-structure rows replaced
--      with ManualSettings shape:
--      {alerts, scanActivity, removalActivity, recapReports, productUpdates, newsInfo}
--    notification_tier TEXT DEFAULT 'general'
--      CHECK (all|general|primary|critical|manual)
--      Set to 'general' for all backfilled rows.
--    removal_aggression — DEFAULT changed to 'aggressive'
--      CHECK collapsed to (aggressive|targeted)
--      Existing rows: conservative/balanced → targeted; aggressive/maximum → aggressive
--
--  scan_history
--    updated_at TIMESTAMPTZ DEFAULT NOW() + trigger
--
--  data_breaches
--    updated_at TIMESTAMPTZ DEFAULT NOW() + trigger
--
--  removal_requests
--    SELECT policy FIXED (auth.uid() → get_current_user_profile_id())
--    INSERT policy added for authenticated users
--    UPDATE policy added for authenticated users
--    Service role policy re-confirmed
--    idx_removal_requests_exposure_status added
--
--  exposures
--    UPDATE policy added for authenticated users
--    Service role policy re-confirmed
--
--  notifications
--    DELETE policy added for authenticated users
--
--  user_todos
--    FOR ALL policy tightened with WITH CHECK clause
--
--  New function: public.notification_settings_for_tier(TEXT) → JSONB
--    Returns the notification_settings preset JSONB for a given tier.
--    Call this from the onboarding edge function or frontend when applying a tier.
--
--  New trigger: auth.users AFTER INSERT → public.handle_new_auth_user()
--    Guard A (profile_id in metadata): link existing profile OR create with that UUID
--    Guard B (no metadata): create fresh profile + seed onboarding + confirm email
--
--  New indexes:
--    idx_user_profiles_notif_tier
--    idx_removal_requests_exposure_status
--    idx_scan_history_updated
--    idx_data_breaches_updated
--
-- ============================================================================
-- POST-MIGRATION WIRING (frontend changes — not blocking the migration itself)
-- ============================================================================
--
--  Blockers 1 and 2 are resolved:
--    ✅  magic-link.tsx now passes profile_id + source_quick_scan_id in options.data
--    ✅  link_auth_to_profile() SQL fn updated (Section 11) — idempotent
--    ✅  link-auth-to-profile edge function wrapper handles "already linked" as success
--
--  Remaining wiring (frontend-only, safe to do after migration ships):
--
--  1. FRONTEND — write notification_settings on tier selection
--     OnboardingNotificationPreferences currently writes only to localStorage.
--     On the Confirm button, also write to DB:
--       supabase.from('user_profiles').update({
--         notification_tier: selectedTier,
--         notification_settings: presetForTier,
--       })
--     presetForTier can be fetched via: SELECT notification_settings_for_tier($1)
--     or computed client-side from the TIER_PRESETS map (mirrors the SQL function).
--     For 'manual', navigate to /settings/notifications and on save write:
--       { notification_tier: 'manual', notification_settings: customValues }
--
--  2. FRONTEND — write removal_aggression on strategy selection
--     OnboardingRemovalStrategy currently writes only to localStorage.
--     On confirm, also write to DB:
--       supabase.from('user_profiles').update({
--         removal_aggression: selected,  // 'aggressive' | 'targeted'
--       })
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================

/*

-- Section 12
REVOKE SELECT, INSERT, UPDATE            ON removal_requests FROM authenticated;
REVOKE SELECT, INSERT, UPDATE            ON exposures        FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE    ON notifications    FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE    ON user_todos       FROM authenticated;

-- Section 11
DROP POLICY IF EXISTS "Service role full access removal_requests" ON removal_requests;
DROP POLICY IF EXISTS "Service role full access exposures"        ON exposures;

-- Section 10
DROP TRIGGER   IF EXISTS on_auth_user_created           ON auth.users;
DROP FUNCTION  IF EXISTS public.handle_new_auth_user();

-- Section 9
DROP INDEX IF EXISTS idx_data_breaches_updated;
DROP INDEX IF EXISTS idx_scan_history_updated;
DROP INDEX IF EXISTS idx_user_profiles_notif_tier;
DROP INDEX IF EXISTS idx_removal_requests_exposure_status;

-- Section 8
DROP POLICY IF EXISTS "Users can manage own todos" ON user_todos;
CREATE POLICY "Users can manage own todos" ON user_todos
    FOR ALL TO authenticated USING (user_id = get_current_user_profile_id());

-- Section 7
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Section 6
DROP POLICY IF EXISTS "Users can update own exposures" ON exposures;

-- Section 5
DROP POLICY IF EXISTS "Users can view own removal requests"   ON removal_requests;
DROP POLICY IF EXISTS "Users can insert own removal requests" ON removal_requests;
DROP POLICY IF EXISTS "Users can update own removal requests" ON removal_requests;

-- Section 4
DROP   TRIGGER IF EXISTS trigger_data_breaches_updated_at ON data_breaches;
ALTER  TABLE data_breaches DROP COLUMN IF EXISTS updated_at;

-- Section 3
DROP   TRIGGER IF EXISTS trigger_scan_history_updated_at ON scan_history;
ALTER  TABLE scan_history  DROP COLUMN IF EXISTS updated_at;

-- Section 2
-- ⚠ Data migration is irreversible — original values (conservative, balanced,
--   maximum) cannot be recovered once rows have been updated.
ALTER TABLE user_profiles ALTER COLUMN removal_aggression SET DEFAULT 'balanced';
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_removal_aggression_check;
ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_removal_aggression_check
        CHECK (removal_aggression IN ('conservative', 'balanced', 'aggressive', 'maximum'));

-- Section 1
DROP FUNCTION IF EXISTS public.notification_settings_for_tier(TEXT);
ALTER TABLE user_profiles DROP COLUMN IF EXISTS notification_tier;
-- ⚠ Restoring old notification_settings structure requires knowing what each
--   row originally had. Only possible if you have a backup.
ALTER TABLE user_profiles
    ALTER COLUMN notification_settings
    SET DEFAULT '{"push_enabled": true, "email_new_exposure": true, "email_weekly_summary": true, "email_removal_complete": true}'::jsonb;

*/
