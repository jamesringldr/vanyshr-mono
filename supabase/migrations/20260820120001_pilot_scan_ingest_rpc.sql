-- ============================================================================
-- Migration: 20260820120001_pilot_scan_ingest_rpc.sql
-- ============================================================================
-- Description: The Phase 1 ingest entry point — one atomic statement that
--              creates-or-joins the scan row and folds a tier's results in.
--
-- Why an RPC instead of doing this in the edge function:
--   The client fires the fast (Zaba) and slow (FPS/NPD/AnyWho) tiers as two
--   concurrent invocations sharing one sessionId. Both need to (a) land on a
--   single quick_scans row and (b) merge their own results into the same
--   candidate_matches JSONB without overwriting the other's.
--
--   Doing that from TypeScript means SELECT-then-UPDATE — two round trips with
--   a window between them. Two tiers finishing close together interleave and
--   one tier's results are silently lost. Postgres can express the whole thing
--   as a single INSERT ... ON CONFLICT DO UPDATE, which is atomic per row.
--
--   Lives in `quickscan`, not `public`, precisely because anon/authenticated
--   hold no USAGE on that schema (20260819120000 §1) — the function is
--   unreachable from PostgREST and callable only by service_role, which is the
--   only thing that should ever be writing pre-auth PII.
-- ============================================================================


CREATE OR REPLACE FUNCTION quickscan.record_phase1_tier(
    p_session_id   TEXT,
    p_search_input JSONB,
    p_tier         TEXT,
    p_groups       JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'quickscan', 'public'
AS $function$
DECLARE
    v_scan_id UUID;
BEGIN
    -- ON CONFLICT needs quick_scans_session_id_key (20260820120000 §1) as its
    -- arbiter. Whichever tier arrives first inserts; the second takes the
    -- DO UPDATE branch and both RETURNING clauses yield the same id.
    INSERT INTO quickscan.quick_scans AS qs (
        session_id,
        search_input,
        status,
        candidate_matches,
        data_sources
    )
    VALUES (
        p_session_id,
        p_search_input,
        'scanning',
        jsonb_build_object(p_tier, p_groups),
        ARRAY[p_tier]
    )
    ON CONFLICT (session_id) DO UPDATE
    SET
        -- Concatenation, not assignment: the losing tier must not erase the
        -- winner's key. Keyed by tier name so the two never collide.
        candidate_matches = COALESCE(qs.candidate_matches, '{}'::jsonb)
                            || jsonb_build_object(p_tier, p_groups),

        -- Keep whichever search_input arrived first; both tiers send the same
        -- one, and preserving the original avoids a pointless rewrite.
        search_input      = COALESCE(qs.search_input, EXCLUDED.search_input),

        data_sources      = (
            SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(qs.data_sources, '{}') || p_tier))
        ),

        -- A tier landing after the user already picked (Phase 2 sets
        -- 'completed') must not drag the scan backwards into 'scanning'.
        status            = CASE
                              WHEN qs.status IN ('completed', 'failed', 'expired')
                                THEN qs.status
                              ELSE 'scanning'
                            END,
        updated_at        = now()
    RETURNING qs.id INTO v_scan_id;

    RETURN v_scan_id;
END;
$function$;


COMMENT ON FUNCTION quickscan.record_phase1_tier(TEXT, JSONB, TEXT, JSONB) IS
  'Phase 1 ingest. Creates-or-joins the quick_scans row for a session and '
  'merges one tier''s dedup groups into candidate_matches, atomically. Called '
  'once per tier (fast/slow) by the pilot-scan edge function; returns the '
  'scan UUID both tiers share. service_role only — anon has no USAGE on this '
  'schema.';


-- purge_after is intentionally left to the column default (now() + 7 days,
-- set in 20260820120000 §2) rather than passed in. One place defines the
-- retention window; callers cannot accidentally widen it.


-- ============================================================================
-- Migration complete
-- ============================================================================
-- Added: quickscan.record_phase1_tier(text, jsonb, text, jsonb) -> uuid
--
-- Depends on: 20260820120000 (UNIQUE constraint on session_id is the
--             ON CONFLICT arbiter — this function cannot be created usefully
--             without it).
-- ============================================================================
