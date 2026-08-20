/**
 * Holehe Enricher
 * Enriches email addresses with online services using Holehe API
 *
 * Holehe checks 123+ online services (GitHub, LinkedIn, Twitter, etc.)
 * to find where an email is registered.
 *
 * No API key required, generous rate limits.
 */

/**
 * Holehe API response structure
 */
interface HoleheResponse {
  email: string;
  exists: boolean;
  services: Record<string, boolean | { username?: string; url?: string }>;
}

/**
 * Services we prioritize (most relevant for identity lookup)
 */
const PRIORITY_SERVICES = [
  "github",
  "linkedin",
  "twitter",
  "facebook",
  "reddit",
  "instagram",
  "stackoverflow",
  "medium",
  "lastfm",
  "patreon",
  "spotify",
  "disqus",
  "gravatar",
  "wordpress",
  "adobe",
  "pinterest",
  "dropbox",
  "evernote",
  "flickr",
  "tumblr",
  "quora",
  "telegram",
  "whatsapp",
  "signal",
  "viber",
];

/**
 * Holehe enrichment result
 */
export interface HoleheResult {
  success: boolean;
  email: string;
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

/**
 * Enrich email with Holehe to find online services
 * @param email Email address to enrich
 * @param timeout Request timeout in milliseconds
 * @returns Holehe enrichment result
 */
export async function enrichWithHolehe(email: string, timeout: number = 30000): Promise<HoleheResult> {
  const startTime = Date.now();

  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return {
        success: false,
        email: email,
        services: [],
        count: 0,
        services_checked: 0,
        timing_ms: Date.now() - startTime,
        error: "Invalid email format",
      };
    }

    console.log(`🔍 Enriching ${email} with Holehe...`);

    // Call Holehe API
    const response = await callHoleheAPI(email, timeout);

    if (!response) {
      return {
        success: false,
        email: email,
        services: [],
        count: 0,
        services_checked: 0,
        timing_ms: Date.now() - startTime,
        error: "No response from Holehe API",
      };
    }

    // Extract services from response
    const services = extractServices(response);

    console.log(`✓ Holehe found ${services.length} services for ${email}`);

    return {
      success: true,
      email: email,
      services: services,
      count: services.length,
      // Every key the API answered for, not just the hits.
      services_checked: countCheckedServices(response),
      timing_ms: Date.now() - startTime,
    };
  } catch (error) {
    const timingMs = Date.now() - startTime;
    const errorMsg = (error as Error).message;

    console.error(`✗ Holehe enrichment failed for ${email}:`, errorMsg);

    return {
      success: false,
      email: email,
      services: [],
      count: 0,
      services_checked: 0,
      timing_ms: timingMs,
      error: errorMsg,
    };
  }
}

/**
 * Call Holehe API
 * Uses hosted Holehe CLI at https://api.holehe.io/v1/email
 *
 * @param email Email to check
 * @param timeout Request timeout
 * @returns Holehe response or null on error
 */
async function callHoleheAPI(email: string, timeout: number): Promise<HoleheResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`https://api.holehe.io/v1/email?email=${encodeURIComponent(email)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Vanyshr-QuickScan/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Holehe API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as HoleheResponse;
    return data;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Holehe API timeout");
    }
    throw error;
  }
}

/**
 * Count the services the API actually returned a verdict for.
 *
 * extractServices() keeps only the hits, which loses the denominator. Without
 * it, zero services found is indistinguishable from zero services checked --
 * and reporting "no exposed accounts" when nothing was checked is the worst
 * available failure direction.
 */
function countCheckedServices(response: HoleheResponse): number {
  if (!response.services || typeof response.services !== "object") return 0;
  return Object.keys(response.services).length;
}

/**
 * Extract services from Holehe response
 * Returns services in priority order (most relevant first)
 *
 * @param response Holehe API response
 * @returns Array of service names
 */
function extractServices(response: HoleheResponse): string[] {
  const services: string[] = [];

  if (!response.services || typeof response.services !== "object") {
    return services;
  }

  // First, collect all services that exist (true or object with details)
  const foundServices: string[] = [];

  for (const [service, value] of Object.entries(response.services)) {
    if (value === true || (typeof value === "object" && value !== null)) {
      foundServices.push(service);
    }
  }

  // Sort by priority (priority services first, then alphabetical)
  foundServices.sort((a, b) => {
    const aPriority = PRIORITY_SERVICES.indexOf(a.toLowerCase());
    const bPriority = PRIORITY_SERVICES.indexOf(b.toLowerCase());

    // If both are in priority list, sort by priority index
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }

    // If only one is in priority list, it comes first
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    // Otherwise, sort alphabetically
    return a.localeCompare(b);
  });

  return foundServices;
}

/**
 * Enrich multiple emails with Holehe
 * @param emails Array of email addresses
 * @param timeout Per-email timeout
 * @returns Array of results (in parallel, up to 3 at a time)
 */
export async function enrichMultipleEmails(emails: string[], timeout: number = 30000): Promise<HoleheResult[]> {
  const results: HoleheResult[] = [];

  // Process in batches of 3 to avoid overwhelming the API
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

  // Sort by priority
  const services = Array.from(serviceSet);
  services.sort((a, b) => {
    const aPriority = PRIORITY_SERVICES.indexOf(a.toLowerCase());
    const bPriority = PRIORITY_SERVICES.indexOf(b.toLowerCase());

    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.localeCompare(b);
  });

  return services;
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
    emails_found_services: successCount,
    total_services: allServices.length,
    // Summed across emails, so it is a coverage signal rather than a distinct
    // service count -- read it as "verdicts received", not "unique services".
    services_checked: results.reduce((sum, r) => sum + r.services_checked, 0),
    services: allServices,
    total_timing_ms: totalTiming,
    average_timing_ms: Math.round(totalTiming / results.length),
  };
}
