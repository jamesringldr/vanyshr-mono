-- ============================================================================
-- Migration: 00012_scraper_source_tracking.sql
-- ============================================================================
-- 1. E.164 phone normalization helper function
-- 2. Update source CHECK constraints across user data tables to replace the
--    generic 'quick_scan' value with 'anywho', 'zabasearch', 'both'
-- 3. Normalize existing phone numbers to E.164 and dedup active rows
-- 4. Partial unique indexes on phones (user_id, number) and
--    aliases (user_id, lower(trim(name))) — scoped to is_active = TRUE
-- 5. Replace create_pending_profile() to:
--    • Read AnyWho data from profile_data       → source = 'anywho'
--    • Read Zabasearch data from candidate_matches → source = 'zabasearch'
--    • Deduplicate across sources                → source = 'both'
--    • Normalize phones to E.164 on insert
--    • Also insert emails from both sources
-- ============================================================================


-- ============================================================================
-- SECTION 1: normalize_phone_e164(TEXT)
-- ============================================================================
-- Strips all non-digits, handles 10-digit and 11-digit (leading 1) US numbers.
-- Returns '+1XXXXXXXXXX' for valid US numbers, or the raw digits as fallback.

CREATE OR REPLACE FUNCTION normalize_phone_e164(p_number TEXT)
RETURNS TEXT AS $$
DECLARE
    v_digits TEXT;
BEGIN
    IF p_number IS NULL THEN RETURN NULL; END IF;
    v_digits := regexp_replace(p_number, '[^0-9]', '', 'g');
    -- 11 digits starting with 1 (e.g. 18162258592) → strip leading 1
    IF length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN
        v_digits := substring(v_digits FROM 2);
    END IF;
    IF length(v_digits) = 10 THEN
        RETURN '+1' || v_digits;
    END IF;
    -- Non-standard length — return digits as fallback (won't break inserts)
    RETURN v_digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- SECTION 2: UPDATE source CHECK CONSTRAINTS
-- ============================================================================
-- Replace 'quick_scan' with specific scraper values.
-- 'quick_scan' is kept so any existing rows remain valid.

-- user_phones
ALTER TABLE user_phones DROP CONSTRAINT IF EXISTS user_phones_source_check;
ALTER TABLE user_phones ADD CONSTRAINT user_phones_source_check
    CHECK (source IN ('anywho', 'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'));

-- user_emails
ALTER TABLE user_emails DROP CONSTRAINT IF EXISTS user_emails_source_check;
ALTER TABLE user_emails ADD CONSTRAINT user_emails_source_check
    CHECK (source IN ('anywho', 'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery', 'auth'));

-- user_addresses
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_source_check;
ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_source_check
    CHECK (source IN ('anywho', 'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'));

-- user_aliases
ALTER TABLE user_aliases DROP CONSTRAINT IF EXISTS user_aliases_source_check;
ALTER TABLE user_aliases ADD CONSTRAINT user_aliases_source_check
    CHECK (source IN ('anywho', 'zabasearch', 'both', 'quick_scan', 'user_input', 'scan_discovery'));


-- ============================================================================
-- SECTION 3: NORMALIZE EXISTING PHONE NUMBERS TO E.164
-- ============================================================================
-- Update all existing rows to E.164 format before adding the unique index.

UPDATE user_phones
SET number = normalize_phone_e164(number)
WHERE number IS NOT NULL
  AND number != normalize_phone_e164(number);

-- Deactivate duplicate active phone rows for the same user after normalization.
-- Keeps the row with is_primary = TRUE first, then earliest created_at.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, number
               ORDER BY is_primary DESC, created_at ASC
           ) AS rn
    FROM user_phones
    WHERE is_active = TRUE
)
UPDATE user_phones
SET is_active = FALSE
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- ============================================================================
-- SECTION 4: PARTIAL UNIQUE INDEXES
-- ============================================================================
-- Scoped to is_active = TRUE so soft-deleted rows don't cause conflicts.

-- Phones: unique active number per user (E.164 ensures consistent format)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phones_unique_active
    ON user_phones(user_id, number)
    WHERE is_active = TRUE;

