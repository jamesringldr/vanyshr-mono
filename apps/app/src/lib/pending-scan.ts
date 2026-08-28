/**
 * Scan id handoff between the pre-auth pilot-scan funnel and /signup.
 *
 * The intro-scan writes `pendingScanId` when the scan starts. The loading
 * screen may also stash `pilotScanResult.quick_scan_id` after both Phase 1
 * tiers converge. Signup historically only read `pendingScanId`, so a
 * refresh or a CTA that skipped that key dead-ended the funnel.
 */

function fromPilotResult(): string | null {
  try {
    const raw = sessionStorage.getItem("pilotScanResult");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { quick_scan_id?: string | null };
    return parsed.quick_scan_id || null;
  } catch {
    return null;
  }
}

/** Persist the scan id signup needs, preferring the live pilot-scan result. */
export function stashPendingScanId(explicit?: string | null): string | null {
  const id =
    explicit ||
    fromPilotResult() ||
    sessionStorage.getItem("pendingScanId");
  if (id) sessionStorage.setItem("pendingScanId", id);
  return id;
}

/** Resolve the scan id for /signup, including `?scanId=` from the URL. */
export function resolvePendingScanId(search: string = window.location.search): string | null {
  const fromQuery = new URLSearchParams(search).get("scanId");
  return stashPendingScanId(fromQuery);
}

export function hasPilotScanSession(): boolean {
  try {
    return Boolean(
      sessionStorage.getItem("pilotScanResult") ||
        sessionStorage.getItem("pilotScanFields"),
    );
  } catch {
    return false;
  }
}

/** /signup with the scan id in the query so a refresh still has it. */
export function signupPath(): string {
  const id = stashPendingScanId();
  return id ? `/signup?scanId=${encodeURIComponent(id)}` : "/signup";
}
