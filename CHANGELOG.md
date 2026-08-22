# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `address-parser.ts` — parses broker address lines into street/city/state/zip, normalising street suffixes (LN ≡ Lane) and state names (Missouri ≡ MO)
- Given-name canonicalisation in dedup scoring, so Jim ≡ James and Bob ≡ Robert match on merit rather than by fuzzy accident
- `deblurAnywhoHtml()` — recovers the values AnyWho hides behind a CSS blur, where the real text sits in a `data-content` attribute
- Email confirmation step, expired-scan screen, and a risk-summary skeleton in the pilot-scan flow
- `docs/SCAN_SEQUENCE.md` — design for the three-phase scan rework, with per-broker extraction coverage
- `UNIQUE (quick_scan_id, dedup_group_id)` on `quickscan_enrichment`, and `phase` widened to accept a third phase

- `quickscan.record_phase1_tier()` — atomic create-or-join for the scan row, so the fast and slow Phase 1 tiers converge on one `quick_scans` record instead of racing into two
- `public.get_pilot_scan_result(uuid)` — read a stored pilot scan back (selected group, enrichment, consolidated profile); honours `purge_after`, returning `expired` rather than serving PII past its deadline
- `usePilotScanResult()` hook — pilot results are read from the database, with sessionStorage as a fallback so a failed write degrades instead of blanking the page
- `docs/SCHEMA_REVIEW.md` and `docs/PUNCHLIST.md` — production schema audit and the integration punchlist that came out of it
- `UNIQUE (session_id)` on `quick_scans`, FK `pending_profiles.source_quick_scan_id → quick_scans` (`ON DELETE SET NULL`), and `purge_after` defaults on the pilot tables

- `scrape_runner.py` — integration test script for running real scrapers (fps, anywho, zabasearch, quickscan) against live endpoints and logging results to `scrape_results` table
- `tests/` — comprehensive test suite with conftest.py fixtures, test fixtures for anywho/fps/zabasearch, and scraper integration tests
- `tests/log_scraper_results.py` — database logging for scraper test results
- `tests/scrape_result_transformer.py` — normalization layer for scraper responses before DB insert
- `/scrape-daddy` skill — quick CLI wrapper for running real scrapes with sensible defaults (prod mode, James Oehring test user, both summary+full types, always logs to DB)
- Dev-only admin manual scan page at `/admin/manual-scan` to upload broker HTML (FastPeopleSearch, AnyWho, Zabasearch) and merge results into a scan via the `admin-parse-html` edge function
- `admin-parse-html` Supabase Edge Function for batch HTML parsing, profile merge, and optional `quick_scans.profile_data` persistence (`verify_jwt = false` for pre-auth flows)
- `FastPeopleSearchScraper` and shared HTML parse helpers on the scraper router (`parseSearchFromHtml`, `parseDetailFromHtml`, `mergeProfileData`)
- Internal research doc: `docs/fps-bypass-strategies.md` (FastPeopleSearch bypass strategies)
- `scraper-lab-client` bridge for optional residential-worker search routing
- `docs/agent_documentation/duct-tape/` — VPS/home-worker deploy runbooks and admin-invite flow plans

- Full-profile field coverage ported from the vanyshr-scraper-lab: aliases, employment/job history/education, relative gender/birth month, phone type/carrier/first-reported date, address county/recorded-date, AnyWho's per-address property type and legal-records counts, Zaba's birth date
- `quickscan.employment`, `quickscan.education`, `quickscan.properties` tables — same dedup shape as phones/addresses (a job, school, or property reported by more than one broker corroborates instead of duplicating)
- `consolidated_profile.employment` / `.education` / `.properties` / `.legal_records` — the rollup the frontend actually reads now carries these, not just phones/addresses/relatives/aliases
- Employment, Education, Residential details, and Legal records sections on the pilot-scan pre-profile page

### Changed

