/**
 * Phase 2 Orchestrator
 * Full profile enrichment with email extraction, Holehe, Leakcheck, and consolidation
 *
 * Orchestrates the following flow:
 * 1. Load dedup group from database
 * 2. Extract emails from profiles
 * 3. Enrich with Holehe (online services) and Leakcheck (breaches) in parallel
 * 4. Consolidate all data into unified profile
 * 5. Store results in database
 */

import {
  ConsolidatedProfile,
  DedupGroup,
  QuickScanInput,
  Phase2Result,
  BreachRecord,
} from "./quickscan-phase1-phase2-models.ts";
import { extractEmailsFromBrokers } from "./email-extractor.ts";
import { enrichMultipleEmails as enrichEmailsWithHolehe, aggregateHoleheResults } from "./holehe-enricher.ts";
import {
  enrichMultipleEmails as enrichEmailsWithLeakcheck,
  aggregateLeakcheckResults,
} from "./leakcheck-enricher.ts";
import { consolidateProfiles, addEnrichmentData } from "./profile-consolidator.ts";
import { scrapeBrokerDetails } from "./detail-scrapers.ts";

/**
 * Phase 2 enrichment result
 */
export interface Phase2EnrichmentResult {
  success: boolean;
  consolidated_profile?: ConsolidatedProfile;
  enrichment_data?: {
    holehe_services: string[];
    leakcheck_breaches: BreachRecord[];
    /**
     * Verdicts Holehe returned, summed across the emails checked. Distinguishes
     * "checked, nothing found" from "never checked" -- an empty
     * holehe_services means nothing on its own.
     */
    holehe_services_checked: number;
    /**
     * Constrained to quickscan_enrichment_leakcheck_status_check:
     * pending | success | failed | no_auth | timeout. Notably NOT 'no_results'.
     */
    leakcheck_status: string;
  };
  metadata?: {
    total_phase2_ms: number;
    detail_scrape_ms?: number;
    email_extract_ms: number;
    holehe_ms: number;
    leakcheck_ms: number;
    consolidate_ms: number;
    emails_found: number;
    services_found: number;
    breaches_found: number;
    phase2_cost_usd: number;
  };
  error?: string;
}

/**
 * Phase 2 orchestrator
 */
/**
 * Map a Phase 2 result onto quickscan_enrichment.holehe_status.
 *
 * The three outcomes are genuinely different and must not collapse:
 *   success      -- accounts were found
 *   no_results   -- services WERE checked and none matched (a real "you're clean")
 *   unavailable  -- nothing was checked; we know nothing either way
 *
 * Collapsing the last two into "no accounts found" tells a user they are clean
 * when we never looked, which is the worst direction to be wrong in.
 * Constrained to quickscan_enrichment_holehe_status_check.
 */
function holeheStatus(result: Phase2EnrichmentResult): string {
  const found = result.enrichment_data?.holehe_services.length ?? 0;
  const checked = result.enrichment_data?.holehe_services_checked ?? 0;
  if (found > 0) return "success";
  if (checked > 0) return "no_results";
  return "unavailable";
}

/**
 * Which categories of PII the consolidated profile actually turned up, for
 * quickscan_enrichment.fields_exposed.
 *
 * A category is listed only when it has at least one value, so the array
 * doubles as the "what did we find on you" summary the risk report renders.
 */
function exposedFields(profile?: ConsolidatedProfile): string[] {
  if (!profile) return [];
  const fields: string[] = [];
  if (profile.full_name) fields.push("name");
  if (profile.age != null) fields.push("age");
  if (profile.primary_address) fields.push("address");
  if (profile.previous_addresses?.length) fields.push("previous_addresses");
  if (profile.phone_numbers?.length) fields.push("phone");
  if (profile.emails?.length) fields.push("email");
  if (profile.relatives?.length) fields.push("relatives");
  if (profile.associates?.length) fields.push("associates");
  if (profile.properties?.length) fields.push("property");
  if (profile.services_found?.length) fields.push("online_accounts");
  if (profile.breaches?.length) fields.push("breaches");
  return fields;
}

