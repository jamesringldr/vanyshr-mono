# Vanyshr Database Schema
**Project:** Vanyshr Production (`skhejbzrfptrusskuqoy`, us-west-2)
**Last updated:** 2026-03-18

---

## Tables Overview

| Table | Schema | Description |
|-------|--------|-------------|
| `user_profiles` | public | Core user record, decoupled from auth |
| `user_preferences` | public | Per-user removal strategy and notification settings |
| `user_phones` | public | Phone numbers per user (E.164 stored) |
| `user_emails` | public | Email addresses per user |
| `user_addresses` | public | Addresses per user |
| `user_aliases` | public | Name aliases per user |
| `user_onboarding_progress` | public | Step-by-step onboarding tracking |
| `family_members` | public | Additional people monitored under one account |
| `quick_scans` | public | Ephemeral pre-auth scan data (30-min TTL) |
| `scan_retry_requests` | public | Queued retry requests for failed scans |
| `scan_history` | public | Audit log of full scans post-signup |
| `exposures` | public | Data broker listings found for a user |
| `removal_requests` | public | Opt-out requests per exposure |
| `data_breaches` | public | HIBP breach records per user |
| `notifications` | public | In-app / email / push notification records |
| `activity_log` | public | System audit trail |
| `user_todos` | public | Manual action items for users |
| `zip_lookup` | public | Zip → city/state lookup cache |
| `access_codes` | public | Private beta access codes (shared multi-use and user-specific single-use) |
| `brokers` | brokers | Data broker registry *(separate schema)* |
| `broker_stats` | brokers | Crowd-sourced removal outcome stats per broker *(separate schema)* |
| `broker_vanyshr_stats` | brokers | Vanyshr-specific removal outcomes per broker/user *(separate schema)* |

---

## Table Details

### `user_profiles`
PK: `id` (own UUID — NOT `auth.uid()`) | RLS: ✅

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK — set explicitly (not auto-generated) |
| first_name | text | |
| last_name | text | |
| middle_name | text | nullable |
| date_of_birth | date | nullable |
| gender | text | nullable |
| email | text | nullable — captured at magic-link submission |
| auth_user_id | uuid | nullable, unique → `auth.users.id` |
| signup_status | text | Funnel: `pending_user` → `waitlisted` or `accessed_pending_signup` → `pending_auth` → `active`; also `suspended`. Default `pending_user`. |
| source_quick_scan_id | uuid | nullable → `quick_scans.id` |
| onboarding_completed | bool | default false |
| onboarding_step | int | default 0 |
| removal_aggression | text | `aggressive` \| `targeted`; default `aggressive` |
| notification_tier | text | `all` \| `general` \| `primary` \| `critical` \| `manual`; default `general` |
| subscription_tier | text | `free` \| `basic` \| `premium` \| `family`; default `free` |
| subscription_status | text | `active` \| `inactive` \| `cancelled` \| `past_due` \| `trialing`; default `active` |
| subscription_started_at | timestamptz | nullable |
| subscription_ends_at | timestamptz | nullable |
| stripe_customer_id | text | nullable, unique |
| stripe_subscription_id | text | nullable |
| preferences | jsonb | `{dark_mode, auto_remove, compact_view}` |
| notification_settings | jsonb | Full nested notification preferences object |
| last_login_at | timestamptz | nullable |
| last_scan_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

> RLS uses `get_current_user_profile_id()` helper function — NOT `auth.uid()` directly.

---

### `user_preferences`
PK: `user_id` | RLS: ✅ | FK: `user_id → user_profiles.id`

Separate from `user_profiles` to allow onboarding preferences to be written via service role before the user's auth row exists.

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | PK |
| removal_strategy | text | `aggressive` \| `targeted`; nullable |
| notification_tier | text | `all` \| `general` \| `primary` \| `critical` \| `manual`; nullable |
| notification_settings | jsonb | Manual/custom notification preferences; default `{}` |
| created_at / updated_at | timestamptz | |

---

### `user_phones`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| number | text | Stored as E.164 (`+1XXXXXXXXXX`) |
| is_primary | bool | default false |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected`; default `unverified` |
| confirmed_at | timestamptz | nullable |
| source | text | `anywho` \| `zabasearch` \| `both` \| `quick_scan` \| `user_input` \| `scan_discovery`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

> Partial unique index `idx_user_phones_unique_active` on `(user_id, number) WHERE is_active = TRUE` prevents duplicate active numbers per user.

---

### `user_emails`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| email | text | |
| is_primary | bool | default false |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected`; default `unverified` |
| confirmed_at | timestamptz | nullable |
| source | text | `anywho` \| `zabasearch` \| `both` \| `quick_scan` \| `user_input` \| `scan_discovery` \| `auth`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

