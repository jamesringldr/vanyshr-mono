-- ============================================================================
-- Migration: 20260819120000_quickscan_schema.sql
-- ============================================================================
-- Description: Partition all pre-conversion (non-subscriber) data into a
--              dedicated `quickscan` Postgres schema.
--
-- Why:
--   Today every scan we run harvests real PII (phones, addresses, relatives,
--   emails) for people who have never signed up, and it lands in `public`
--   alongside subscriber data. Two consequences we want to eliminate:
--
--     1. A retention cron would have to issue row-level DELETEs against the
--        same tables that hold paying subscribers — the exact blast radius
--        we don't want a scheduled job to have.
--     2. There is no single lever to lock non-subscriber PII away from the
--        client. RLS is per-table and easy to get wrong on a new table.
--
--   Moving this data into its own schema makes both structural: the purge job
--   is scoped to `quickscan` and *cannot* reach `public.user_*`, and access is
--   governed by one GRANT on the schema rather than N table policies.
--
-- Retention model (see also 20260819120001 / 20260819120002):
--   anonymous scan (no email given)  → purge_after = created_at + 30 min
--   initiated signup (email given)   → purge_after extended to + 7 days
--   authenticated                    → promoted into public.user_*, rows deleted here
--
--   Every table in this schema carries `purge_after`, so the retention job is
--   one uniform predicate per table. We deliberately do NOT use TRUNCATE —
--   that would destroy in-flight scans belonging to active sessions.
--
-- NOTE: this migration only MOVES tables and establishes grants. The purge
--       function is defined in 20260819120002 and is intentionally NOT
--       scheduled — wire it to pg_cron before launch.
-- ============================================================================


-- ============================================================================
-- SECTION 1: Create the schema and lock down access
-- ============================================================================
-- service_role is the only role with any privilege here. anon/authenticated
-- get nothing — not even USAGE — so even if the schema is exposed to
-- PostgREST, a client key cannot read a single row. All access flows through
-- service-role Edge Functions, which is already the project convention for
-- pre-auth writes.

CREATE SCHEMA IF NOT EXISTS quickscan;

REVOKE ALL ON SCHEMA quickscan FROM PUBLIC;
REVOKE ALL ON SCHEMA quickscan FROM anon, authenticated;

GRANT USAGE ON SCHEMA quickscan TO service_role;

-- Future tables created in this schema inherit the same posture.
ALTER DEFAULT PRIVILEGES IN SCHEMA quickscan
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA quickscan
    GRANT ALL ON TABLES TO service_role;


-- ============================================================================
-- SECTION 2: Drop the cross-schema FK from public.user_profiles
-- ============================================================================
-- `source_quick_scan_id` was `REFERENCES quick_scans(id) ON DELETE SET NULL`.
-- That is safe against cascade, but it means purging a scan silently erases
-- the provenance of the profile it produced. We want the opposite: keep the
-- uuid as an audit breadcrumb ("this profile originated from scan X") even
-- after X has been purged. Dropping the constraint also decouples the two
-- schemas so the retention job can never be blocked by a referencing row.

ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_source_quick_scan_id_fkey;

COMMENT ON COLUMN public.user_profiles.source_quick_scan_id IS
    'Originating quickscan.quick_scans.id. Intentionally NOT a foreign key — '
    'the referenced scan is purged on a retention schedule; this uuid is kept '
    'as a provenance breadcrumb and may point at a deleted row.';


-- ============================================================================
-- SECTION 3: Move the pre-conversion tables
-- ============================================================================
-- ALTER TABLE ... SET SCHEMA is atomic and preserves data, indexes,
-- constraints, triggers, and sequence ownership. Table names are deliberately
-- left unchanged: 11 Edge Function files reference `quick_scans`, and those
-- call sites already have to change to add `.schema('quickscan')`. Renaming
-- on top of that doubles the churn for a cosmetic gain. `quickscan.quick_scans`
-- reads slightly redundant; that is an accepted trade for a reviewable diff.

ALTER TABLE IF EXISTS public.quick_scans              SET SCHEMA quickscan;
ALTER TABLE IF EXISTS public.quickscan_dedup_groups   SET SCHEMA quickscan;
ALTER TABLE IF EXISTS public.quickscan_enrichment     SET SCHEMA quickscan;
ALTER TABLE IF EXISTS public.quickscan_cost_tracking  SET SCHEMA quickscan;
ALTER TABLE IF EXISTS public.scan_retry_requests      SET SCHEMA quickscan;


