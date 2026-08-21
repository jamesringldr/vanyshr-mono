/**
 * Holehe Enricher — which online services an email address is registered with.
 *
 * The previous version of this module called https://api.holehe.io, a
 * hostname that does not resolve — account enrichment never worked. Holehe
 * (github.com/megadose/holehe) is a CLI, not a hosted API, and Deno edge
 * functions cannot shell out to a Python subprocess. It now runs as a small
 * FastAPI service on serv02 (Docker, Tailscale Funnel for public reach —
 * see workers/holehe/ in vanyshr-scraper-sequence for the source this was
 * built from, and holehe_allowlist.py there for the high-value allowlist:
 * Vanyshr checks ~37 recognizable consumer sites, not holehe's full 121).
 *
 * Enable with Supabase secrets HOLEHE_SERVICE_URL + HOLEHE_SERVICE_TOKEN.
 */

function serviceEnabled(): boolean {
  return Boolean(Deno.env.get("HOLEHE_SERVICE_URL") && Deno.env.get("HOLEHE_SERVICE_TOKEN"));
}

interface HoleheServiceResponse {
  status: "success" | "invalid_email" | "timeout" | "error";
  services_found?: string[];
  services_checked?: number;
  services_rate_limited?: number;
  error?: string;
}

export type HoleheStatus = "success" | "invalid_email" | "unavailable" | "timeout" | "error";

/**
 * Holehe enrichment result
 */
export interface HoleheResult {
  success: boolean;
  email: string;
  status: HoleheStatus;
  services: string[];
  count: number;
  /**
   * How many services the API returned a verdict for — found or not. Needed to
   * tell "we checked and you are clean" apart from "we could not check", which
   * an empty `services` array alone cannot express. 0 when the call failed.
   */
  services_checked: number;
  timing_ms: number;
  error?: string;
}

function holeheResult(email: string, status: HoleheStatus, timingMs: number, extra: Partial<HoleheResult> = {}): HoleheResult {
  return {
    success: status === "success",
    email,
    status,
    services: [],
    count: 0,
    services_checked: 0,
    timing_ms: timingMs,
    ...extra,
  };
}

/**
 * Enrich email with Holehe to find online services
 * @param email Email address to check
 * @param timeout Request timeout in milliseconds — the service call itself
 *   runs the CLI and can take tens of seconds; budget accordingly.
 * @returns Holehe enrichment result
 */
export async function enrichWithHolehe(email: string, timeout: number = 90000): Promise<HoleheResult> {
  const startTime = Date.now();
  const normalized = (email || "").trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return holeheResult(normalized, "invalid_email", Date.now() - startTime, { error: "Invalid email format" });
  }

  if (!serviceEnabled()) {
    return holeheResult(normalized, "unavailable", Date.now() - startTime, {
      error: "HOLEHE_SERVICE_URL / HOLEHE_SERVICE_TOKEN not configured",
    });
  }

  const base = (Deno.env.get("HOLEHE_SERVICE_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("HOLEHE_SERVICE_TOKEN") ?? "";

  try {
    const response = await fetch(`${base}/v1/holehe/check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalized }),
      signal: AbortSignal.timeout(timeout),
    });

    const timingMs = Date.now() - startTime;

    if (!response.ok) {
      return holeheResult(normalized, "error", timingMs, { error: `Holehe service HTTP ${response.status}` });
    }

    const data = await response.json() as HoleheServiceResponse;

    if (data.status !== "success") {
      const status: HoleheStatus = data.status === "invalid_email" || data.status === "timeout" ? data.status : "error";
      return holeheResult(normalized, status, timingMs, { error: data.error || data.status });
    }

    const services = data.services_found ?? [];
    return holeheResult(normalized, "success", timingMs, {
      services,
      count: services.length,
      services_checked: data.services_checked ?? 0,
    });
  } catch (error) {
    const timingMs = Date.now() - startTime;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return holeheResult(normalized, timedOut ? "timeout" : "error", timingMs, {
      error: timedOut ? "Holehe service timeout" : (error as Error).message,
    });
  }
}

/**
 * Enrich multiple emails with Holehe
 * @param emails Array of email addresses
 * @param timeout Per-email timeout
 * @returns Array of results (in parallel, up to 3 at a time)
 */
export async function enrichMultipleEmails(emails: string[], timeout: number = 90000): Promise<HoleheResult[]> {
  const results: HoleheResult[] = [];

  // Process in batches of 3 — each call runs a real subprocess on serv02, so
  // this stays gentler on that box than firing every email at once.
  for (let i = 0; i < emails.length; i += 3) {
    const batch = emails.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map((email) => enrichWithHolehe(email, timeout)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Deduplicate services from multiple enrichment results
 * @param results Array of enrichment results
 * @returns Deduplicated, sorted service names
 */
export function deduplicateServices(results: HoleheResult[]): string[] {
  const serviceSet = new Set<string>();

  for (const result of results) {
    if (result.success) {
      for (const service of result.services) {
        serviceSet.add(service);
      }
    }
  }

  return Array.from(serviceSet).sort();
}

/**
 * Aggregate Holehe results for all emails
 * @param results Array of enrichment results
 * @returns Aggregated result
 */
export function aggregateHoleheResults(results: HoleheResult[]) {
  const totalTiming = results.reduce((sum, r) => sum + r.timing_ms, 0);
  const successCount = results.filter((r) => r.success).length;
  const allServices = deduplicateServices(results);

  return {
    success: successCount > 0,
    emails_checked: results.length,
    emails_with_services: successCount,
    total_unique_services: allServices.length,
    services: allServices,
    total_timing_ms: totalTiming,
    average_timing_ms: results.length ? Math.round(totalTiming / results.length) : 0,
  };
}