> Auth email is inserted with `source = 'auth'` and auto-confirmed. Unique constraint on `(user_id, email)`.

---

### `user_addresses`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| street | text | nullable |
| city | text | nullable |
| state | text | nullable |
| zip | text | nullable |
| full_address | text | nullable |
| is_current | bool | default false |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected`; default `unverified` |
| confirmed_at | timestamptz | nullable |
| source | text | `anywho` \| `zabasearch` \| `both` \| `quick_scan` \| `user_input` \| `scan_discovery`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

---

### `user_aliases`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| name | text | |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected`; default `unverified` |
| confirmed_at | timestamptz | nullable |
| source | text | `anywho` \| `zabasearch` \| `both` \| `quick_scan` \| `user_input` \| `scan_discovery`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

> Partial unique index `idx_user_aliases_unique_active` on `(user_id, lower(trim(name))) WHERE is_active = TRUE` prevents duplicate active aliases per user (case-insensitive).

---

### `user_onboarding_progress`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| step | text | `account_signup` \| `data_verification` \| `notification_settings` \| `removal_aggression` |
| status | text | `pending` \| `in_progress` \| `completed` \| `skipped`; default `pending` |
| progress_data | jsonb | default `{}` |
| started_at / completed_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

---

### `family_members`
PK: `id` | RLS: ✅ | FK: `owner_user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| owner_user_id | uuid | |
| first_name | text | |
| last_name | text | |
| middle_name | text | nullable |
| date_of_birth | date | nullable |
| relationship | text | nullable; `spouse` \| `child` \| `parent` \| `sibling` \| `grandparent` \| `other` |
| is_active | bool | default true |
| monitoring_enabled | bool | default true |
| last_scan_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

---

### `quick_scans`
PK: `id` | RLS: ✅ | TTL: 30 minutes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| session_id | text | anonymous session identifier |
| search_input | jsonb | name/location data entered by user |
| status | text | See status values below |
| profile_matches | jsonb | nullable — list of scraped candidates |
| candidate_matches | jsonb | nullable — Zabasearch matches with `fullProfile` |
| selected_match_id | text | nullable |
| profile_data | jsonb | nullable — full detail from AnyWho scrape |
| data_sources | text[] | default `{}` |
| scraper_runs | jsonb | default `[]` |
| error_message | text | nullable |
| expires_at | timestamptz | default now()+30min |
| completed_at / converted_at | timestamptz | nullable |
| converted_to_user_id | uuid | nullable |
| created_at / updated_at | timestamptz | |

**Status values:** `pending` \| `scanning` \| `matches_found` \| `selection_required` \| `processing` \| `completed` \| `no_matches` \| `failed` \| `expired` \| `pending_signup`

> `status = 'pending_signup'` means the user clicked the CTA and profile creation has started but auth hasn't completed yet.

---

### `scan_retry_requests`
PK: `id` | RLS: none (service role only)

Stores email + search context for users whose scan failed. Retried asynchronously; results emailed when ready. 90-day expiry.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| email | text | User-provided email for result delivery |
| search_input | jsonb | `{first_name, last_name, zip_code, city, state}` |
| status | text | `pending` \| `processing` \| `completed` \| `failed_permanent`; default `pending` |
| retry_count | int | default 0 |
| last_retry_at | timestamptz | nullable |
| original_scan_id | uuid | nullable — the failed `quick_scans.id` |
| result_data | jsonb | nullable — populated on success |
| notification_sent_at | timestamptz | nullable |
| converted_to_user_id | uuid | nullable → `auth.users.id` |
| converted_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |
| expires_at | timestamptz | default now()+90 days |

---

### `scan_history`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| family_member_id | uuid | nullable → `family_members.id` |
| scan_type | text | `full` \| `targeted` \| `quick` \| `verification`; default `full` |
| brokers_scanned / succeeded / failed | int | default 0 |
| exposures_found / new_exposures | int | default 0 |
| status | text | `pending` \| `in_progress` \| `completed` \| `failed` \| `cancelled` |
| error_message | text | nullable |
| results | jsonb | default `{}` |
| started_at / completed_at | timestamptz | |
| duration_ms | int | nullable |
| created_at / updated_at | timestamptz | |

---

### `exposures`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`, `broker_id → brokers.brokers.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| family_member_id | uuid | nullable → `family_members.id` |
| broker_id | uuid | → `brokers.brokers.id` |
| profile_url | text | nullable |
| profile_identifier | text | nullable |
| data_snapshot | jsonb | nullable — what was found |
| matched_data_points | jsonb | default `[]` |
| match_confidence | numeric | default 1.00 |
| match_method | text | nullable |
| status | text | `found` \| `queued` \| `removal_requested` \| `removal_in_progress` \| `removed` \| `verified_removed` \| `failed` \| `relisted` \| `manual_required` \| `ignored`; default `found` |
| status_notes | text | nullable |
| first_found_at / last_seen_at | timestamptz | default now() |
| removal_requested_at / removed_at / verified_removed_at | timestamptz | nullable |
| found_in_scan_id | uuid | nullable |
| last_checked_at | timestamptz | nullable |
| check_count | int | default 1 |
| created_at / updated_at | timestamptz | |

---

### `removal_requests`
PK: `id` | RLS: ✅ | FK: `exposure_id → exposures.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| exposure_id | uuid | |
| request_method | text | nullable; `automated` \| `manual_form` \| `email` \| `mail` \| `phone` \| `api` |
| request_reference / request_email | text | nullable |
| request_details | jsonb | nullable |
| status | text | `pending` \| `submitted` \| `acknowledged` \| `processing` \| `completed` \| `failed` \| `retry_scheduled` \| `cancelled`; default `pending` |
| status_notes / failure_reason | text | nullable |
| retry_count | int | default 0 |
| max_retries | int | default 3 |
| is_diy | bool | default false |
| diy_current_step | int | default 0 |
| diy_completed_steps | int[] | default `{}` |
| requested_at / submitted_at / acknowledged_at | timestamptz | |
| expected_completion_at / completed_at / next_retry_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

