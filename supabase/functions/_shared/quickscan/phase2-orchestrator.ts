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

/**
 * Phase 2 enrichment result
 */
export interface Phase2EnrichmentResult {
  success: boolean;
  consolidated_profile?: ConsolidatedProfile;
  enrichment_data?: {
    holehe_services: string[];
    leakcheck_breaches: BreachRecord[];
  };
  metadata?: {
    total_phase2_ms: number;
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

export type Phase2Stage = "profile" | "holehe" | "leakcheck" | "finalize";

export interface Phase2StageResult {
  success: boolean;
  stage: Phase2Stage;
  emails?: string[];
  holehe_services?: string[];
  leakcheck_breaches?: BreachRecord[];
  consolidated_profile?: ConsolidatedProfile;
  enrichment_data?: {
    holehe_services: string[];
    leakcheck_breaches: BreachRecord[];
  };
  timing_ms?: number;
  error?: string;
}

/**
 * Phase 2 orchestrator
 */
export class Phase2Orchestrator {
  /**
   * Run a single enrichment stage (for UI step sync).
   * Stages: profile → holehe → leakcheck → finalize
   */
  async runStage(
    stage: Phase2Stage,
    dedupGroup: DedupGroup,
    rawProfiles: Record<string, unknown>,
    prior: {
      emails?: string[];
      holehe_services?: string[];
      leakcheck_breaches?: BreachRecord[];
    } = {},
  ): Promise<Phase2StageResult> {
    const start = Date.now();
    try {
      if (stage === "profile") {
        console.log("📧 Stage profile: extracting emails / building profile base...");
        const emailResult = extractEmailsFromBrokers(rawProfiles);
        const emails = emailResult.emails || [];
        console.log(`✓ Profile stage: ${emails.length} emails`);
        return {
          success: true,
          stage,
          emails,
          timing_ms: Date.now() - start,
        };
      }

      if (stage === "holehe") {
        const emails = prior.emails || [];
        console.log(`🌐 Stage holehe: checking ${emails.length} emails...`);
        let services: string[] = [];
        if (emails.length > 0) {
          const results = await enrichEmailsWithHolehe(emails, 30000);
          const aggregated = aggregateHoleheResults(results);
          if (aggregated.success) services = aggregated.services;
        }
        console.log(`✓ Holehe stage: ${services.length} services`);
        return {
          success: true,
          stage,
          emails,
          holehe_services: services,
          timing_ms: Date.now() - start,
        };
      }

      if (stage === "leakcheck") {
        const emails = prior.emails || [];
        console.log(`🔴 Stage leakcheck: checking ${emails.length} emails...`);
        let breaches: BreachRecord[] = [];
        if (emails.length > 0) {
          const apiKey = Deno.env.get("LEAKCHECK_API_KEY");
          const results = await enrichEmailsWithLeakcheck(emails, apiKey, 30000);
          const aggregated = aggregateLeakcheckResults(results);
          if (aggregated.success) breaches = aggregated.breaches;
        }
        console.log(`✓ Leakcheck stage: ${breaches.length} breaches`);
        return {
          success: true,
          stage,
          emails,
          leakcheck_breaches: breaches,
          timing_ms: Date.now() - start,
        };
      }

      // finalize
      console.log("🔗 Stage finalize: consolidating profile...");
      const emails = prior.emails || [];
      const holeheServices = prior.holehe_services || [];
      const leakcheckBreaches = prior.leakcheck_breaches || [];
      const personId = this.generatePersonId(dedupGroup);
      let consolidatedProfile = consolidateProfiles(
        rawProfiles,
        personId,
        this.getGroupConfidence(dedupGroup),
      );
      consolidatedProfile = addEnrichmentData(
        consolidatedProfile,
        holeheServices,
        leakcheckBreaches,
      );
      // Ensure extracted emails are present
      if (emails.length > 0) {
        const merged = Array.from(new Set([...consolidatedProfile.emails, ...emails]));
        consolidatedProfile = { ...consolidatedProfile, emails: merged };
      }
      console.log("✓ Finalize stage complete");
      return {
        success: true,
        stage,
        emails,
        holehe_services: holeheServices,
        leakcheck_breaches: leakcheckBreaches,
        consolidated_profile: consolidatedProfile,
        enrichment_data: {
          holehe_services: holeheServices,
          leakcheck_breaches: leakcheckBreaches,
        },
        timing_ms: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        stage,
        error: (error as Error).message,
        timing_ms: Date.now() - start,
      };
    }
  }

  /**
   * Run Phase 2: Full profile enrichment (all stages, sequential for compatibility)
   */
  async runPhase2(
    dedupGroup: DedupGroup,
    rawProfiles: Record<string, unknown>,
    options: Phase2Options = {}
  ): Promise<Phase2EnrichmentResult> {
    const startTime = Date.now();
    const { includeLeakcheck = true } = options;

    console.log(`🔍 Phase 2 starting for ${dedupGroup.members[0]?.summary.full_name || "unknown"}...`);

    try {
      const profile = await this.runStage("profile", dedupGroup, rawProfiles);
      const emails = profile.emails || [];
      const emailMs = profile.timing_ms || 0;

      const holehe = await this.runStage("holehe", dedupGroup, rawProfiles, { emails });
      const holeheServices = holehe.holehe_services || [];
      const holeheMs = holehe.timing_ms || 0;

      let leakcheckBreaches: BreachRecord[] = [];
      let leakcheckMs = 0;
      if (includeLeakcheck) {
        const leak = await this.runStage("leakcheck", dedupGroup, rawProfiles, { emails });
        leakcheckBreaches = leak.leakcheck_breaches || [];
        leakcheckMs = leak.timing_ms || 0;
      }

      const finalize = await this.runStage("finalize", dedupGroup, rawProfiles, {
        emails,
        holehe_services: holeheServices,
        leakcheck_breaches: leakcheckBreaches,
      });

      if (!finalize.success || !finalize.consolidated_profile) {
        throw new Error(finalize.error || "Finalize failed");
      }

      const consolidateMs = finalize.timing_ms || 0;
      const totalPhase2Ms = Date.now() - startTime;
      const phase2CostUsd = 0.007;

      return {
        success: true,
        consolidated_profile: finalize.consolidated_profile,
        enrichment_data: {
          holehe_services: holeheServices,
          leakcheck_breaches: leakcheckBreaches,
        },
        metadata: {
          total_phase2_ms: totalPhase2Ms,
          email_extract_ms: emailMs,
          holehe_ms: holeheMs,
          leakcheck_ms: leakcheckMs,
          consolidate_ms: consolidateMs,
          emails_found: emails.length,
          services_found: holeheServices.length,
          breaches_found: leakcheckBreaches.length,
          phase2_cost_usd: phase2CostUsd,
        },
      };
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
    result: Phase2EnrichmentResult,
    sessionId?: string,
  ): Promise<string | null> {
    if (!result.success || !result.consolidated_profile || !result.metadata) {
      console.error("Cannot store unsuccessful Phase 2 result");
      return null;
    }

    console.log("💾 Storing Phase 2 enrichment results...");

    try {
      const { data, error } = await supabaseClient
        .from("quickscan_enrichment")
        .insert({
          quick_scan_id: quickScanId,
          dedup_group_id: dedupGroupId,
          session_id: sessionId ?? null,
          emails_found: result.consolidated_profile.emails,
          emails_extracted_at: new Date().toISOString(),
          holehe_status: "success",
          services_found: result.enrichment_data?.holehe_services || [],
          holehe_checked_at: new Date().toISOString(),
          leakcheck_status: "success",
          breaches: result.enrichment_data?.leakcheck_breaches || [],
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
}