export class Phase2Orchestrator {
  /**
   * Run Phase 2: Full profile enrichment
   * @param dedupGroup Dedup group from Phase 1 — each member's summary.profile_url
   *   is the broker detail page this step scrapes for the real full profile.
   * @param options Enrichment options
   * @returns Phase2EnrichmentResult with consolidated profile
   */
  async runPhase2(
    dedupGroup: DedupGroup,
    options: Phase2Options = {}
  ): Promise<Phase2EnrichmentResult> {
    const startTime = Date.now();
    const { timeout = 60000, includeLeakcheck = true, detailTimeoutMs = 20000 } = options;

    console.log(`🔍 Phase 2 starting for ${dedupGroup.members[0]?.summary.full_name || "unknown"}...`);

    try {
      // Step 0: Scrape each broker's detail page (profile_url) — this is the
      // actual "full profile" fetch. Each broker gets its own detailTimeoutMs;
      // a slow/blocked one falls back to its Phase 1 summary data instead of
      // blocking the rest.
      const detailStartTime = Date.now();
      console.log(`🔎 Step 0: Scraping ${dedupGroup.members.length} broker detail page(s)...`);
      // scrapeBrokerDetails() now also returns per-broker timings (added for
      // quickscan.scan_timings) -- this orchestrator already times the whole
      // batch itself, so only the profiles are needed here.
      const { profiles: rawProfiles } = await scrapeBrokerDetails(dedupGroup.members, detailTimeoutMs);
      const detailMs = Date.now() - detailStartTime;
      console.log(`✓ Detail scrape done in ${detailMs}ms: ${Object.keys(rawProfiles).join(", ")}`);

      // Step 1: Extract emails
      const emailStartTime = Date.now();
      console.log("📧 Step 1: Extracting emails from profiles...");
      const emailResult = extractEmailsFromBrokers(rawProfiles);
      const emailMs = Date.now() - emailStartTime;

      if (!emailResult.success) {
        console.warn(`⚠️  Email extraction failed: ${emailResult.error}`);
      } else {
        console.log(`✓ Extracted ${emailResult.count} emails`);
      }

      // Step 2: Enrich with Holehe and Leakcheck in parallel
      const enrichStartTime = Date.now();
      let holeheServices: string[] = [];
      let holeheServicesChecked = 0;
      let leakcheckBreaches: BreachRecord[] = [];
      // 'pending' == never ran, which is also the column default.
      let leakcheckStatus = "pending";
      let holeheMs = 0;
      let leakcheckMs = 0;

      const enrichmentPromises: Promise<void>[] = [];

      // Holehe enrichment (always enabled)
      enrichmentPromises.push(
        (async () => {
          try {
            console.log("🌐 Step 2a: Enriching with Holehe (online services)...");
            const holeheStart = Date.now();

            if (emailResult.emails.length > 0) {
              const results = await enrichEmailsWithHolehe(emailResult.emails, 30000);
              const aggregated = aggregateHoleheResults(results);

              // Recorded whether or not the aggregate succeeded: a partial
              // failure still checked some services, and that coverage is
              // exactly what the caller needs to interpret an empty result.
              holeheServicesChecked = aggregated.services_checked;

              if (aggregated.success) {
                holeheServices = aggregated.services;
                console.log(`✓ Holehe found ${aggregated.total_services} of ${aggregated.services_checked} checked`);
              } else {
                console.warn(`⚠️  Holehe enrichment partially failed`);
              }
            } else {
              console.log("⚠️  No emails to enrich with Holehe");
            }

            holeheMs = Date.now() - holeheStart;
          } catch (error) {
            console.error(`✗ Holehe enrichment error: ${(error as Error).message}`);
            holeheMs = Date.now() - enrichStartTime;
          }
        })()
      );

      // Leakcheck enrichment (optional)
      if (includeLeakcheck) {
        enrichmentPromises.push(
          (async () => {
            try {
              console.log("🔴 Step 2b: Enriching with Leakcheck (data breaches)...");
              const leakcheckStart = Date.now();
              const apiKey = Deno.env.get("LEAKCHECK_API_KEY");

              if (emailResult.emails.length > 0) {
                const results = await enrichEmailsWithLeakcheck(emailResult.emails, apiKey, 30000);
                const aggregated = aggregateLeakcheckResults(results);

                if (aggregated.success) {
                  leakcheckBreaches = aggregated.breaches;
                  // 'success' means the CHECK ran, not that breaches exist.
                  // Zero breaches is a successful clean result.
                  leakcheckStatus = "success";
                  console.log(`✓ Leakcheck found ${aggregated.total_unique_breaches} breaches`);
                } else if (!apiKey) {
                  leakcheckStatus = "no_auth";
                  console.log("⚠️  Leakcheck API key not configured, skipping breach detection");
                } else {
                  leakcheckStatus = "failed";
                  console.warn(`⚠️  Leakcheck enrichment partially failed`);
                }
              } else {
                console.log("⚠️  No emails to check with Leakcheck");
              }

              leakcheckMs = Date.now() - leakcheckStart;
            } catch (error) {
              leakcheckStatus = "failed";
              console.error(`✗ Leakcheck enrichment error: ${(error as Error).message}`);
              leakcheckMs = Date.now() - enrichStartTime;
            }
          })()
        );
      }

      // Wait for all enrichment to complete (with timeout)
      await Promise.race([
        Promise.all(enrichmentPromises),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Enrichment timeout")), timeout)
        ),
      ]).catch((error) => {
        console.warn(`⚠️  Enrichment timeout/error: ${error.message}`);
      });

      // Step 3: Consolidate profiles
      const consolidateStartTime = Date.now();
      console.log("🔗 Step 3: Consolidating profiles from all brokers...");

      // Generate person ID
      const personId = this.generatePersonId(dedupGroup);

      // Consolidate profiles
      let consolidatedProfile = consolidateProfiles(
        rawProfiles,
        personId,
        this.getGroupConfidence(dedupGroup)
      );

      // Add enrichment data
      consolidatedProfile = addEnrichmentData(consolidatedProfile, holeheServices, leakcheckBreaches);

      const consolidateMs = Date.now() - consolidateStartTime;
      console.log(`✓ Consolidated profile created`);

      const totalPhase2Ms = Date.now() - startTime;

      // Calculate costs
      const phase2CostUsd = 0.007; // Base cost for Phase 2

      const result: Phase2EnrichmentResult = {
        success: true,
        consolidated_profile: consolidatedProfile,
        enrichment_data: {
          holehe_services: holeheServices,
          leakcheck_breaches: leakcheckBreaches,
          holehe_services_checked: holeheServicesChecked,
          leakcheck_status: leakcheckStatus,
        },
        metadata: {
          total_phase2_ms: totalPhase2Ms,
          detail_scrape_ms: detailMs,
          email_extract_ms: emailMs,
          holehe_ms: holeheMs,
          leakcheck_ms: leakcheckMs,
          consolidate_ms: consolidateMs,
          emails_found: emailResult.count,
          services_found: holeheServices.length,
          breaches_found: leakcheckBreaches.length,
          phase2_cost_usd: phase2CostUsd,
        },
      };

      console.log(
        `✓ Phase 2 complete in ${totalPhase2Ms}ms: ${consolidatedProfile.emails.length} emails, ${holeheServices.length} services, ${leakcheckBreaches.length} breaches`
      );

      return result;
    } catch (error) {
      const timingMs = Date.now() - startTime;
      const errorMsg = (error as Error).message;

      console.error(`✗ Phase 2 failed: ${errorMsg}`);

      return {
        success: false,
        error: errorMsg,
        metadata: {
          total_phase2_ms: timingMs,
          email_extract_ms: 0,
          holehe_ms: 0,
          leakcheck_ms: 0,
          consolidate_ms: 0,
          emails_found: 0,
          services_found: 0,
          breaches_found: 0,
          phase2_cost_usd: 0,
        },
      };
    }
  }

  /**
   * Store Phase 2 results in database
   * @param supabaseClient Supabase client
   * @param quickScanId Reference to quick_scans
   * @param dedupGroupId Reference to dedup group
   * @param result Phase 2 enrichment result
   * @returns Enrichment ID or null on error
   */
  async storeResults(
    supabaseClient: any,
    quickScanId: string,
    dedupGroupId: string,
    result: Phase2EnrichmentResult
  ): Promise<string | null> {
    if (!result.success || !result.consolidated_profile || !result.metadata) {
      console.error("Cannot store unsuccessful Phase 2 result");
      return null;
    }

    console.log("💾 Storing Phase 2 enrichment results...");

    try {
      const { data, error } = await supabaseClient
        .schema("quickscan").from("quickscan_enrichment")
        .insert({
          quick_scan_id: quickScanId,
          dedup_group_id: dedupGroupId,
          emails_found: result.consolidated_profile.emails,
          emails_extracted_at: new Date().toISOString(),
          holehe_status: holeheStatus(result),
          services_found: result.enrichment_data?.holehe_services || [],
          services_checked: result.enrichment_data?.holehe_services_checked ?? 0,
          // Left NULL deliberately. The hosted Holehe API models each service
          // as `boolean | {username,url}`, so a `false` is a VERDICT ("no
          // account"), not "could not check". Per-service unavailability simply
          // is not in the response, and inventing a number here would defeat
          // the column's only purpose. Use holehe_status + services_checked to
          // judge coverage. See docs/PUNCHLIST.md §3.4.
          services_unavailable: null,
          holehe_checked_at: new Date().toISOString(),
          // Was `... ? "success" : "no_results"`, but 'no_results' is NOT in
          // quickscan_enrichment_leakcheck_status_check (pending | success |
          // failed | no_auth | timeout). Since most people have zero breaches,
          // that violated the constraint on the COMMON path and failed the
          // whole enrichment insert. Zero breaches is now 'success'.
          leakcheck_status: result.enrichment_data?.leakcheck_status ?? "pending",
          breaches: result.enrichment_data?.leakcheck_breaches || [],
          breach_count: result.enrichment_data?.leakcheck_breaches.length ?? 0,
          fields_exposed: exposedFields(result.consolidated_profile),
          leakcheck_checked_at: new Date().toISOString(),
          consolidated_profile: result.consolidated_profile,
          phase1_cost_usd: 0.0025, // From Phase 1
          phase2_cost_usd: result.metadata.phase2_cost_usd,
          total_cost_usd: 0.0025 + result.metadata.phase2_cost_usd,
          email_extract_ms: result.metadata.email_extract_ms,
          holehe_ms: result.metadata.holehe_ms,
          leakcheck_ms: result.metadata.leakcheck_ms,
          consolidate_ms: result.metadata.consolidate_ms,
          total_phase2_ms: result.metadata.total_phase2_ms,
          completed_at: new Date().toISOString(),
        })
        .select("id");

      if (error) {
        console.error(`Error storing enrichment result: ${error.message}`);
        return null;
      }

      if (data && data[0]) {
        const enrichmentId = data[0].id;
        console.log(`✓ Enrichment stored with ID ${enrichmentId}`);
        return enrichmentId;
      }

      return null;
    } catch (error) {
      console.error(`Error storing Phase 2 results: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Generate unique person ID for consolidated profile
   */
  private generatePersonId(dedupGroup: DedupGroup): string {
    // Simple ID: hash of name + location + timestamp
    const data = `${dedupGroup.members[0]?.summary.full_name || "unknown"}|${dedupGroup.dedup_id}|${Date.now()}`;
    return this.simpleHash(data);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get average confidence from dedup group
   */
  private getGroupConfidence(dedupGroup: DedupGroup): number {
    if (dedupGroup.members.length === 0) return 0;
    const sum = dedupGroup.members.reduce((total, m) => total + m.match_score, 0);
    return Math.round((sum / dedupGroup.members.length) * 100) / 100;
  }
}

/**
 * Phase 2 orchestration options
 */
export interface Phase2Options {
  timeout?: number; // Overall timeout in ms (default: 60000)
  includeLeakcheck?: boolean; // Include Leakcheck enrichment (default: true if key configured)
  detailTimeoutMs?: number; // Per-broker timeout for the detail-page scrape (default: 20000)
}