---

### `data_breaches`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| breach_name | text | |
| breach_title / breach_domain | text | nullable |
| breach_date | date | nullable |
| exposed_data_types | text[] | nullable |
| matched_email | text | nullable |
| is_acknowledged | bool | default false |
| acknowledged_at | timestamptz | nullable |
| hibp_data | jsonb | nullable |
| status | text | `new` \| `unresolved` \| `resolved`; default `new` |
| status_updated_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

---

### `notifications`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| type | text | `new_exposure` \| `removal_complete` \| `removal_failed` \| `scan_complete` \| `subscription` \| `security_alert` \| `action_required` \| `weekly_summary` \| `system` |
| title | text | |
| message / action_url / action_text | text | nullable |
| metadata | jsonb | default `{}` |
| is_read | bool | default false |
| read_at | timestamptz | nullable |
| is_archived | bool | default false |
| email_sent / push_sent | bool | default false |
| email_sent_at / push_sent_at | timestamptz | nullable |
| created_at / expires_at | timestamptz | |

---

### `activity_log`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id` (nullable)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | nullable |
| action | text | |
| entity_type | text | nullable |
| entity_id | uuid | nullable |
| description | text | nullable |
| metadata | jsonb | default `{}` |
| ip_address | inet | nullable |
| user_agent | text | nullable |
| created_at | timestamptz | |

---

### `user_todos`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| exposure_id | uuid | nullable → `exposures.id` |
| broker_id | uuid | nullable → `brokers.brokers.id` |
| title | text | |
| description | text | nullable |
| instructions | jsonb | nullable |
| todo_type | text | `manual_removal` \| `verification` \| `account_setup` \| `document_upload` \| `follow_up` \| `other`; default `manual_removal` |
| priority | text | `low` \| `medium` \| `high` \| `urgent`; default `medium` |
| status | text | `pending` \| `in_progress` \| `completed` \| `skipped` \| `blocked`; default `pending` |
| due_date | date | nullable |
| reminder_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |
| completed_at | timestamptz | nullable |

---

### `zip_lookup`
PK: `zip` | RLS: ✅ | Rows: seeded

| Column | Type |
|--------|------|
| zip | text PK |
| city | text |
| state_code | text |
| created_at | timestamptz |

> Populated on first lookup via Zippopotam.us API and cached here for future requests.

---

### `access_codes`
PK: `id` | RLS: service_role only