-- Aliases: unique active name per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_aliases_unique_active
    ON user_aliases(user_id, lower(trim(name)))
    WHERE is_active = TRUE;


-- ============================================================================
-- SECTION 5: REPLACE create_pending_profile()
-- ============================================================================

DROP FUNCTION IF EXISTS create_pending_profile(UUID, TEXT);

CREATE OR REPLACE FUNCTION create_pending_profile(
    p_scan_id UUID,
    p_email   TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
    v_email_rec  JSONB;
    v_match      JSONB;
    v_normalized TEXT;
BEGIN
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    -- ── Create user_profiles row ──────────────────────────────────────────
    INSERT INTO user_profiles (
        id, first_name, last_name, email,
        signup_status, source_quick_scan_id,
        onboarding_completed, onboarding_step
    ) VALUES (
        v_profile_id,
        COALESCE(v_scan.search_input->>'first_name', ''),
        COALESCE(v_scan.search_input->>'last_name', ''),
        NULLIF(trim(COALESCE(p_email, '')), ''),
        'pending_auth',
        p_scan_id,
        FALSE,
        0
    );

    -- Seed preferences and onboarding steps
    INSERT INTO user_preferences (user_id) VALUES (v_profile_id);
    PERFORM initialize_onboarding_steps(v_profile_id);

    -- Lock the scan
    UPDATE quick_scans
    SET status = 'pending_signup', converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;


    -- ════════════════════════════════════════════════════════════════════════
    -- PHONES
    -- ════════════════════════════════════════════════════════════════════════

    -- ── AnyWho phones (profile_data) ─────────────────────────────────────
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'phones') = 'array'
    THEN
        FOR v_phone IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'phones')
        LOOP
            CONTINUE WHEN v_phone->>'number' IS NULL OR trim(v_phone->>'number') = '';
            v_normalized := normalize_phone_e164(trim(v_phone->>'number'));
            CONTINUE WHEN v_normalized IS NULL OR length(v_normalized) < 10;

            INSERT INTO user_phones (
                user_id, number, is_primary, source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                v_normalized,
                COALESCE((v_phone->>'is_primary')::boolean, FALSE),
                'anywho',
                'unverified'
            )
            ON CONFLICT (user_id, number) WHERE is_active = TRUE
            DO UPDATE SET
                source     = CASE WHEN user_phones.source != 'anywho' THEN 'both' ELSE 'anywho' END,
                is_primary = CASE WHEN EXCLUDED.is_primary THEN TRUE ELSE user_phones.is_primary END;
        END LOOP;
    END IF;

    -- ── Zabasearch phones (candidate_matches[*].fullProfile) ──────────────
    IF v_scan.candidate_matches IS NOT NULL
       AND jsonb_typeof(v_scan.candidate_matches) = 'array'
    THEN
        FOR v_match IN
            SELECT value FROM jsonb_array_elements(v_scan.candidate_matches)
        LOOP
            CONTINUE WHEN v_match->'fullProfile' IS NULL;
            CONTINUE WHEN jsonb_typeof(v_match->'fullProfile'->'phones') != 'array';

            FOR v_phone IN
                SELECT value FROM jsonb_array_elements(v_match->'fullProfile'->'phones')
            LOOP
                CONTINUE WHEN v_phone->>'number' IS NULL OR trim(v_phone->>'number') = '';
                v_normalized := normalize_phone_e164(trim(v_phone->>'number'));
                CONTINUE WHEN v_normalized IS NULL OR length(v_normalized) < 10;

                INSERT INTO user_phones (
                    user_id, number, is_primary, source, user_confirmed_status
                ) VALUES (
                    v_profile_id,
                    v_normalized,
                    COALESCE((v_phone->>'primary')::boolean, FALSE),
                    'zabasearch',
                    'unverified'
                )
                ON CONFLICT (user_id, number) WHERE is_active = TRUE
                DO UPDATE SET
                    source     = CASE WHEN user_phones.source != 'zabasearch' THEN 'both' ELSE 'zabasearch' END,
                    is_primary = CASE WHEN EXCLUDED.is_primary THEN TRUE ELSE user_phones.is_primary END;
            END LOOP;
        END LOOP;
    END IF;


    -- ════════════════════════════════════════════════════════════════════════
    -- ADDRESSES
    -- Note: cross-scraper address dedup is not applied here because AnyWho
    -- returns structured city/state/zip fields while Zabasearch returns
    -- full_address strings — reliable normalization requires an address API.
    -- Users review and confirm addresses during onboarding.
    -- ════════════════════════════════════════════════════════════════════════

    -- ── AnyWho addresses ─────────────────────────────────────────────────
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'addresses') = 'array'
    THEN
        FOR v_address IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'addresses')
        LOOP
            INSERT INTO user_addresses (
                user_id, full_address, street, city, state, zip,
                is_current, source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                NULLIF(trim(COALESCE(v_address->>'full_address', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'street',       '')), ''),
                NULLIF(trim(COALESCE(v_address->>'city',         '')), ''),
                NULLIF(trim(COALESCE(v_address->>'state',        '')), ''),
                NULLIF(trim(COALESCE(v_address->>'zip',          '')), ''),
                COALESCE((v_address->>'is_current')::boolean, FALSE),
                'anywho',
                'unverified'
            );
        END LOOP;
    END IF;

    -- ── Zabasearch addresses ──────────────────────────────────────────────
    IF v_scan.candidate_matches IS NOT NULL
       AND jsonb_typeof(v_scan.candidate_matches) = 'array'
    THEN
        FOR v_match IN
            SELECT value FROM jsonb_array_elements(v_scan.candidate_matches)
        LOOP
            CONTINUE WHEN v_match->'fullProfile' IS NULL;
            CONTINUE WHEN jsonb_typeof(v_match->'fullProfile'->'addresses') != 'array';

            FOR v_address IN
                SELECT value FROM jsonb_array_elements(v_match->'fullProfile'->'addresses')
            LOOP
                CONTINUE WHEN (v_address->>'full_address') IS NULL
                           AND (v_address->>'street') IS NULL;

                INSERT INTO user_addresses (
                    user_id, full_address, street, city, state, zip,
                    is_current, source, user_confirmed_status
                ) VALUES (
                    v_profile_id,
                    NULLIF(trim(COALESCE(v_address->>'full_address', '')), ''),
                    NULLIF(trim(COALESCE(v_address->>'street',       '')), ''),
                    NULLIF(trim(COALESCE(v_address->>'city',         '')), ''),
                    NULLIF(trim(COALESCE(v_address->>'state',        '')), ''),
                    NULLIF(trim(COALESCE(v_address->>'zip',          '')), ''),
                    COALESCE((v_address->>'is_last_known')::boolean, FALSE),
                    'zabasearch',
                    'unverified'
                );
            END LOOP;
        END LOOP;
    END IF;


    -- ════════════════════════════════════════════════════════════════════════
    -- ALIASES
    -- ════════════════════════════════════════════════════════════════════════

    -- ── AnyWho aliases (string array) ─────────────────────────────────────
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'aliases') = 'array'
    THEN
        FOR v_alias IN
            SELECT value FROM jsonb_array_elements_text(v_scan.profile_data->'aliases')
        LOOP
            CONTINUE WHEN v_alias IS NULL OR trim(v_alias) = '';

            INSERT INTO user_aliases (user_id, name, source, user_confirmed_status)
            VALUES (v_profile_id, trim(v_alias), 'anywho', 'unverified')
            ON CONFLICT (user_id, lower(trim(name))) WHERE is_active = TRUE
            DO UPDATE SET source = CASE WHEN user_aliases.source != 'anywho' THEN 'both' ELSE 'anywho' END;
        END LOOP;
    END IF;

    -- ── Zabasearch aliases ({alias: "..."} object array) ──────────────────
    IF v_scan.candidate_matches IS NOT NULL
       AND jsonb_typeof(v_scan.candidate_matches) = 'array'
    THEN
        FOR v_match IN
            SELECT value FROM jsonb_array_elements(v_scan.candidate_matches)
        LOOP
            CONTINUE WHEN v_match->'fullProfile' IS NULL;
            CONTINUE WHEN jsonb_typeof(v_match->'fullProfile'->'aliases') != 'array';

            FOR v_alias IN
                SELECT value->>'alias'
                FROM jsonb_array_elements(v_match->'fullProfile'->'aliases')
            LOOP
                CONTINUE WHEN v_alias IS NULL OR trim(v_alias) = '';

                INSERT INTO user_aliases (user_id, name, source, user_confirmed_status)
                VALUES (v_profile_id, trim(v_alias), 'zabasearch', 'unverified')
                ON CONFLICT (user_id, lower(trim(name))) WHERE is_active = TRUE
                DO UPDATE SET source = CASE WHEN user_aliases.source != 'zabasearch' THEN 'both' ELSE 'zabasearch' END;
            END LOOP;
        END LOOP;
    END IF;


    -- ════════════════════════════════════════════════════════════════════════
    -- EMAILS
    -- ════════════════════════════════════════════════════════════════════════

    -- ── AnyWho emails ─────────────────────────────────────────────────────
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'emails') = 'array'
    THEN
        FOR v_email_rec IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'emails')
        LOOP
            CONTINUE WHEN (v_email_rec->>'email') IS NULL
                       OR trim(v_email_rec->>'email') = '';

            INSERT INTO user_emails (user_id, email, is_primary, source, user_confirmed_status)
            VALUES (
                v_profile_id,
                lower(trim(v_email_rec->>'email')),
                FALSE,
                'anywho',
                'unverified'
            )
            ON CONFLICT (user_id, email)
            DO UPDATE SET source = CASE WHEN user_emails.source != 'anywho' THEN 'both' ELSE 'anywho' END;
        END LOOP;
    END IF;

    -- ── Zabasearch emails ─────────────────────────────────────────────────
    IF v_scan.candidate_matches IS NOT NULL
       AND jsonb_typeof(v_scan.candidate_matches) = 'array'
    THEN
        FOR v_match IN
            SELECT value FROM jsonb_array_elements(v_scan.candidate_matches)
        LOOP
            CONTINUE WHEN v_match->'fullProfile' IS NULL;
            CONTINUE WHEN jsonb_typeof(v_match->'fullProfile'->'emails') != 'array';

            FOR v_email_rec IN
                SELECT value FROM jsonb_array_elements(v_match->'fullProfile'->'emails')
            LOOP
                CONTINUE WHEN (v_email_rec->>'email') IS NULL
                           OR trim(v_email_rec->>'email') = '';

                INSERT INTO user_emails (user_id, email, is_primary, source, user_confirmed_status)
                VALUES (
                    v_profile_id,
                    lower(trim(v_email_rec->>'email')),
                    FALSE,
                    'zabasearch',
                    'unverified'
                )
                ON CONFLICT (user_id, email)
                DO UPDATE SET source = CASE WHEN user_emails.source != 'zabasearch' THEN 'both' ELSE 'zabasearch' END;
            END LOOP;
        END LOOP;
    END IF;


    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', v_profile_id,
        'scan_id',    p_scan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 6: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION normalize_phone_e164(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_pending_profile(UUID, TEXT) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- normalize_phone_e164()       NEW — E.164 normalization for US phone numbers
-- user_phones.source           CHECK updated: 'anywho' | 'zabasearch' | 'both'
--                              (+ legacy 'quick_scan' | 'user_input' | 'scan_discovery')
-- user_emails.source           Same + 'auth'
-- user_addresses.source        Same
-- user_aliases.source          Same
-- idx_user_phones_unique_active   NEW partial UNIQUE index (is_active = TRUE)
-- idx_user_aliases_unique_active  NEW partial UNIQUE index (is_active = TRUE)
-- create_pending_profile()     UPDATED — reads both profile_data (AnyWho) and
--                              candidate_matches[*].fullProfile (Zabasearch),
--                              normalizes phones to E.164, deduplicates with
--                              source='both' on conflict, inserts emails
-- ============================================================================
