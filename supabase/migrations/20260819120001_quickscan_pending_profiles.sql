-- ============================================================================
-- Migration: 20260819120001_quickscan_pending_profiles.sql
-- ============================================================================
-- Description: Give pre-auth ("initiated signup, never authenticated") people
--              their own tables inside the `quickscan` schema, so that
--              public.user_* holds authenticated subscribers ONLY.
--
-- Background — the problem this fixes:
--   create_pending_profile() is invoked from magic-link.tsx the moment a
--   visitor submits an email, BEFORE the magic link is clicked, deliberately
--   so abandoned-cart re-engagement is possible. It writes a full profile plus
--   harvested phones, addresses and aliases into public.user_profiles,
--   public.user_phones, public.user_addresses and public.user_aliases.
--
--   The result: someone who typed an email and walked away has broker-scraped
--   PII sitting in the same tables as paying subscribers, distinguished only
--   by `auth_user_id IS NULL`. Any retention job would have to DELETE from
--   subscriber tables to clean that up.
--
-- After this migration:
--   email submitted, no auth  → quickscan.pending_*      (7-day deadline)
--   magic link clicked        → promoted into public.user_*  (no deadline)
--
--   Promotion is a copy-then-delete performed by promote_pending_profile()
--   in 20260819120002.
--
-- Shape note: these tables are deliberately LEANER than their public.user_*
--   counterparts. Post-auth concerns — onboarding progress, user_preferences,
--   subscription/stripe columns, confirmation state — are seeded at promotion
--   time, not while the person is still anonymous. We store only what was
--   actually collected pre-auth, which is also the minimum we would have to
--   delete.
-- ============================================================================


-- ============================================================================
-- SECTION 1: pending_profiles
-- ============================================================================
-- `signup_status` is retained because the private-beta funnel operates on
-- pre-auth profiles: validate_access_code() and join_waitlist() advance
-- pending_user → accessed_pending_signup / waitlisted. Those two functions are
-- retargeted to this table in 20260819120002.

CREATE TABLE IF NOT EXISTS quickscan.pending_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    first_name TEXT,
    last_name  TEXT,

    -- Email the visitor volunteered at the signup prompt. This is the one
    -- piece of PII they gave us directly rather than one we harvested, and it
    -- is what makes abandoned-cart re-engagement possible during the 7-day
    -- window.
    email TEXT,

    -- Beta funnel state. Mirrors the subset of public.user_profiles.signup_status
    -- that is reachable before authentication; 'active' only ever exists on a
    -- promoted row in public.user_profiles.
    signup_status TEXT DEFAULT 'pending_user'
        CHECK (signup_status IN (
            'pending_user',
            'waitlisted',
            'accessed_pending_signup',
            'pending_auth'
        )),

    -- How this profile came into existence.
    source TEXT DEFAULT 'quickscan'
        CHECK (source IN ('invite', 'quickscan')),

    -- Originating scan. Not a FK: the scan is purged on its own schedule and
    -- this is kept as a provenance breadcrumb.
    source_quick_scan_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Retention deadline. Set to +7 days on creation: the visitor initiated
    -- signup, so they get a grace period in which they can come back or be
    -- re-engaged. Cleared (row deleted outright) on promotion.
    purge_after TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_pending_profiles_purge_after
    ON quickscan.pending_profiles (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_profiles_email
    ON quickscan.pending_profiles (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_profiles_scan
    ON quickscan.pending_profiles (source_quick_scan_id);

DROP TRIGGER IF EXISTS trigger_pending_profiles_updated_at
    ON quickscan.pending_profiles;
CREATE TRIGGER trigger_pending_profiles_updated_at
    BEFORE UPDATE ON quickscan.pending_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- SECTION 2: pending child tables
-- ============================================================================
-- Column names intentionally match their public.user_* counterparts so that
-- promotion is a straight INSERT ... SELECT rather than a field-by-field
-- remapping that can silently drift.
--
-- ON DELETE CASCADE from pending_profiles means purging a profile takes its
-- PII with it in one statement — no orphan sweep needed.

CREATE TABLE IF NOT EXISTS quickscan.pending_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_profile_id UUID NOT NULL
        REFERENCES quickscan.pending_profiles(id) ON DELETE CASCADE,

    number     TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    source     TEXT DEFAULT 'quick_scan',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quickscan.pending_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_profile_id UUID NOT NULL
        REFERENCES quickscan.pending_profiles(id) ON DELETE CASCADE,

    email      TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    source     TEXT DEFAULT 'quick_scan',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (pending_profile_id, email)
);

CREATE TABLE IF NOT EXISTS quickscan.pending_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_profile_id UUID NOT NULL
        REFERENCES quickscan.pending_profiles(id) ON DELETE CASCADE,

    street       TEXT,
    city         TEXT,
    state        TEXT,
    zip          TEXT,
    full_address TEXT,
    is_current   BOOLEAN DEFAULT FALSE,
    source       TEXT DEFAULT 'quick_scan',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quickscan.pending_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_profile_id UUID NOT NULL
        REFERENCES quickscan.pending_profiles(id) ON DELETE CASCADE,

    name   TEXT NOT NULL,
    source TEXT DEFAULT 'quick_scan',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_phones_profile
    ON quickscan.pending_phones (pending_profile_id);
CREATE INDEX IF NOT EXISTS idx_pending_emails_profile
    ON quickscan.pending_emails (pending_profile_id);
CREATE INDEX IF NOT EXISTS idx_pending_addresses_profile
    ON quickscan.pending_addresses (pending_profile_id);
CREATE INDEX IF NOT EXISTS idx_pending_aliases_profile
    ON quickscan.pending_aliases (pending_profile_id);


-- ============================================================================
-- SECTION 3: RLS — service_role only
-- ============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'pending_profiles',
        'pending_phones',
        'pending_emails',
        'pending_addresses',
        'pending_aliases'
    ]
    LOOP
        EXECUTE format('ALTER TABLE quickscan.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON quickscan.%I', t);
        EXECUTE format(
            'CREATE POLICY "service_role_all" ON quickscan.%I '
            'FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created: quickscan.pending_profiles + pending_phones / pending_emails /
--          pending_addresses / pending_aliases
--
-- Not done here (see 20260819120002):
--   • create_pending_profile() still writes to public.user_* — retargeted next
--   • existing pre-auth rows still sit in public.user_* — backfilled next
--   • validate_access_code() / join_waitlist() still target public.user_profiles
-- ============================================================================