Supports two modes: **Option A** — shared multi-use code (`reserved_for_profile_id = NULL`, `max_uses = NULL` for unlimited or an integer cap); **Option B** — single-use user-specific code (`reserved_for_profile_id = <uuid>`, `max_uses = 1`).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| code | text | Unique; auto-uppercased + trimmed on insert via trigger |
| description | text | nullable |
| max_uses | int | nullable — NULL = unlimited uses; integer = hard cap |
| use_count | int | default 0 |
| reserved_for_profile_id | uuid | nullable → `user_profiles.id`; NULL = shared (Option A); set for user-specific (Option B) |
| is_active | bool | default true |
| expires_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

> RLS: service_role full access only — codes are never read or written directly from the client.

---

## Brokers Schema Tables

> All tables below live in the `brokers` Postgres schema (not `public`). Referenced in `public` tables as `brokers.brokers.id`.

### `brokers.brokers`
PK: `id` | RLS: none (service role) | Self-referencing FK: `parent_broker_id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| parent_broker_id | uuid | nullable → `brokers.brokers.id` (subsidiary relationship) |
| type | text | `people_search` \| `background_check` \| `marketing_list` \| `data_aggregator` \| `financial` \| `employment` \| `public_records` |
| data_types | text[] | Subset of `identity`, `real_estate`, `employment`, `vehicle`, `voter`, `credit`, `phone_records`; default `{}` |
| removal_priority | smallint | `0`–`3`; default `2` |
| scrape_type | text | nullable; `web_form` \| `api` \| `email` \| `manual` \| `none` |
| opt_out_type | text | nullable; `web_form` \| `email` \| `automated_api` \| `manual` |
| company_url | text | nullable |
| privacy_policy_url | text | nullable |
| opt_out_url | text | nullable |
| opt_out_email | text | nullable |
| requires_email_verification | bool | default false |
| removal_directions | text | nullable — human-readable opt-out instructions |
| collection_practices_comments | text | nullable |
| reporting_comments | text | nullable |
| about | text | nullable — short descriptive snippet about the broker |
| is_active | bool | default true |
| created_at / updated_at | timestamptz | |

---

### `brokers.broker_stats`
PK: `id` | RLS: none | FK: `broker_id → brokers.brokers.id`

Crowd-sourced / aggregated removal outcome statistics per broker and request type.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| broker_id | uuid | |
| request_type | text | `delete` \| `data_present` \| `data_shared` \| `opt_out` |
| approval_ratio | numeric | nullable; 0.00–1.00 |
| denial_ratio | numeric | nullable; 0.00–1.00 |
| avg_days | numeric | nullable; average days to resolution ≥ 0 |
| sample_size | int | default 0 |
| created_at / updated_at | timestamptz | |

---

### `brokers.broker_vanyshr_stats`
PK: `id` | RLS: none | FK: `broker_id → brokers.brokers.id`, `user_profile_id → public.user_profiles.id`

Individual Vanyshr removal outcome records — feeds into `broker_stats` aggregates.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| broker_id | uuid | |
| user_profile_id | uuid | nullable → `public.user_profiles.id` |
| request_type | text | `delete` \| `data_present` \| `data_shared` \| `opt_out` |
| outcome | text | nullable; `approved` \| `denied` \| `pending` \| `no_record` |
| days_to_resolution | numeric | nullable; ≥ 0 |
| created_at | timestamptz | |

---

## Key Conventions

- **RLS:** All tables use Row Level Security. Auth context resolved via `get_current_user_profile_id()` — not `auth.uid()` directly.
- **Pre-auth writes:** Must go through service-role Edge Functions (`create-pending-profile`, `link-auth-to-profile`). Never direct from client.
- **Soft delete:** `is_active = false` on user data tables (phones, emails, addresses, aliases, family_members).
- **Confirmation flow:** All onboarding data starts `user_confirmed_status = 'unverified'`. User confirming → `'confirmed'`, `confirmed_at = NOW()`.
- **Auth email:** Auto-confirmed with `source = 'auth'` in `user_emails`.
- **Phone storage:** E.164 format (`+1XXXXXXXXXX`). Normalized on insert by `normalize_phone_e164()` DB function.
- **Source tracking:** `user_phones`, `user_emails`, `user_addresses`, `user_aliases` all track `source` as `anywho` | `zabasearch` | `both` | `quick_scan` | `user_input` | `scan_discovery`. `both` means the same record was found by both scrapers.
- **quick_scans TTL:** 30-minute expiry via `expires_at`. Status `pending_signup` means user clicked CTA but hasn't completed auth yet.
- **Brokers schema:** `brokers`, `broker_categories`, and `broker_category_map` live in a separate `brokers` Postgres schema (not `public`).

---

## DB Functions

| Function | Description |
|----------|-------------|
| `get_current_user_profile_id()` | Resolves the `user_profiles.id` for the current auth session. Used in all RLS policies. |
| `normalize_phone_e164(text)` | Strips non-digits, normalizes 10- and 11-digit US numbers to `+1XXXXXXXXXX`. `IMMUTABLE`. |
| `create_pending_profile(p_scan_id UUID, p_email TEXT DEFAULT NULL)` | Creates a `user_profiles` row from a `quick_scans` record with `signup_status = 'pending_user'`. Seeds phones, addresses, and aliases from `quick_scans.profile_data`; seeds `user_preferences`; calls `initialize_onboarding_steps`. service_role only. |
| `initialize_onboarding_steps(user_id UUID)` | Seeds `user_onboarding_progress` rows for a new user. Called by `create_pending_profile`. |
| `fan_out_broadcast_update(...)` | `SECURITY DEFINER` — inserts a `user_updates` row for every active user. Used for admin broadcasts. *(Available after pending migration is applied.)* |
| `validate_access_code(p_code TEXT, p_profile_id UUID)` | Validates a beta access code (active, not expired). Atomically claims a use via `UPDATE ... WHERE use_count < max_uses RETURNING id` (prevents double-spend on limited codes), then advances profile `signup_status` → `accessed_pending_signup`. Compensates (decrements `use_count`) if the profile update fails. Returns `{ success: false }` on any failure. Returns `{ success, profile_id }`. service_role only. |
| `join_waitlist(p_profile_id UUID, p_email TEXT)` | Sets profile `signup_status` → `waitlisted`, writes email to `user_profiles.email` and upserts into `user_emails`. Returns `{ success, profile_id }`. service_role only. |
| `purge_orphaned_beta_profiles(p_older_than_days INTEGER DEFAULT 7)` | Deletes `pending_user` and `accessed_pending_signup` profiles older than the threshold (no `auth_user_id`). Unlocks associated `quick_scans` first. Returns deleted count. Wire to a scheduled cron job. service_role only. |

---

## Pending Migrations

| Migration | Status | Description |
|-----------|--------|-------------|
| `20260316_user_updates.sql` | ✅ Applied | Creates `user_updates` table — per-user notifications/feature announcements with `unread → dismissed \| clicked \| converted` lifecycle. Includes `fan_out_broadcast_update()` function and RLS policies. |
| `20260317_brokers_about_column.sql` | ✅ Applied | Adds `about text` column to `brokers.brokers` for broker description snippets. |
| `20260318_beta_access.sql` | ✅ Applied | Expands `signup_status` to 6-value funnel; adds `access_codes` table; adds `validate_access_code()`, `join_waitlist()`, `purge_orphaned_beta_profiles()` functions. |
| `20260320_fix_pending_profile_status.sql` | ✅ Applied | Drops dead 1-arg `create_pending_profile(UUID)` overload (accidentally created by 20260318); updates canonical 2-arg version to write `signup_status = 'pending_user'` instead of `'pending_auth'`. |
| `20260320_fix_validate_access_code.sql` | ✅ Applied | Fixes `validate_access_code()`: reorders ops (profile UPDATE before `use_count` increment) and adds `IF NOT FOUND` guard — wrong-state profiles now return `{ success: false }` without consuming a code use. |
| `20260320_fix_validate_access_code_atomic.sql` | ✅ Applied | Makes `validate_access_code()` fully atomic: collapses `use_count` check+increment into a single `UPDATE ... WHERE use_count < max_uses RETURNING id`; adds compensation decrement if profile update fails. Supersedes `20260320_fix_validate_access_code.sql`. |

### `user_updates` (pending)
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| title | text | |
| message | text | |
| action_text | text | nullable — CTA label |
| action_route | text | nullable — in-app route to navigate on click |
| type | text | `info` \| `tip` \| `alert` \| `action_required` \| `new_feature`; default `info` |
| icon | text | nullable |
| status | text | `unread` \| `dismissed` \| `clicked` \| `converted`; default `unread` |
| expires_at | timestamptz | nullable |
| created_at | timestamptz | |

> Index: `idx_user_updates_user_status` on `(user_id, status, created_at DESC)`.
