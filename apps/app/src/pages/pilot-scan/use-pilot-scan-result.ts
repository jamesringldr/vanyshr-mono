import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadScanResult,
  storedGroupToScanGroup,
  type ScanResult,
  type StoredGroup,
} from "./scan-result";

type PilotScanRpcResponse = {
  success?: boolean;
  error?: string;
  scan_id?: string;
  status?: string;
  selected_group?: StoredGroup | null;
  consolidated_profile?: Record<string, unknown> | null;
  enrichment?: Record<string, unknown> | null;
};

export type PilotScanState = {
  result: ScanResult | null;
  error: string | null;
  /** Phase 2 output — null until enrichment has been stored for this scan. */
  enrichment: Record<string, unknown> | null;
  consolidatedProfile: Record<string, unknown> | null;
  /** True while the database read is still in flight. */
  hydrating: boolean;
  /** Where the currently-rendered data came from. */
  source: "session" | "database";
};

/**
 * Resolve the scan id to read back.
 *
 * `pilotScanResult` is the merged Phase 1 payload the loading screen wrote, and
 * it carries the id both tiers converged on. `pendingScanId` is the invite-flow
 * fallback, which is set before any scan runs.
 */
function storedScanId(): string | null {
  try {
    const raw = sessionStorage.getItem("pilotScanResult");
    if (raw) {
      const parsed = JSON.parse(raw) as ScanResult;
      if (parsed.quick_scan_id) return parsed.quick_scan_id;
    }
    return sessionStorage.getItem("pendingScanId");
  } catch {
    return null;
  }
}

/**
 * Pilot scan results, database-first with a sessionStorage fallback.
 *
 * Renders immediately from sessionStorage so there is no blank frame and no
 * regression when the scan is still in the tab that produced it, then replaces
 * that with the stored record once the read returns. The fallback is what keeps
 * a failed write from turning into an empty results page — persistence in this
 * flow is best-effort by design (see supabase/functions/pilot-scan/index.ts).
 *
 * The database copy wins when both exist: it is the one that survives a
 * refresh, a new tab, or a return visit from an emailed link.
 */
export function usePilotScanResult(): PilotScanState {
  const [state, setState] = useState<PilotScanState>(() => {
    const { result, error } = loadScanResult();
    return {
      result,
      error,
      enrichment: null,
      consolidatedProfile: null,
      hydrating: true,
      source: "session",
    };
  });

  useEffect(() => {
    const scanId = storedScanId();
    if (!scanId) {
      setState((prev) => ({ ...prev, hydrating: false }));
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc("get_pilot_scan_result", {
        p_scan_id: scanId,
      });

      if (cancelled) return;

      const payload = data as PilotScanRpcResponse | null;

      // Any failure — RPC error, not_found, expired — leaves the sessionStorage
      // copy in place rather than blanking the page. `expired` in particular is
      // a correct answer, not a fault: the scan is past its retention deadline.
      if (error || !payload?.success) {
        if (error) console.warn("Pilot scan read-back failed:", error.message);
        setState((prev) => ({ ...prev, hydrating: false }));
        return;
      }

      setState((prev) => {
        const group = payload.selected_group
          ? storedGroupToScanGroup(payload.selected_group)
          : null;

        // Without a stored group there is nothing better than what is already
        // on screen, so keep it and just attach the enrichment.
        const result: ScanResult | null = group
          ? {
              success: true,
              quick_scan_id: payload.scan_id ?? scanId,
              dedup_groups: [group],
              metadata: prev.result?.metadata,
            }
          : prev.result;

        return {
          result,
          error: null,
          enrichment: payload.enrichment ?? null,
          consolidatedProfile: payload.consolidated_profile ?? null,
          hydrating: false,
          source: group ? "database" : prev.source,
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
