-- ============================================================================
-- purge-quickscan-test-data.sql
-- ============================================================================
-- Manual dev/test utility -- NOT a migration, does not live in
-- supabase/migrations/ and never runs automatically via `supabase db push`.
-- Run by hand (psql, or paste into the Supabase SQL editor) whenever you
-- want a clean slate for the same 3-4 test people before another pass.
--
-- Every quickscan.* child table has ON DELETE CASCADE back to
-- quickscan.quickscans(id) (phones, addresses, relatives, aliases, emails,
-- employment, education, properties, full_profile_results, summary_results,
-- match_groups, consolidated_profile, holehe_results, leakcheck_results,
-- scan_timings -- confirmed against every migration as of 20260822140000).
-- Deleting the parent row deletes everything hanging off it in one
-- statement; nothing else in this script is needed for a full cleanup of
-- one scan.
--
-- This is the shared staging/production Supabase project (there is no
-- separate staging backend) -- match by name rather than truncating the
-- whole table, so this can't take out a real scan that happens to exist
-- alongside your test runs.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Look before you delete -- edit the names below, then run this SELECT
--    first to see exactly what would go.
-- ----------------------------------------------------------------------------

with test_subjects (first_name, last_name) as (
    values
        ('James', 'Oehring'),
        ('Lucas', 'Clark'),
        ('Chris', 'Rodgers'),
        ('Claire', 'Inman')
        -- add/remove rows as your test set changes
)
select
    q.id,
    q.search_input ->> 'first_name' as first_name,
    q.search_input ->> 'last_name'  as last_name,
    q.status,
    q.created_at
from quickscan.quickscans q
join test_subjects t
    on lower(q.search_input ->> 'first_name') = lower(t.first_name)
    and lower(q.search_input ->> 'last_name') = lower(t.last_name)
order by q.created_at desc;


-- ----------------------------------------------------------------------------
-- 2. The actual purge. Same match, just a DELETE instead of a SELECT.
--    Uncomment to run.
-- ----------------------------------------------------------------------------

-- with test_subjects (first_name, last_name) as (
--     values
--         ('James', 'Oehring'),
--         ('Lucas', 'Clark'),
--         ('Chris', 'Rodgers'),
--         ('Claire', 'Inman')
-- )
-- delete from quickscan.quickscans q
-- using test_subjects t
-- where lower(q.search_input ->> 'first_name') = lower(t.first_name)
--   and lower(q.search_input ->> 'last_name') = lower(t.last_name);


-- ----------------------------------------------------------------------------
-- 3. Blanket option -- every quickscan row regardless of name. Only for when
--    you're sure nothing real is mixed in (this table is brand new and not
--    yet driving signups, so today that's likely true, but re-check before
--    trusting that assumption later). Uncomment to run.
-- ----------------------------------------------------------------------------

-- delete from quickscan.quickscans;
