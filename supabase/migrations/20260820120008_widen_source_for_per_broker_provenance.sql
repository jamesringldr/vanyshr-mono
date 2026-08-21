-- ============================================================================
-- Migration: 20260820120008_widen_source_for_per_broker_provenance.sql
-- ============================================================================
-- Description: Let public.user_* record WHICH broker a fact came from.
--              See docs/SCAN_SEQUENCE.md §7b, §7c.
--
-- The source CHECK on the harvested-PII tables predates the current scraper
-- set. It permits:
--
--   anywho | zabasearch | both | quick_scan | user_input | scan_discovery
--
-- but the pipeline actually runs four brokers, named by the BrokerName enum as
-- fps, npd, anywho and zaba. Three of those four are missing: 'fps', 'npd', and
-- 'zaba' (the constraint has the older 'zabasearch' spelling).
--
-- Nothing is broken today only because promote_pending_profile() writes the
-- generic 'quick_scan' for everything. But the field-authority model in §7b --
-- emails from anywho, property from fps, job history from fps, education from
-- zaba -- is meaningless if the row cannot say where it came from. The moment
-- promotion records real provenance, those inserts fail the constraint, and a
-- CHECK violation aborts the whole INSERT.
--
-- Widening, not dropping. An unconstrained free-text source column would let a
-- typo'd broker name through silently, and provenance you cannot trust is worse
-- than none.
--
-- Both spellings of Zabasearch are kept: 'zabasearch' because existing rows may
-- use it, 'zaba' because that is what BrokerName.ZABA emits. Normalising the
-- old value is a data migration and deliberately not bundled here.
-- ============================================================================

ALTER TABLE public.user_phones DROP CONSTRAINT IF EXISTS user_phones_source_check;
ALTER TABLE public.user_phones ADD CONSTRAINT user_phones_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

ALTER TABLE public.user_addresses DROP CONSTRAINT IF EXISTS user_addresses_source_check;
ALTER TABLE public.user_addresses ADD CONSTRAINT user_addresses_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

ALTER TABLE public.user_aliases DROP CONSTRAINT IF EXISTS user_aliases_source_check;
ALTER TABLE public.user_aliases ADD CONSTRAINT user_aliases_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'
  ]));

-- user_emails additionally permits 'auth' — the magic-link address, which is
-- confirmed at signup rather than harvested. Preserved.
ALTER TABLE public.user_emails DROP CONSTRAINT IF EXISTS user_emails_source_check;
ALTER TABLE public.user_emails ADD CONSTRAINT user_emails_source_check
  CHECK (source = ANY (ARRAY[
    'fps', 'npd', 'anywho', 'zaba',
    'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery', 'auth'
  ]));

COMMENT ON COLUMN public.user_phones.source IS
  'Where this fact came from: a specific broker (fps/npd/anywho/zaba), '
  '''quick_scan'' when the harvest did not record which, ''user_input'' when '
  'the person entered it, or ''scan_discovery''. See docs/SCAN_SEQUENCE.md §7b.';


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Widened source on user_phones / user_addresses / user_aliases / user_emails
-- to accept per-broker provenance. Purely additive: every previously-valid
-- value is still valid, so no existing row can be invalidated.
--
-- user_profiles.source is deliberately untouched — it records how the ACCOUNT
-- originated (invite | quickscan), not where a fact was scraped.
-- ============================================================================