-- ============================================================================
-- SECTION 4: Add the retention deadline column
-- ============================================================================
-- One column, one meaning, every table: "delete this row once now() passes."
-- Nullable by design — a NULL purge_after means "not yet scheduled for
-- deletion" and is skipped by the purge. That is the safe default for rows
-- mid-migration; Section 5 backfills real deadlines.

ALTER TABLE quickscan.quick_scans
    ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;
ALTER TABLE quickscan.quickscan_dedup_groups
    ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;
ALTER TABLE quickscan.quickscan_enrichment
    ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;
ALTER TABLE quickscan.scan_retry_requests
    ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

-- Partial indexes — the purge job only ever scans rows that have a deadline.
CREATE INDEX IF NOT EXISTS idx_quick_scans_purge_after
    ON quickscan.quick_scans (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dedup_groups_purge_after
    ON quickscan.quickscan_dedup_groups (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrichment_purge_after
    ON quickscan.quickscan_enrichment (purge_after) WHERE purge_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retry_requests_purge_after
    ON quickscan.scan_retry_requests (purge_after) WHERE purge_after IS NOT NULL;

COMMENT ON COLUMN quickscan.quick_scans.purge_after IS
    'Retention deadline. Set to expires_at (~30 min) for anonymous scans; '
    'extended to +7 days by create_pending_profile() when the visitor submits '
    'an email. NULL = not scheduled for purge.';


-- ============================================================================
-- SECTION 5: Backfill retention deadlines on existing rows
-- ============================================================================
-- Existing data has never been purged (no pg_cron job was ever scheduled, so
-- the declared 30-minute TTL on quick_scans has been decorative since day one).
-- Give every historical row a deadline so the first purge run clears the
-- accumulated backlog.
--
-- Rows already converted to a real user (converted_to_user_id IS NOT NULL) are
-- left NULL — those belong to people who signed up, and are handled by the
-- promotion path, not the purge.

UPDATE quickscan.quick_scans
SET purge_after = COALESCE(expires_at, created_at + INTERVAL '30 minutes')
WHERE purge_after IS NULL
  AND converted_to_user_id IS NULL;

UPDATE quickscan.quickscan_dedup_groups g
SET purge_after = COALESCE(g.created_at, NOW()) + INTERVAL '30 minutes'
WHERE g.purge_after IS NULL;

UPDATE quickscan.quickscan_enrichment e
SET purge_after = COALESCE(e.created_at, NOW()) + INTERVAL '30 minutes'
WHERE e.purge_after IS NULL;

-- retry_requests already carry a 90-day expires_at of their own; honour it.
UPDATE quickscan.scan_retry_requests
SET purge_after = COALESCE(expires_at, created_at + INTERVAL '90 days')
WHERE purge_after IS NULL
  AND converted_to_user_id IS NULL;


-- ============================================================================
-- SECTION 6: RLS — service_role only, no exceptions
-- ============================================================================
-- The schema-level GRANT in Section 1 is the primary lock. RLS is kept on as
-- defence in depth so that exposing the schema to PostgREST later, or granting
-- a role by accident, still cannot leak rows.
--
-- Existing policies on the moved tables were written for a `public` table
-- readable by anon (the pre-profile page used to SELECT quick_scans directly
-- with the anon key). Those are all dropped here — that read is being replaced
-- by a SECURITY DEFINER RPC in 20260819120002.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'quickscan'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'quick_scans',
        'quickscan_dedup_groups',
        'quickscan_enrichment',
        'quickscan_cost_tracking',
        'scan_retry_requests'
    ]
    LOOP
        EXECUTE format('ALTER TABLE quickscan.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY "service_role_all" ON quickscan.%I '
            'FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Moved into schema `quickscan`:
--   quick_scans, quickscan_dedup_groups, quickscan_enrichment,
--   quickscan_cost_tracking, scan_retry_requests
--
-- Follow-on migrations:
--   20260819120001 — quickscan.pending_* tables (split out of public.user_*)
--   20260819120002 — retargeted functions + purge function + backfill
--
-- Manual steps still required (deliberately not automated here):
--   • Edge Functions must add .schema('quickscan') at every call site
--     (11 files reference quick_scans — see migration notes).
--   • pg_cron is NOT scheduled. Enable the extension and schedule
--     quickscan.purge_expired() before launch.
-- ============================================================================
