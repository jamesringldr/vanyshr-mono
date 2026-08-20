-- ============================================================================
-- Migration: 20260820120004_readback_drop_profile_data_fallback.sql
-- ============================================================================
-- Description: Stop get_pilot_scan_result() from returning two different
--              shapes under one key.
--
-- 20260820120002 defined:
--
--     'consolidated_profile',
--         COALESCE(v_enrichment.consolidated_profile, v_scan.profile_data)
--
-- At the time both columns held the same thing. They no longer do.
-- finalizeScan() in the pilot-scan edge function now writes profile_data in the
-- LEGACY shape ({phones:[{number}], emails:[{email}], addresses:[…],
-- aliases:[…]}), because public.create_pending_profile() reads that column at
-- signup and parses exactly those keys. The rich ConsolidatedProfile
-- ({phone_numbers:[], emails:[], primary_address:{…}}) lives on
-- quickscan_enrichment.consolidated_profile.
--
-- With the COALESCE left in place, a scan whose enrichment failed to store
-- would silently return the legacy shape under `consolidated_profile`, and the
-- client would parse `.emails[0].email` as undefined against a string array.
-- Returning NULL is the honest answer: there IS no consolidated profile stored.
--
-- `selected_group` is unaffected, so a Phase-1-only scan still renders.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pilot_scan_result(p_scan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'quickscan'
AS $function$
DECLARE
    v_scan       RECORD;
    v_group      RECORD;
    v_enrichment RECORD;
BEGIN
    SELECT id, status, search_input, candidate_matches, profile_data,
           dedup_group_id, enrichment_id, purge_after, created_at, completed_at
    INTO v_scan
    FROM quickscan.quick_scans
    WHERE id = p_scan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_scan.purge_after IS NOT NULL AND v_scan.purge_after < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    SELECT full_data, primary_name, primary_age, primary_city, primary_state,
           sources, average_confidence, age_conflict, age_note
    INTO v_group
    FROM quickscan.quickscan_dedup_groups
    WHERE id = v_scan.dedup_group_id;

    SELECT emails_found, services_found, breaches, consolidated_profile,
           holehe_status, leakcheck_status, breach_count,
           services_checked, services_unavailable, fields_exposed
    INTO v_enrichment
    FROM quickscan.quickscan_enrichment
    WHERE id = v_scan.enrichment_id;

    RETURN jsonb_build_object(
        'success',           true,
        'scan_id',           v_scan.id,
        'status',            v_scan.status,
        'created_at',        v_scan.created_at,
        'completed_at',      v_scan.completed_at,
        'search_input',      v_scan.search_input,
        'candidate_matches', v_scan.candidate_matches,
        'selected_group',    CASE WHEN v_group IS NULL THEN NULL ELSE jsonb_build_object(
                                 'full_data',          v_group.full_data,
                                 'primary_name',       v_group.primary_name,
                                 'primary_age',        v_group.primary_age,
                                 'primary_city',       v_group.primary_city,
                                 'primary_state',      v_group.primary_state,
                                 'sources',            to_jsonb(v_group.sources),
                                 'average_confidence', v_group.average_confidence,
                                 'age_conflict',       v_group.age_conflict,
                                 'age_note',           v_group.age_note
                             ) END,
        -- No COALESCE onto profile_data: different shape, different contract.
        'consolidated_profile', v_enrichment.consolidated_profile,
        'enrichment',        CASE WHEN v_enrichment IS NULL THEN NULL ELSE jsonb_build_object(
                                 'emails_found',         to_jsonb(v_enrichment.emails_found),
                                 'services_found',       to_jsonb(v_enrichment.services_found),
                                 'breaches',             v_enrichment.breaches,
                                 'breach_count',         v_enrichment.breach_count,
                                 'holehe_status',        v_enrichment.holehe_status,
                                 'leakcheck_status',     v_enrichment.leakcheck_status,
                                 'services_checked',     v_enrichment.services_checked,
                                 'services_unavailable', v_enrichment.services_unavailable,
                                 'fields_exposed',       to_jsonb(v_enrichment.fields_exposed)
                             ) END
    );
END;
$function$;

COMMENT ON FUNCTION public.get_pilot_scan_result(UUID) IS
  'Read back a stored pilot scan by id: selected group, enrichment and '
  'consolidated profile. The scan UUID is the capability — there is no '
  'authenticated user at pilot-scan time. Returns {success:false, '
  'error:"expired"} once purge_after has passed. consolidated_profile comes '
  'ONLY from quickscan_enrichment; quick_scans.profile_data holds the '
  'differently-shaped signup copy and is deliberately not exposed here.';

GRANT EXECUTE ON FUNCTION public.get_pilot_scan_result(UUID) TO anon, authenticated;
