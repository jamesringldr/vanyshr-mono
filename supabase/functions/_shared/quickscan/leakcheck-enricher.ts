/**
 * Leakcheck Enricher — breach exposure for an email address.
 *
 * Ported from the real, working implementation in vanyshr-scraper-sequence/
 * leakcheck_enricher.py (that repo is an out-of-sync sandbox no longer in
 * active use — porting its proven logic here, not calling out to it).
 *
 * The previous version of this module targeted Hudson Rock's API
 * (api.hudsonrock.com) and was never real — this hits Leakcheck's actual
 * free public endpoint instead, which needs no API key:
 *
 *     https://leakcheck.io/api/public?check=<email>
 *
 * It returns which breaches an address appears in, when, and which *types*
 * of field leaked — never the leaked values themselves.
 *
 * Four behaviours this endpoint has, each handled explicitly below (see
 * leakcheck_enricher.py's docstring in vanyshr-scraper-sequence for the
 * original investigation):
 *   - HTTP status is always 200, including for misses and rate limiting, so
 *     the body decides, not the status code
 *   - the rate-limit body is not valid JSON — it uses Python's `False`
 *     instead of `false`; repair the literals before parsing
 *   - a browser-like User-Agent is required or Cloudflare returns 403
 *   - invalid addresses return the same body as genuine misses (screened
 *     before the request, so they don't read as one)
 *
 * The quota is roughly ten calls per window — enrichMultipleEmails paces
 * calls ~7s apart rather than firing them in parallel, and stops early once
 * rate limited (continuing would just mask which addresses were genuinely
 * checked).
 */

const API_URL = "https://leakcheck.io/api/public";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_BATCH_DELAY_MS = 7000;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface LeakcheckApiResponse {
  success?: boolean;
  found?: number;
  fields?: unknown;
  sources?: unknown;
  error?: string;
}

/**
 * A single breach source. `name` kept as the field name for compatibility
 * with existing callers (old pipeline's profile-consolidator.ts) — it's the
 * source name, not a breach title.
 */
export interface BreachRecord {
  name: string;
  date?: string;
  year?: string;
}

export type LeakcheckStatus = "success" | "not_found" | "invalid_email" | "rate_limited" | "timeout" | "error";

export interface LeakcheckResult {
  success: boolean;
  email: string;
  status: LeakcheckStatus;
  breaches: BreachRecord[];
  breach_count: number;
  fields_exposed: string[];
  timing_ms: number;
  error?: string;
}

function result(email: string, status: LeakcheckStatus, timingMs: number, extra: Partial<LeakcheckResult> = {}): LeakcheckResult {
  return {
    success: status === "success",
    email,
    status,
    breaches: [],
    breach_count: 0,
    fields_exposed: [],
    timing_ms: timingMs,
    ...extra,
  };
}

/** Tolerate the rate-limit reply's invalid JSON (Python's True/False/None literals). */
function looseParse(body: string): LeakcheckApiResponse | null {
  try {
    return JSON.parse(body);
  } catch {
    /* fall through to repair */
  }
  const repaired = body.replace(/\bFalse\b/g, "false").replace(/\bTrue\b/g, "true").replace(/\bNone\b/g, "null");
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function isRateLimited(data: LeakcheckApiResponse | null, body: string): boolean {
  const haystack = `${data?.error ?? ""} ${body}`.toLowerCase();
  return haystack.includes("ratelimit") || haystack.includes("too many requests");
}

function parseSources(sources: unknown): BreachRecord[] {
  if (!Array.isArray(sources)) return [];
  const seen = new Set<string>();
  const breaches: BreachRecord[] = [];
  for (const entry of sources) {
    if (!entry || typeof entry !== "object") continue;
    const name = String((entry as Record<string, unknown>).name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const date = String((entry as Record<string, unknown>).date ?? "").trim();
    const year = /^\d{4}/.test(date) ? date.slice(0, 4) : "";
    breaches.push({ name, date, year });
  }
  // Most recent first — an old breach matters less than a recent one.
  return breaches.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export async function enrichWithLeakcheck(email: string, _apiKey?: string, timeout = 30000): Promise<LeakcheckResult> {
  const started = Date.now();
  const normalized = (email || "").trim().toLowerCase();

  // Invalid addresses return the same body as a genuine miss, so screen here
  // to keep the two distinguishable downstream.
  if (!EMAIL_RE.test(normalized)) {
    return result(normalized, "invalid_email", Date.now() - started, { error: "Invalid email address" });
  }

  let body: string;
  try {
    const url = new URL(API_URL);
    url.searchParams.set("check", normalized);
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeout),
    });
    body = await res.text();
  } catch (err) {
    const timingMs = Date.now() - started;
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return result(normalized, "timeout", timingMs, { error: "Request timed out" });
    }
    return result(normalized, "error", timingMs, { error: (err as Error).message });
  }

  const timingMs = Date.now() - started;
  const data = looseParse(body);

  if (isRateLimited(data, body)) {
    return result(normalized, "rate_limited", timingMs, { error: "Rate limited" });
  }
  if (data === null) {
    return result(normalized, "error", timingMs, { error: "Unparseable response" });
  }
  if (!data.success) {
    return result(normalized, "not_found", timingMs);
  }

  const breaches = parseSources(data.sources);
  const fields = Array.isArray(data.fields) ? data.fields.filter((f): f is string => typeof f === "string") : [];

  return result(normalized, "success", timingMs, {
    breaches,
    // Trust the reported count over breaches.length — they can differ when
    // the API withholds some source names.
    breach_count: typeof data.found === "number" ? data.found : breaches.length,
    fields_exposed: [...new Set(fields)].sort(),
  });
}

/**
 * Look up several addresses, pacing calls to stay inside the quota.
 * Sequential, not parallel — firing this in parallel batches (the old
 * behaviour) trips the rate limit almost immediately. Stops early once
 * rate limited, matching leakcheck_enricher.py.
 */
export async function enrichMultipleEmails(
  emails: string[],
  apiKey?: string,
  timeout = 30000,
  delayMs = DEFAULT_BATCH_DELAY_MS,
): Promise<LeakcheckResult[]> {
  const results: LeakcheckResult[] = [];

  for (let i = 0; i < emails.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const r = await enrichWithLeakcheck(emails[i], apiKey, timeout);
    results.push(r);
    if (r.status === "rate_limited") {
      console.warn(`Leakcheck rate limited after ${i} of ${emails.length} addresses; stopping`);
      break;
    }
  }

  return results;
}

export function deduplicateBreaches(results: LeakcheckResult[]): BreachRecord[] {
  const seen = new Map<string, BreachRecord>();
  for (const r of results) {
    if (!r.success) continue;
    for (const breach of r.breaches) {
      const key = `${breach.name}|${breach.date || ""}`;
      if (!seen.has(key)) seen.set(key, breach);
    }
  }
  return [...seen.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function aggregateLeakcheckResults(results: LeakcheckResult[]) {
  const totalTiming = results.reduce((sum, r) => sum + r.timing_ms, 0);
  const successCount = results.filter((r) => r.success).length;
  const allBreaches = deduplicateBreaches(results);
  const totalBreaches = results.reduce((sum, r) => sum + r.breach_count, 0);

  return {
    success: successCount > 0,
    emails_checked: results.length,
    emails_with_breaches: successCount,
    total_unique_breaches: allBreaches.length,
    total_breach_records: totalBreaches,
    breaches: allBreaches,
    total_timing_ms: totalTiming,
    average_timing_ms: results.length ? Math.round(totalTiming / results.length) : 0,
  };
}
