# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

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
