/**
 * Leakcheck Enricher
 * Enriches email addresses with data breach information using Leakcheck API
 *
 * Leakcheck (powered by Hudson Rock) provides breach databases with:
 * - 200+ breaches per email (superior to HIBP)
 * - No authentication required for basic searches
 * - Generous rate limits (100+ requests/minute)
 *
 * Endpoint: https://api.hudsonrock.com/json/v3/search-by-login-emails
 */

/**
 * Leakcheck API response structure
 */
interface LeakcheckResponse {
  success: boolean;
  total: number;
  message?: string;
  data?: Array<{
    name: string;
    source?: string;
    date?: string;
    url?: string;
    description?: string;
  }>;
}

/**
 * Breach record
 */
export interface BreachRecord {
  name: string;
  date?: string;
  exposures?: number;
  url?: string;
  source?: string;
}

/**
 * Leakcheck enrichment result
 */
export interface LeakcheckResult {
  success: boolean;
  email: string;
  breaches: BreachRecord[];
  breach_count: number;
  timing_ms: number;
  requires_auth?: boolean;
  error?: string;
}

/**
 * Enrich email with Leakcheck to find data breaches
 * @param email Email address to check
 * @param apiKey Optional Leakcheck API key (for authenticated requests)
 * @param timeout Request timeout in milliseconds
 * @returns Leakcheck enrichment result
 */
export async function enrichWithLeakcheck(
  email: string,
  apiKey?: string,
  timeout: number = 30000
): Promise<LeakcheckResult> {
  const startTime = Date.now();

  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return {
        success: false,
        email: email,
        breaches: [],
        breach_count: 0,
        timing_ms: Date.now() - startTime,
        error: "Invalid email format",
      };
    }

    console.log(`🔍 Checking ${email} with Leakcheck...`);

    // Call Leakcheck API
    const response = await callLeakcheckAPI(email, apiKey, timeout);

    if (!response) {
      return {
        success: false,
        email: email,
        breaches: [],
        breach_count: 0,
        timing_ms: Date.now() - startTime,
        error: "No response from Leakcheck API",
      };
    }

    // Extract breaches from response
    const breaches = extractBreaches(response);

    console.log(`✓ Leakcheck found ${breaches.length} breaches for ${email}`);

    return {
      success: true,
      email: email,
      breaches: breaches,
      breach_count: breaches.length,
      timing_ms: Date.now() - startTime,
    };
  } catch (error) {
    const timingMs = Date.now() - startTime;
    const errorMsg = (error as Error).message;

    console.error(`✗ Leakcheck enrichment failed for ${email}:`, errorMsg);

    // Check if error is due to missing API key
    const requiresAuth = errorMsg.includes("API key") || errorMsg.includes("authentication");

    return {
      success: false,
      email: email,
      breaches: [],
      breach_count: 0,
      timing_ms: timingMs,
      requires_auth: requiresAuth,
      error: errorMsg,
    };
  }
}

/**
 * Call Leakcheck API
 * Uses Hudson Rock's free API endpoint
 * https://api.hudsonrock.com/json/v3/search-by-login-emails
 *
 * @param email Email to check
 * @param apiKey Optional API key for authenticated requests
 * @param timeout Request timeout
 * @returns Leakcheck response or null on error
 */
async function callLeakcheckAPI(email: string, apiKey?: string, timeout: number = 30000): Promise<LeakcheckResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const url = new URL("https://api.hudsonrock.com/json/v3/search-by-login-emails");
    url.searchParams.set("email", email);

    const headers: Record<string, string> = {
      "User-Agent": "Vanyshr-QuickScan/1.0",
      "Content-Type": "application/json",
    };

    // Add API key if provided
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Leakcheck API authentication failed - invalid API key");
      }
      console.error(`Leakcheck API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as LeakcheckResponse;
    return data;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Leakcheck API timeout");
    }
    throw error;
  }
}

/**
 * Extract breaches from Leakcheck response
 * @param response Leakcheck API response
 * @returns Array of breach records
 */
function extractBreaches(response: LeakcheckResponse): BreachRecord[] {
  const breaches: BreachRecord[] = [];

  if (!response.success || !response.data || !Array.isArray(response.data)) {
    return breaches;
  }

  for (const breach of response.data) {
    breaches.push({
      name: breach.name,
      date: breach.date,
      source: breach.source,
      url: breach.url,
    });
  }

  // Sort by name (most recent first if dates available)
  breaches.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  return breaches;
}

/**
 * Enrich multiple emails with Leakcheck
 * @param emails Array of email addresses
 * @param apiKey Optional API key
 * @param timeout Per-email timeout
 * @returns Array of results (in parallel, up to 3 at a time)
 */
export async function enrichMultipleEmails(
  emails: string[],
  apiKey?: string,
  timeout: number = 30000
): Promise<LeakcheckResult[]> {
  const results: LeakcheckResult[] = [];

  // Process in batches of 3 to avoid overwhelming the API
  for (let i = 0; i < emails.length; i += 3) {
    const batch = emails.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map((email) => enrichWithLeakcheck(email, apiKey, timeout)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Deduplicate breaches from multiple results
 * @param results Array of enrichment results
 * @returns Deduplicated breaches sorted by date
 */
export function deduplicateBreaches(results: LeakcheckResult[]): BreachRecord[] {
  const breachMap = new Map<string, BreachRecord>();

  for (const result of results) {
    if (result.success) {
      for (const breach of result.breaches) {
        const key = `${breach.name}|${breach.date || ""}`;
        if (!breachMap.has(key)) {
          breachMap.set(key, breach);
        }
      }
    }
  }

  // Convert to array and sort
  const breaches = Array.from(breachMap.values());
  breaches.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  return breaches;
}

/**
 * Aggregate Leakcheck results for all emails
 * @param results Array of enrichment results
 * @returns Aggregated result
 */
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
    average_timing_ms: Math.round(totalTiming / results.length),
  };
}
