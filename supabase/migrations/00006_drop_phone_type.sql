-- ============================================================================
-- Migration 00006: Drop phone_type from user_phones
-- phone_type was unreliable (scrapers return 'unknown') and not currently used.
-- Can be re-added later with a proper data source.
-- ============================================================================

ALTER TABLE user_phones DROP COLUMN IF EXISTS phone_type;

-- ============================================================================
-- Update create_pending_profile() to remove phone_type from INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION create_pending_profile(p_scan_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_scan       RECORD;
    v_profile_id UUID := gen_random_uuid();
    v_phone      JSONB;
    v_address    JSONB;
    v_alias      TEXT;
BEGIN
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    -- Create the user_profiles row.
    INSERT INTO user_profiles (
        id,
        first_name,
        last_name,
        signup_status,
        source_quick_scan_id,
        onboarding_completed,
        onboarding_step
    ) VALUES (
        v_profile_id,
        COALESCE(v_scan.search_input->>'first_name', ''),
        COALESCE(v_scan.search_input->>'last_name', ''),
        'pending_auth',
        p_scan_id,
        FALSE,
        0
    );

    -- Lock the scan so the cleanup job doesn't delete it while signup is pending.
    UPDATE quick_scans
    SET
        status               = 'pending_signup',
        converted_to_user_id = v_profile_id
    WHERE id = p_scan_id;

    -- ----------------------------------------------------------------
    -- Populate user_phones
    -- ----------------------------------------------------------------
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'phones') = 'array'
    THEN
        FOR v_phone IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'phones')
        LOOP
            CONTINUE WHEN v_phone->>'number' IS NULL
                       OR trim(v_phone->>'number') = '';

            INSERT INTO user_phones (
                user_id, number, is_primary,
                source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                trim(v_phone->>'number'),
                COALESCE((v_phone->>'is_primary')::boolean, FALSE),
                'quick_scan',
                'unverified'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- ----------------------------------------------------------------
    -- Populate user_addresses
    -- ----------------------------------------------------------------
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'addresses') = 'array'
    THEN
        FOR v_address IN
            SELECT value FROM jsonb_array_elements(v_scan.profile_data->'addresses')
        LOOP
            INSERT INTO user_addresses (
                user_id,
                full_address,
                street, city, state, zip,
                is_current,
                source,
                user_confirmed_status
            ) VALUES (
                v_profile_id,
                NULLIF(trim(COALESCE(v_address->>'full_address', '')), ''),
                NULLIF(trim(COALESCE(v_address->>'street',  '')), ''),
                NULLIF(trim(COALESCE(v_address->>'city',    '')), ''),
                NULLIF(trim(COALESCE(v_address->>'state',   '')), ''),
                NULLIF(trim(COALESCE(v_address->>'zip',     '')), ''),
                COALESCE((v_address->>'is_current')::boolean, FALSE),
                'quick_scan',
                'unverified'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- ----------------------------------------------------------------
    -- Populate user_aliases
    -- ----------------------------------------------------------------
    IF v_scan.profile_data IS NOT NULL
       AND jsonb_typeof(v_scan.profile_data->'aliases') = 'array'
    THEN
        FOR v_alias IN
            SELECT value->>'alias' FROM jsonb_array_elements(v_scan.profile_data->'aliases')
        LOOP
            CONTINUE WHEN v_alias IS NULL OR trim(v_alias) = '';

            INSERT INTO user_aliases (
                user_id, name, source, user_confirmed_status
            ) VALUES (
                v_profile_id,
                trim(v_alias),
                'quick_scan',
                'unverified'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success',    true,
        'profile_id', v_profile_id,
        'scan_id',    p_scan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