- Dedup scoring now compares parsed address components instead of splitting the raw string on commas
- AnyWho detail extraction reads emails per card rather than regexing a whole-section blob
- The scan-timeout reaper only fails scans that stored nothing; scans awaiting a user's selection are left alone, and genuinely abandoned ones expire rather than fail
- `source` on the harvested-PII tables accepts per-broker provenance (`fps`, `npd`, `zaba`) alongside the existing values
- `pilot-scan` Phase 1 now persists the scan and each tier's raw results; Phase 2 stores the group the user actually selected plus its enrichment, and back-links both onto the scan
- `promote_pending_profile()` now carries breaches into `public.data_breaches` on conversion instead of discarding enrichment entirely
- `Phase2Orchestrator` now records enrichment coverage (`services_checked`, `breach_count`, `fields_exposed`) and reports `holehe_status` as `success` / `no_results` / `unavailable`, so "we checked and found nothing" is distinguishable from "we could not check"
- `pilot-scan` Phase 1 now runs as two tiers (fast Zaba-only call shown immediately, slow FPS+NPD+AnyWho call merged in client-side) instead of one blocking 4-broker call
- `pilot-scan` Phase 2 now actually scrapes each broker's detail page (`detail-scrapers.ts`, new) instead of re-processing Phase 1 summary data — 20s per-broker timeout, degrades to summary data per broker on failure
- `phase1-orchestrator` scraper-lab/serv01 fallback is now opt-in (default off) — context.dev is the only Phase 1 path unless explicitly enabled
- `scraper-lab-client` drops the city-filter retry (a sequential double-job on every metro-name mismatch) in favor of a single state-only search
- Admin manual scan accepts optional email and creates or updates a pending `user_profiles` row via `create_pending_profile`
- Pre-profile reuses existing `pendingProfileId` / `converted_to_user_id` so signup skips duplicate profile creation
- `universal-search` can delegate name searches to a home `scraper-lab` worker when `SCRAPER_LAB_URL` and `SCRAPER_LAB_TOKEN` are set
- Pre-profile page loads saved `profile_data` when present (e.g. after manual admin upload) instead of being overridden by stub `selectedProfile` state
- Pre-profile UI: two-column list previews with “N More…”, improved alias normalization, address parsing, and relative age handling
- Zabasearch and AnyWho scrapers updated to align with shared parse/merge patterns used by admin HTML ingestion

### Fixed

- One person came back as two results. Brokers format addresses four different ways, and a naive `split(",")` turned the street into the city and produced a different "state" per broker — so two records at the identical street address scored as a location mismatch and never merged.
- AnyWho emails and phone numbers arrived truncated. AnyWho does not redact server-side; it splits a value across spans and hides one fragment in a `data-content` attribute behind a CSS blur. Every email was cut to its first character. AnyWho is the pipeline's primary email source, so the breach and exposed-account checks had almost nothing real to run on.
- The scan-timeout reaper was failing live sessions. It marks anything sitting in `scanning` for two minutes as failed, but the pilot flow stays in that state while the user chooses which profile is theirs — so real scans were being killed mid-session with complete results already stored.
- The email confirmation step could trap the user. With nothing extracted, the confirm button stayed disabled and the only other control reopened the picker; enrichment was never invoked and nothing reached the database. An empty list is a legitimate outcome — Zabasearch masks its addresses at source — so the step is now always passable.
- Debug logging that printed member emails to the browser console was removed before release.

- Pilot scans persisted nothing at all. Phase 1 passed a text id (`pilot-${sessionId}`) into a `uuid NOT NULL` column, so every insert threw on the cast and the error was swallowed — Phase 1 reported success while writing zero rows, and Phase 2 never stored anything. Every scraped profile and paid enrichment result was discarded when the tab closed.
- Conversion made pre-auth PII permanent. `promote_pending_profile()` set `purge_after = NULL` believing that retired the scan; because `purge_expired()` skips NULLs it did the opposite and exempted the row from purging forever, while it still held the full pre-auth scrape. Now bounded to 30 days.
- Signup harvested nothing from a pilot scan. `create_pending_profile()` reads `quick_scans.profile_data` in a specific shape; the Phase 2 profile used different keys and types, so phones, emails, addresses and aliases all parsed to empty.
- Enrichment with zero breaches violated a check constraint. `leakcheck_status` was written as `no_results`, which is not an allowed value — since most people have no breaches, this would have failed the entire enrichment insert on the common path.
- The scan-timeout cron job had failed every minute since the `quickscan` partition landed (~1,200 runs), because it referenced `quick_scans` unqualified. Scans whose edge function died mid-run were never marked failed.

- FPS's detail-page age was silently always null — it read from a `#age-header` selector that does not exist on the real page (the age/born text is a `<p>` sibling of the name `<h1>`)
- Zaba's summary parser dropped phones and aliases past 5 per profile (list cap left over from an earlier draft, same bug already found and fixed in the Python scraper-lab); raised with headroom above observed maxima
- `linesOf()` never actually split multi-line text on `<br>` in this deno_dom version — silently mangled Zaba's address parsing (`"7935 Holmes RDKansas City, Missouri 64131"`), not just the new Job History field that surfaced it
