# Vanyshr Database Schema
**Project:** Vanyshr Production (`skhejbzrfptrusskuqoy`, us-west-2)
**Migrations applied:** 00001–00007
**Last updated:** 2026-03-04

---

## Tables Overview

| Table | Description |
|-------|-------------|
| `user_profiles` | Core user record, decoupled from auth |
| `user_phones` | Phone numbers per user |
| `user_emails` | Email addresses per user |
| `user_addresses` | Addresses per user |
| `user_aliases` | Name aliases per user |
| `user_onboarding_progress` | Step-by-step onboarding tracking |
| `family_members` | Additional people monitored under one account |
| `quick_scans` | Ephemeral pre-auth scan data (30-min TTL) |
| `scan_history` | Audit log of full scans post-signup |
| `exposures` | Data broker listings found for a user |
| `removal_requests` | Opt-out requests per exposure |
| `brokers` | Data broker registry |
| `broker_categories` | Broker classification categories |
| `broker_category_map` | Many-to-many broker ↔ category |
| `data_breaches` | HIBP breach records per user |
| `notifications` | In-app/email/push notification records |
| `activity_log` | System audit trail |
| `user_todos` | Manual action items for users |
| `zip_lookup` | Zip → city/state lookup (seeded) |

---

## Table Details

### `user_profiles`
PK: `id` (own UUID — NOT `auth.uid()`) | RLS: ✅

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| first_name | text | |
| last_name | text | |
| middle_name | text | nullable |
| date_of_birth | date | nullable |
| gender | text | nullable |
| email | text | nullable |
| auth_user_id | uuid | nullable, unique → `auth.users.id` |
| signup_status | text | `pending_auth` \| `active` \| `suspended`; default `pending_auth` |
| source_quick_scan_id | uuid | nullable → `quick_scans.id` |
| onboarding_completed | bool | default false |
| onboarding_step | int | default 0 |
| subscription_tier | text | `free` \| `basic` \| `premium` \| `family`; default `free` |
| subscription_status | text | `active` \| `inactive` \| `cancelled` \| `past_due` \| `trialing`; default `active` |
| subscription_started_at | timestamptz | nullable |
| subscription_ends_at | timestamptz | nullable |
| stripe_customer_id | text | nullable, unique |
| stripe_subscription_id | text | nullable |
| removal_aggression | text | `conservative` \| `balanced` \| `aggressive` \| `maximum`; default `balanced` |
| preferences | jsonb | `{dark_mode, auto_remove, compact_view}` |
| notification_settings | jsonb | `{push_enabled, email_new_exposure, email_weekly_summary, email_removal_complete}` |
| last_login_at | timestamptz | nullable |
| last_scan_at | timestamptz | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> RLS uses `get_current_user_profile_id()` helper function — NOT `auth.uid()` directly.

---

### `user_phones`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| number | text | |
| is_primary | bool | default false |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected`; default `unverified` |
| confirmed_at | timestamptz | nullable |
| source | text | `quick_scan` \| `user_input` \| `scan_discovery`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

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
| source | text | `quick_scan` \| `user_input` \| `scan_discovery` \| `auth`; default `user_input` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

> Auth email is inserted with `source = 'auth'` and auto-confirmed (skips `unverified` state).

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
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected` |
| confirmed_at | timestamptz | nullable |
| source | text | `quick_scan` \| `user_input` \| `scan_discovery` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

> On edit: structured fields (street/city/state/zip) are cleared to prevent stale data alongside new `full_address`.

---

### `user_aliases`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| name | text | |
| user_confirmed_status | text | `unverified` \| `confirmed` \| `rejected` |
| confirmed_at | timestamptz | nullable |
| source | text | `quick_scan` \| `user_input` \| `scan_discovery` |
| is_active | bool | default true (soft delete) |
| created_at / updated_at | timestamptz | |

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
| status | text | `pending` \| `scanning` \| `matches_found` \| `selection_required` \| `processing` \| `completed` \| `no_matches` \| `failed` \| `expired` \| `pending_signup` |
| profile_matches | jsonb | nullable — list of scraped candidates |
| candidate_matches | jsonb | nullable |
| selected_match_id | text | nullable |
| profile_data | jsonb | nullable — full detail from `universal-details` edge fn |
| data_sources | text[] | default `{}` |
| scraper_runs | jsonb | default `[]` |
| error_message | text | nullable |
| expires_at | timestamptz | default now()+30min |
| completed_at / converted_at | timestamptz | nullable |
| converted_to_user_id | uuid | nullable |
| created_at / updated_at | timestamptz | |

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
| created_at | timestamptz | |

---

### `exposures`
PK: `id` | RLS: ✅ | FK: `user_id → user_profiles.id`, `broker_id → brokers.id`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| family_member_id | uuid | nullable → `family_members.id` |
| broker_id | uuid | |
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

### `brokers`
PK: `id` | RLS: ✅

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name / slug | text | unique |
| parent_broker_id | uuid | nullable → self-ref |
| website_url / search_url_template / opt_out_url / privacy_policy_url | text | nullable |
| opt_out_method | text | `online_form` \| `email` \| `mail` \| `phone` \| `automated` \| `account_required` \| `none` |
| opt_out_difficulty | text | `easy` \| `medium` \| `hard` \| `very_hard`; default `medium` |
| opt_out_steps | jsonb | nullable |
| requires_verification | bool | default false |
| verification_method | text | `email` \| `phone` \| `sms` \| `id_upload` \| `notarized_letter` \| `none` |
| estimated_removal_days | int | default 14 |
| re_listing_likelihood | text | `low` \| `medium` \| `high`; default `medium` |
| re_scan_interval_days | int | default 90 |
| scraper_config | jsonb | default `{}` |
| is_scrapeable | bool | default true |
| scraper_status | text | `active` \| `degraded` \| `blocked` \| `maintenance` \| `disabled`; default `active` |
| last_scrape_at / last_scrape_success / scrape_success_rate | — | nullable |
| data_types_collected | text[] | default `{}` |
| is_active | bool | default true |
| priority | int | default 50 |
| created_at / updated_at | timestamptz | |

---

### `broker_categories`
PK: `id` | RLS: ✅ | Rows: 6

| Column | Type |
|--------|------|
| id | uuid PK |
| name / slug | text, unique |
| description / icon | text, nullable |
| display_order | int, default 0 |
| created_at | timestamptz |

---

### `broker_category_map`
PK: `(broker_id, category_id)` | RLS: ✅

| Column | Type |
|--------|------|
| broker_id | uuid → `brokers.id` |
| category_id | uuid → `broker_categories.id` |

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
| created_at | timestamptz | |

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
| broker_id | uuid | nullable → `brokers.id` |
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
PK: `zip` | RLS: ✅ | Rows: ~46

| Column | Type |
|--------|------|
| zip | text PK |
| city | text |
| state_code | text |
| created_at | timestamptz |

---

## Key Conventions

- **RLS:** All tables use Row Level Security. Auth context resolved via `get_current_user_profile_id()` — not `auth.uid()` directly.
- **Pre-auth writes:** Must go through service-role edge functions (`create-pending-profile`, `link-auth-to-profile`). Never direct from client.
- **Soft delete:** `is_active = false` on user data tables (phones, emails, addresses, aliases, family_members).
- **Confirmation flow:** All onboarding data starts `user_confirmed_status = 'unverified'`. User confirming → `confirmed`, `confirmed_at = NOW()`.
- **Auth email:** Auto-confirmed with `source = 'auth'` in `user_emails`.
- **quick_scans TTL:** 30-minute expiry via `expires_at`. Status `pending_signup` means user clicked CTA but hasn't authed yet.
