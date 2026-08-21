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
 * Renders skeleton until the database read completes. On success, displays the
 * stored record (which survives a refresh, new tab, or return visit from an
 * emailed link). On failure (including `expired`, which is a correct answer not
 * a fault), falls back to sessionStorage so a failed write doesn't blank the page.
 * Persistence in this flow is best-effort by design (see supabase/functions/pilot-scan/index.ts).
 */
export function usePilotScanResult(): PilotScanState {
  const [state, setState] = useState<PilotScanState>(() => {
    // Start with skeleton, no data yet — hydrating flag drives the UI
    return {
      result: null,
      error: null,
      enrichment: null,
      consolidatedProfile: null,
      hydrating: true,
      source: "session",
    };
  });

  useEffect(() => {
    const scanId = storedScanId();
    if (!scanId) {
      // No session ID: try fallback and stop hydrating
      const { result, error } = loadScanResult();
      setState({
        result,
        error,
        enrichment: null,
        consolidatedProfile: null,
        hydrating: false,
        source: "session",
      });
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc("get_pilot_scan_result", {
        p_scan_id: scanId,
      });

      if (cancelled) return;

      const payload = data as PilotScanRpcResponse | null;

      // Any failure — RPC error, not_found, expired — falls back to sessionStorage
      // rather than blanking the page. Store the error for the expired case.
      if (error || !payload?.success) {
        if (error) console.warn("Pilot scan read-back failed:", error.message);
        const { result: fallback, error: fallbackError } = loadScanResult();
        setState({
          result: fallback,
          error: fallbackError || payload?.error || null,
          enrichment: null,
          consolidatedProfile: null,
          hydrating: false,
          source: "session",
        });
        return;
      }

      const group = payload.selected_group
        ? storedGroupToScanGroup(payload.selected_group)
        : null;

      // Without a stored group there is nothing better than sessionStorage,
      // but still attach the enrichment from the database read.
      const result: ScanResult | null = group
        ? {
            success: true,
            quick_scan_id: payload.scan_id ?? scanId,
            dedup_groups: [group],
            metadata: undefined,
          }
        : loadScanResult().result;

      setState({
        result,
        error: null,
        enrichment: payload.enrichment ?? null,
        consolidatedProfile: payload.consolidated_profile ?? null,
        hydrating: false,
        source: group ? "database" : "session",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
