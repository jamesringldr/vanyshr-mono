-- ============================================================================
-- Migration: 20260820120002_pilot_scan_readback_rpc.sql
-- ============================================================================
-- Description: The read path. Returns a stored pilot scan — the group the user
--              selected, its enrichment, and the consolidated profile — so the
--              results pages can source from the database instead of holding
--              everything in sessionStorage until the tab closes.
--
-- Why this is in `public` and callable by anon:
--   A pilot scan happens BEFORE the person has an account, so there is no
--   auth.uid() to check and no RLS policy that could express ownership. The
--   scan UUID is therefore the capability: holding it is what grants access,
--   exactly as the pre-existing public.get_quick_scan_profile(uuid) already
--   works. The ids are gen_random_uuid() (122 bits of entropy) and are never
--   listed, enumerated, or returned by any other endpoint.
--
--   That is a deliberate tradeoff, not an oversight — anyone who obtains the
--   uuid (a shared link, browser history, a referrer leak) can read the scan
--   until it purges. It is the same exposure the existing invite flow already
--   accepts. If that becomes unacceptable, the fix is a short-lived signed
--   token rather than an RLS policy, since there is still no user to bind to.
--
--   SECURITY DEFINER is required: anon holds no USAGE on the quickscan schema,
--   so the function's own privileges are the only way in. It reads a single
--   row by primary key and returns no other scan's data.
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

    -- A scan past its retention deadline is treated as already gone, whether or
    -- not purge_expired() has physically removed it yet. The purge is not
    -- currently scheduled, so without this check an expired scan would keep
    -- serving PII indefinitely — the deadline would be decorative on the read
    -- path in exactly the way it has been on the delete path.
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
        -- Raw per-tier Phase 1 output, keyed 'fast'/'slow'. Present even when
        -- the user never picked a group, which is what makes an abandoned scan
        -- resumable rather than a dead row.
        'candidate_matches', v_scan.candidate_matches,
        -- The group the user actually selected, in the backend DedupGroup
        -- shape ({ dedup_id, members: [{ summary, match_score }] }). The client
        -- reshapes it; see phase2PayloadToScanGroup in scan-result.ts.
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
        'consolidated_profile', COALESCE(v_enrichment.consolidated_profile, v_scan.profile_data),
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
  'error:"expired"} once purge_after has passed, so the retention deadline is '
  'honoured on read even while purge_expired() remains unscheduled.';

-- Mirrors the grant shape of the pre-existing public.get_quick_scan_profile:
-- reachable from the browser with the publishable key, which is the whole
-- point — the person reading their own pre-auth scan has no session yet.
GRANT EXECUTE ON FUNCTION public.get_pilot_scan_result(UUID) TO anon, authenticated;


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Added: public.get_pilot_scan_result(uuid) -> jsonb  [SECURITY DEFINER]
--
-- Depends on: 20260820120000 (retention defaults — the expired branch above is
--             meaningless if purge_after is NULL) and the Phase 2 writes in
--             supabase/functions/pilot-scan/index.ts, which populate
--             dedup_group_id / enrichment_id / profile_data.
-- ============================================================================
