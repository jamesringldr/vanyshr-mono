-- ============================================================================
-- Migration: 20260828040000_brokers_slug_and_seed.sql
-- ============================================================================
-- Description: brokers.brokers has no slug (the scan pipeline keys on
--              fps / npd / anywho / zaba) and zero rows, so public.exposures
--              cannot be created — broker_id is NOT NULL. Add slug, seed the
--              four intro-scan brokers, and turn on RLS for authenticated
--              reads. The Data API still does not expose the brokers schema;
--              promotion snapshots name/url onto each exposure instead.
-- ============================================================================

ALTER TABLE brokers.brokers
    ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE brokers.brokers
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

ALTER TABLE brokers.brokers
    ALTER COLUMN slug SET NOT NULL;

DROP INDEX IF EXISTS idx_brokers_brokers_slug;
ALTER TABLE brokers.brokers
    DROP CONSTRAINT IF EXISTS brokers_brokers_slug_key;
ALTER TABLE brokers.brokers
    ADD CONSTRAINT brokers_brokers_slug_key UNIQUE (slug);

COMMENT ON COLUMN brokers.brokers.slug IS
    'Stable scan-target key: fps, npd, anywho, zaba (and future brokers).';


INSERT INTO brokers.brokers (
    name, slug, type, data_types, removal_priority,
    scrape_type, opt_out_type, company_url, is_active
) VALUES
    (
        'FastPeopleSearch',
        'fps',
        'people_search',
        ARRAY['identity']::text[],
        1,
        'web_form',
        'web_form',
        'https://www.fastpeoplesearch.com',
        true
    ),
    (
        'National Public Data',
        'npd',
        'people_search',
        ARRAY['identity']::text[],
        1,
        'web_form',
        'web_form',
        'https://nationalpublicdata.com',
        true
    ),
    (
        'AnyWho',
        'anywho',
        'people_search',
        ARRAY['identity']::text[],
        1,
        'web_form',
        'web_form',
        'https://www.anywho.com',
        true
    ),
    (
        'ZabaSearch',
        'zaba',
        'people_search',
        ARRAY['identity']::text[],
        1,
        'web_form',
        'web_form',
        'https://www.zabasearch.com',
        true
    )
ON CONFLICT (slug) DO UPDATE
SET
    name         = EXCLUDED.name,
    company_url  = EXCLUDED.company_url,
    type         = EXCLUDED.type,
    is_active    = true,
    updated_at   = NOW();


ALTER TABLE brokers.brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active brokers" ON brokers.brokers;
CREATE POLICY "Authenticated can read active brokers" ON brokers.brokers
    FOR SELECT TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Service role full access brokers" ON brokers.brokers;
CREATE POLICY "Service role full access brokers" ON brokers.brokers
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
