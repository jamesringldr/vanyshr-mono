-- Blocking fixes so the scraper pipeline can write what it actually produces.
--
-- Three problems, all of which either reject valid rows or silently record a
-- misleading one. Field-by-field mapping in vanyshr-scraper-lab
-- docs/data-flow.md.
--
-- 1. scrape_results.target rejects holehe and leakcheck outright.
-- 2. The scrapers emit 'zaba'; this schema says 'zabasearch'.
-- 3. quickscan_enrichment cannot express "we could not tell", so a run where
--    most sites refused is indistinguishable from one where nothing was found.

-- ---------------------------------------------------------------------------
-- 1 + 2. scrape_results.target: add the enrichment sources, settle the naming
-- ---------------------------------------------------------------------------
-- 'zaba' is canonical: it is the value BrokerName.ZABA carries in the scraper
-- code, which is the source of truth for what gets written. Existing rows are
-- migrated rather than the constraint accepting both, so joins never need to
-- know about the alias.

-- Order matters: the existing constraint permits 'zabasearch' but not 'zaba',
-- so renaming the rows while it is still enforced would violate it and abort
-- the migration. Drop first, rewrite, then re-add.

ALTER TABLE scrape_results
  DROP CONSTRAINT IF EXISTS scrape_results_target_check;

UPDATE scrape_results
   SET target = 'zaba'
 WHERE target = 'zabasearch';

ALTER TABLE scrape_results
  ADD CONSTRAINT scrape_results_target_check
  CHECK (target IN ('fps', 'npd', 'anywho', 'zaba', 'holehe', 'leakcheck'));

COMMENT ON COLUMN scrape_results.target IS
  'Data source. People-search brokers: fps, npd, anywho, zaba. '
  'Enrichment sources: holehe (account existence), leakcheck (breach exposure). '
  'Values match BrokerName in the scraper repo; "zabasearch" was renamed to '
  '"zaba" on 2026-08-13.';

-- ---------------------------------------------------------------------------
-- 3. quickscan_enrichment: let a partial answer say so
-- ---------------------------------------------------------------------------
-- Holehe ships 121 targets and answers for roughly 47 of them: about 65 sites
-- return a challenge and 9 modules are broken. Without the counts below, a run
-- where 65 sites refused and a run where every site answered "no account" both
-- store status='success' with an empty services_found, and the UI renders both
-- as "no accounts found".
--
-- For a product telling people what is exposed about them, reporting "we could
-- not check" as "you are clean" is the worst available failure direction.

ALTER TABLE public.quickscan_enrichment
  ADD COLUMN IF NOT EXISTS services_checked INT,
  ADD COLUMN IF NOT EXISTS services_unavailable INT,
  ADD COLUMN IF NOT EXISTS fields_exposed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS breach_count INT;

COMMENT ON COLUMN public.quickscan_enrichment.services_checked IS
  'Holehe targets that returned a verdict. Read with services_unavailable: an '
  'empty services_found is only meaningful when services_unavailable is low.';

COMMENT ON COLUMN public.quickscan_enrichment.services_unavailable IS
  'Holehe targets that gave no verdict -- site returned a challenge, or the '
  'module errored. Holehe reports both as "[x] Rate limit" via a bare except, '
  'so they cannot be told apart from its output.';

COMMENT ON COLUMN public.quickscan_enrichment.fields_exposed IS
  'Field *types* leaked across a breach set, e.g. password, dob, ip, address. '
  'Never values. From leakcheck; the union across all sources, not per-source.';

COMMENT ON COLUMN public.quickscan_enrichment.breach_count IS
  'Breach count as reported by leakcheck. May exceed the number of entries in '
  'breaches when source names are withheld.';

-- The status vocabularies below are taken from what the enrichers actually
-- return, not from what reads well: every value here is emitted by
-- holehe_enricher.enrich_email or leakcheck_enricher.enrich_email, and every
-- value those emit appears here. 'error' is the enrichers' term for an
-- unexpected failure; 'failed' predates them and is kept so existing rows stay
-- valid, but new writes use 'error'. Worth collapsing to one later.
--
-- 'invalid_email' means the address was screened before the request and never
-- reached the service -- distinct from having been checked and found clean.

ALTER TABLE public.quickscan_enrichment
  DROP CONSTRAINT IF EXISTS quickscan_enrichment_holehe_status_check;

ALTER TABLE public.quickscan_enrichment
  ADD CONSTRAINT quickscan_enrichment_holehe_status_check
  CHECK (holehe_status IN (
    'pending', 'success', 'error', 'failed', 'no_auth', 'timeout',
    'invalid_email', 'unavailable'
  ));

ALTER TABLE public.quickscan_enrichment
  DROP CONSTRAINT IF EXISTS quickscan_enrichment_leakcheck_status_check;

ALTER TABLE public.quickscan_enrichment
  ADD CONSTRAINT quickscan_enrichment_leakcheck_status_check
  CHECK (leakcheck_status IN (
    'pending', 'success', 'error', 'failed', 'no_auth', 'timeout',
    'rate_limited', 'invalid_email', 'not_found'
  ));

-- Deliberate asymmetries between the two vocabularies:
--
--   'unavailable'   holehe only -- the CLI binary was not found on the host.
--                   Leakcheck is a plain HTTP call with no such failure mode.
--   'not_found'     leakcheck only -- checked, and in no breach. Holehe says
--                   the same thing as success with an empty services_found.
--   'rate_limited'  leakcheck only -- its quota is per-request, so a whole
--                   lookup fails. Holehe's refusals are per-site and partial,
--                   which is what services_unavailable above is for; a holehe
--                   run is never wholly rate limited.
