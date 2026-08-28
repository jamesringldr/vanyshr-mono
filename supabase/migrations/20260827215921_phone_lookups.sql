-- ============================================================================
-- Migration: 20260827215921_phone_lookups.sql
-- ============================================================================
-- Description: Persist reverse-phone lookups (reversephonelookup.com via
--              context.dev, Zabasearch as fallback) and let harvested-PII
--              tables name that source.
--
-- Phone lookup is its own flow — it can run from the no-results modal with
-- or without a parent intro-scan row — so quickscans_id is nullable. Linked
-- rows CASCADE with the parent; unlinked rows carry their own purge_after
-- (7 days) so they cannot leak past retention.
-- ============================================================================


-- ============================================================================
-- Table: quickscan.phone_lookups
-- ============================================================================

CREATE TABLE quickscan.phone_lookups (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quickscans_id           uuid REFERENCES quickscan.quickscans(id) ON DELETE CASCADE,
    phone_e164              text NOT NULL,
    phone_digits            text NOT NULL,
    source                  text NOT NULL CHECK (source IN ('rpl', 'zaba')),
    source_url              text NOT NULL,
    status                  text NOT NULL CHECK (status IN (
                                'success', 'partial', 'failed',
                                'timeout', 'blocked', 'no_results'
                            )),
    name                    text,
    age                     text,
    birth_year              text,
    line_type               text,
    carrier                 text,
    location                text,
    time_zone               text,
    aliases                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    related_persons         jsonb NOT NULL DEFAULT '[]'::jsonb,
    most_recent_address     text,
    previous_addresses      jsonb NOT NULL DEFAULT '[]'::jsonb,
    email_domains           jsonb NOT NULL DEFAULT '[]'::jsonb,
    previous_phones         jsonb NOT NULL DEFAULT '[]'::jsonb,
    social_media            jsonb NOT NULL DEFAULT '[]'::jsonb,
    jobs                    jsonb NOT NULL DEFAULT '[]'::jsonb,
    education               jsonb NOT NULL DEFAULT '[]'::jsonb,
    professional_licenses   jsonb NOT NULL DEFAULT '[]'::jsonb,
    raw                     jsonb,
    error                   text,
    response_time_ms        integer,
    time_sort               text NOT NULL,
    purge_after             timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quickscan.phone_lookups IS
    'One row per reverse-phone scrape attempt. source=rpl is reversephonelookup.com; '
    'source=zaba is the zabasearch.com /phone/ fallback. Both are fetched via context.dev.';

COMMENT ON COLUMN quickscan.phone_lookups.quickscans_id IS
    'Set when the lookup ran inside an intro-scan session. NULL for standalone lookups. '
    'ON DELETE CASCADE so linked rows die with the parent reaper delete.';

COMMENT ON COLUMN quickscan.phone_lookups.source IS
    '''rpl'' = reversephonelookup.com; ''zaba'' = zabasearch.com phone page.';

COMMENT ON COLUMN quickscan.phone_lookups.phone_digits IS
    '10-digit US national number, no country code. Indexed for re-lookup.';

CREATE INDEX idx_phone_lookups_quickscan
    ON quickscan.phone_lookups (quickscans_id);

CREATE INDEX idx_phone_lookups_digits_created
    ON quickscan.phone_lookups (phone_digits, created_at DESC);

CREATE INDEX idx_phone_lookups_purge_after
    ON quickscan.phone_lookups (purge_after);

CREATE TRIGGER phone_lookups_before_insert
    BEFORE INSERT ON quickscan.phone_lookups
    FOR EACH ROW
    EXECUTE FUNCTION quickscan.set_time_sort_from_created_at();

ALTER TABLE quickscan.phone_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON quickscan.phone_lookups
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- Retention: sweep unlinked rows. Linked rows cascade from quickscans.
-- ============================================================================

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
    v_phones     INT := 0;
BEGIN
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

    DELETE FROM quickscan.phone_lookups
    WHERE purge_after < NOW();
    GET DIAGNOSTICS v_phones = ROW_COUNT;

    RETURN jsonb_build_object(
        'purged_at',           NOW(),
        'pending_profiles',    v_pending,
        'quick_scans',         v_scans,
        'dedup_groups',        v_dedup,
        'enrichment',          v_enrichment,
        'retry_requests',      v_retry,
        'phone_lookups',       v_phones
    );
END;
$$;


-- ============================================================================
-- Provenance: harvested-PII source CHECKs + scrape_results
-- ============================================================================

ALTER TABLE public.user_phones DROP CONSTRAINT IF EXISTS user_phones_source_check;
ALTER TABLE public.user_phones ADD CONSTRAINT user_phones_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba', 'rpl',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

ALTER TABLE public.user_addresses DROP CONSTRAINT IF EXISTS user_addresses_source_check;
ALTER TABLE public.user_addresses ADD CONSTRAINT user_addresses_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba', 'rpl',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

ALTER TABLE public.user_aliases DROP CONSTRAINT IF EXISTS user_aliases_source_check;
ALTER TABLE public.user_aliases ADD CONSTRAINT user_aliases_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba', 'rpl',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

ALTER TABLE public.user_emails DROP CONSTRAINT IF EXISTS user_emails_source_check;
ALTER TABLE public.user_emails ADD CONSTRAINT user_emails_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba', 'rpl',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery', 'auth'
  ]));

COMMENT ON COLUMN public.user_phones.source IS
  'Where this fact came from: a specific broker (fps/npd/anywho/zaba/rpl), '
  '''quick_scan'' when the harvest did not record which, ''user_input'' when '
  'the person entered it, or ''scan_discovery''. rpl = reversephonelookup.com.';

-- Live prod still has the 20260807 target list (zabasearch, not zaba) and
-- scrape_type='both' from later test runs. Widen, don't replace, or ADD
-- CONSTRAINT fails against existing rows.
ALTER TABLE public.scrape_results
  DROP CONSTRAINT IF EXISTS scrape_results_target_check;
ALTER TABLE public.scrape_results
  ADD CONSTRAINT scrape_results_target_check
  CHECK (target IN (
    'fps', 'npd', 'anywho', 'zaba', 'zabasearch', 'rpl', 'holehe', 'leakcheck'
  ));

ALTER TABLE public.scrape_results
  DROP CONSTRAINT IF EXISTS scrape_results_type_check;
ALTER TABLE public.scrape_results
  ADD CONSTRAINT scrape_results_type_check
  CHECK (scrape_type IN ('summary', 'full', 'both', 'phone'));

COMMENT ON COLUMN public.scrape_results.target IS
  'Data source. People-search brokers: fps, npd, anywho, zaba/zabasearch, rpl. '
  'Enrichment sources: holehe (account existence), leakcheck (breach exposure). '
  'rpl = reversephonelookup.com.';


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Created: quickscan.phone_lookups
-- Updated: purge_expired() also sweeps phone_lookups
-- Widened: user_phones/addresses/aliases/emails source + scrape_results target/type
-- ============================================================================
