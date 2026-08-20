-- ============================================================================
-- Migration: 20260819120003_quickscan_purge_and_backfill.sql
-- ============================================================================
-- Description: The retention job, the beta-funnel retarget, and the one-time
--              backfill of pre-auth rows currently sitting in public.user_*.
--
-- ⚠️  The purge function defined here is NOT scheduled. pg_cron is not enabled
--     on this project and no cron.schedule() call is made. Nothing in this
--     migration deletes anything on a timer — the backfill below moves rows,
--     and quickscan.purge_expired() only runs when explicitly invoked.
--     Wire it to pg_cron before launch (see SECTION 4 for the exact call).
-- ============================================================================


-- ============================================================================
-- SECTION 1: Retarget the private-beta funnel onto pending_profiles
-- ============================================================================
-- validate_access_code() and join_waitlist() both operate on profiles that
-- have NOT authenticated — precisely the rows that now live in
-- quickscan.pending_profiles rather than public.user_profiles. Without this
-- retarget both would silently match zero rows after the backfill.
--
-- Only the table references change; the atomic claim/compensation logic in
-- validate_access_code is preserved exactly as written in 20260320100003.

CREATE OR REPLACE FUNCTION public.validate_access_code(
    p_code       TEXT,
    p_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code       RECORD;
    v_updated_id UUID;
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

    -- Atomically claim a use: the WHERE clause IS the limit check.
    UPDATE public.access_codes
    SET use_count  = use_count + 1,
        updated_at = NOW()
    WHERE id = v_code.id
      AND (max_uses IS NULL OR use_count < max_uses)
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access code has reached its usage limit');
    END IF;

    -- Advance the PENDING profile (now in quickscan, not public).
    UPDATE quickscan.pending_profiles
    SET signup_status = 'accessed_pending_signup',
        updated_at    = NOW()
    WHERE id            = p_profile_id
      AND signup_status = 'pending_user';

    IF NOT FOUND THEN
        UPDATE public.access_codes
        SET use_count  = use_count - 1,
            updated_at = NOW()
        WHERE id = v_code.id;

        RETURN jsonb_build_object(
            'success', false,
            'error',   'Profile not found or not in expected state'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_access_code(TEXT, UUID) TO service_role;


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
        SELECT 1 FROM quickscan.pending_profiles
        WHERE id            = p_profile_id
          AND signup_status = 'pending_user'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found or not in pending state');
    END IF;

    UPDATE quickscan.pending_profiles
    SET signup_status = 'waitlisted',
        email         = LOWER(TRIM(p_email)),
        updated_at    = NOW()
    WHERE id = p_profile_id;

    INSERT INTO quickscan.pending_emails (
        pending_profile_id, email, is_primary, source
    ) VALUES (
        p_profile_id, LOWER(TRIM(p_email)), TRUE, 'user_input'
    )
    ON CONFLICT (pending_profile_id, email) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist(UUID, TEXT) TO service_role;


-- ============================================================================
-- SECTION 2: Backfill — evacuate pre-auth rows from public.user_*
-- ============================================================================
-- Every profile with auth_user_id IS NULL belongs to someone who never
-- completed authentication. Those rows (and their harvested phones/addresses/
-- aliases/emails) are exactly the liability this whole partition exists to
-- contain, and they are currently interleaved with paying subscribers.
--
-- They are copied into quickscan.pending_* preserving their original ids, then
-- deleted from public. CASCADE on user_profiles removes the child rows.
--
-- Retention deadline is set to created_at + 7 days — the same policy a new
-- pending profile gets. Most of this backlog is older than that and will
-- therefore be immediately purge-eligible, which is intended: it has been
-- accumulating since launch because the declared 30-minute TTL was never
-- enforced (no pg_cron job ever existed).
--
-- Because the purge is NOT scheduled by this migration, nothing is deleted
-- until it is invoked deliberately — inspect the counts first:
--
--     SELECT count(*) FROM quickscan.pending_profiles WHERE purge_after < now();

INSERT INTO quickscan.pending_profiles (
    id, first_name, last_name, email,
    signup_status, source, source_quick_scan_id,
    created_at, updated_at, purge_after
)
SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    CASE
        WHEN p.signup_status IN ('pending_user', 'waitlisted',
                                 'accessed_pending_signup', 'pending_auth')
        THEN p.signup_status
        ELSE 'pending_user'
    END,
    COALESCE(p.source, 'quickscan'),
    p.source_quick_scan_id,
    p.created_at,
    p.updated_at,
    COALESCE(p.created_at, NOW()) + INTERVAL '7 days'
FROM public.user_profiles p
WHERE p.auth_user_id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO quickscan.pending_phones (pending_profile_id, number, is_primary, source, created_at)
SELECT ph.user_id, ph.number, ph.is_primary, 'quick_scan', ph.created_at
FROM public.user_phones ph
JOIN public.user_profiles p ON p.id = ph.user_id
WHERE p.auth_user_id IS NULL;

INSERT INTO quickscan.pending_addresses (
    pending_profile_id, street, city, state, zip, full_address,
    is_current, source, created_at
)
SELECT a.user_id, a.street, a.city, a.state, a.zip, a.full_address,
       a.is_current, 'quick_scan', a.created_at
FROM public.user_addresses a
JOIN public.user_profiles p ON p.id = a.user_id
WHERE p.auth_user_id IS NULL;

INSERT INTO quickscan.pending_aliases (pending_profile_id, name, source, created_at)
SELECT al.user_id, al.name, 'quick_scan', al.created_at
FROM public.user_aliases al
JOIN public.user_profiles p ON p.id = al.user_id
WHERE p.auth_user_id IS NULL;

INSERT INTO quickscan.pending_emails (pending_profile_id, email, is_primary, source, created_at)
SELECT e.user_id, e.email, e.is_primary, 'quick_scan', e.created_at
FROM public.user_emails e
JOIN public.user_profiles p ON p.id = e.user_id
WHERE p.auth_user_id IS NULL
ON CONFLICT (pending_profile_id, email) DO NOTHING;

-- Remove the originals. CASCADE clears user_phones / user_emails /
-- user_addresses / user_aliases / user_preferences / user_onboarding_progress.
DELETE FROM public.user_profiles WHERE auth_user_id IS NULL;


-- ============================================================================
-- SECTION 3: purge_orphaned_beta_profiles() is obsolete
-- ============================================================================
-- It deleted pre-auth rows out of public.user_profiles. There are no longer
-- any pre-auth rows in that table — quickscan.purge_expired() supersedes it.

DROP FUNCTION IF EXISTS public.purge_orphaned_beta_profiles(INTEGER);


-- ============================================================================
-- SECTION 4: quickscan.purge_expired() — the retention job
-- ============================================================================
-- One predicate, every table: delete rows whose deadline has passed.
--
-- Scoped entirely to the quickscan schema. It has no statement that can touch
-- public.user_* — that containment is the entire point of the partition, and
-- it is why this is safe to run on a timer.
--
-- Ordering: children before parents where no cascade exists, so a failure
-- part-way through never strands rows that can no longer be found.

CREATE OR REPLACE FUNCTION quickscan.purge_expired()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pending    INT := 0;
    v_scans      INT := 0;
    v_dedup      INT := 0;
    v_enrichment INT := 0;
    v_retry      INT := 0;
BEGIN
    -- Pending profiles — CASCADE takes phones/emails/addresses/aliases.
    DELETE FROM quickscan.pending_profiles
    WHERE purge_after IS NOT NULL AND purge_after < NOW();
    GET DIAGNOSTICS v_pending = ROW_COUNT;

    DELETE FROM quickscan.quickscan_enrichment
    WHERE purge_after IS NOT NULL AND purge_after < NOW();
    GET DIAGNOSTICS v_enrichment = ROW_COUNT;

    DELETE FROM quickscan.quickscan_dedup_groups
    WHERE purge_after IS NOT NULL AND purge_after < NOW();
    GET DIAGNOSTICS v_dedup = ROW_COUNT;

    DELETE FROM quickscan.quick_scans
    WHERE purge_after IS NOT NULL AND purge_after < NOW();
    GET DIAGNOSTICS v_scans = ROW_COUNT;

    DELETE FROM quickscan.scan_retry_requests
    WHERE purge_after IS NOT NULL AND purge_after < NOW();
    GET DIAGNOSTICS v_retry = ROW_COUNT;

    RETURN jsonb_build_object(
        'purged_at',           NOW(),
        'pending_profiles',    v_pending,
        'quick_scans',         v_scans,
        'dedup_groups',        v_dedup,
        'enrichment',          v_enrichment,
        'retry_requests',      v_retry
    );
END;
$$;

REVOKE ALL ON FUNCTION quickscan.purge_expired() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION quickscan.purge_expired() TO service_role;


-- ============================================================================
-- SECTION 5: Scheduling — DELIBERATELY NOT ENABLED
-- ============================================================================
-- Left commented per explicit instruction: scheduling is a pre-launch step.
-- Enable the extension in the Supabase dashboard (Database → Extensions →
-- pg_cron), then run:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
--   SELECT cron.schedule(
--       'quickscan-purge-expired',
--       '*/15 * * * *',                     -- every 15 minutes
--       $$ SELECT quickscan.purge_expired(); $$
--   );
--
-- Before the first scheduled run, check what it would remove:
--
--   SELECT
--     (SELECT count(*) FROM quickscan.pending_profiles WHERE purge_after < now()) AS pending,
--     (SELECT count(*) FROM quickscan.quick_scans      WHERE purge_after < now()) AS scans;
--
-- A dry run of the function itself is safe to invoke manually at any time —
-- it returns the per-table counts it deleted.
-- ============================================================================


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Retargeted: validate_access_code(), join_waitlist()
-- Dropped:    purge_orphaned_beta_profiles()
-- New:        quickscan.purge_expired()   [NOT scheduled]
-- Backfilled: all auth_user_id IS NULL rows moved public.user_* → quickscan.pending_*
-- ============================================================================
