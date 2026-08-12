/**
 * Phase 1 Orchestrator
 * Parallel 4-broker search with deduplication
 *
 * Orchestrates the following flow:
 * 1. Search all 4 brokers in parallel (FPS, NPD, AnyWho, Zaba)
 * 2. Deduplicate results using weighted scoring algorithm
 * 3. Generate dedup groups and rank by confidence
 * 4. Store results in database
 */

import { DedupEngine } from "./DedupEngine.ts";
import {
  QuickScanInput,
  BrokerName,
  ScrapeResult,
  SummaryResult,
  DedupGroup,
  SequenceOutput,
} from "./quickscan-phase1-phase2-models.ts";

/**
 * Phase 1 search results
 */
export interface Phase1SearchResult {
  success: boolean;
  dedup_groups: DedupGroup[];
  raw_results: Record<string, ScrapeResult>;
  metadata: {
    total_time_ms: number;
    phase: string;
    profiles_found: number;
    brokers_scraped: string[];
    phase_timings?: Record<string, number>;
    used_scraper_lab?: boolean;
  };
  error?: string;
}

/**
 * Phase 1 orchestrator
 * Performs parallel 4-broker search and deduplication
 */
export class Phase1Orchestrator {
  private dedupEngine: DedupEngine;

  constructor() {
    this.dedupEngine = new DedupEngine();
  }

  /**
   * Run Phase 1: Parallel 4-broker search with deduplication
   * @param userInput User search parameters
   * @param options Orchestration options
   * @returns Phase1SearchResult with dedup groups
   */
  async runPhase1(userInput: QuickScanInput, options: Phase1Options = {}): Promise<Phase1SearchResult> {
    const startTime = Date.now();
    const { useScraperLab = true, timeout = 60000 } = options;

    console.log(`🔍 Phase 1 starting: ${userInput.first_name} ${userInput.last_name}, ${userInput.city}, ${userInput.state}`);

    try {
      // Try using scraper-lab if available and enabled
      if (useScraperLab) {
        const scraperLabResult = await this.tryScraperLab(userInput, timeout);
        if (scraperLabResult) {
          return scraperLabResult;
        }
      }

      // Fall back to native Edge Function scrapers
      console.log("⚠️  Scraper-lab not available, falling back to native scrapers");
      return await this.nativeSearch(userInput, timeout);
    } catch (error) {
      const timingMs = Date.now() - startTime;
      const errorMsg = (error as Error).message;

      console.error(`✗ Phase 1 failed: ${errorMsg}`);

      return {
        success: false,
        dedup_groups: [],
        raw_results: {},
        metadata: {
          total_time_ms: timingMs,
          phase: "summary",
          profiles_found: 0,
          brokers_scraped: [],
        },
        error: errorMsg,
      };
    }
  }

  /**
   * Try using scraper-lab bridge for 4-broker parallel search
   * @param userInput User search parameters
   * @param timeout Overall timeout
   * @returns Phase1SearchResult or null if scraper-lab not available
   */
  private async tryScraperLab(userInput: QuickScanInput, timeout: number): Promise<Phase1SearchResult | null> {
    const scraperLabUrl = Deno.env.get("SCRAPER_LAB_URL");
    const scraperLabToken = Deno.env.get("SCRAPER_LAB_TOKEN");

    if (!scraperLabUrl) {
      return null; // Scraper-lab not configured
    }

    try {
      console.log("🔗 Calling scraper-lab bridge for 4-broker parallel search...");
      const startTime = Date.now();

      const response = await fetch(`${scraperLabUrl}/api/quickscan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(scraperLabToken && { Authorization: `Bearer ${scraperLabToken}` }),
        },
        body: JSON.stringify({
          first_name: userInput.first_name,
          last_name: userInput.last_name,
          city: userInput.city,
          state: userInput.state,
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        console.warn(`Scraper-lab returned ${response.status}, trying native search`);
        return null;
      }

      const data = await response.json() as SequenceOutput;
      const timingMs = Date.now() - startTime;

      console.log(`✓ Scraper-lab Phase 1 complete: ${data.dedup_groups.length} groups in ${timingMs}ms`);

      return {
        success: true,
        dedup_groups: data.dedup_groups,
        raw_results: data.raw_results,
        metadata: {
          total_time_ms: timingMs,
          phase: "summary",
          profiles_found: data.dedup_groups.length,
          brokers_scraped: Object.keys(data.raw_results),
          used_scraper_lab: true,
        },
      };
    } catch (error) {
      console.warn(`Scraper-lab call failed: ${(error as Error).message}`);
      return null; // Fall back to native search
    }
  }

  /**
   * Native search using Edge Function scrapers
   * Falls back to built-in scrapers if scraper-lab not available
   *
   * @param userInput User search parameters
   * @param timeout Overall timeout
   * @returns Phase1SearchResult
   */
  private async nativeSearch(userInput: QuickScanInput, timeout: number): Promise<Phase1SearchResult> {
    const startTime = Date.now();

    // For now, implement single-broker fallback (AnyWho + optional FPS service)
    // Full 4-broker native support would require porting NPD scraper
    console.log("🔍 Searching with native Edge Function scrapers...");

    const searchResults: Record<string, ScrapeResult> = {};

    // In production, this would call the existing searchProfilesMulti function
    // For now, returning placeholder result
    // TODO: Implement native 4-broker search when NPD scraper is ported

    const timingMs = Date.now() - startTime;

    // If no results found from native search, we can still return the structure
    // The caller can decide whether to retry or show "no matches" message
    return {
      success: false,
      dedup_groups: [],
      raw_results: searchResults,
      metadata: {
        total_time_ms: timingMs,
        phase: "summary",
        profiles_found: 0,
        brokers_scraped: [],
        used_scraper_lab: false,
      },
      error: "Native 4-broker search not yet implemented. Please configure SCRAPER_LAB_URL.",
    };
  }

  /**
   * Store Phase 1 results in database
   * @param supabaseClient Supabase client
   * @param quickScanId Reference to quick_scans table
   * @param result Phase 1 search result
   * @returns Array of stored dedup group IDs
   */
  async storeResults(
    supabaseClient: any,
    quickScanId: string,
    result: Phase1SearchResult
  ): Promise<string[]> {
    const dedupGroupIds: string[] = [];

    if (!result.success || result.dedup_groups.length === 0) {
      return dedupGroupIds;
    }

    console.log(`💾 Storing ${result.dedup_groups.length} dedup groups...`);

    // Store each dedup group
    for (let rank = 0; rank < result.dedup_groups.length; rank++) {
      const group = result.dedup_groups[rank];

      const { data, error } = await supabaseClient.from("quickscan_dedup_groups").insert({
        quick_scan_id: quickScanId,
        dedup_id: group.dedup_id,
        rank: rank + 1,
        primary_name: group.members[0]?.summary.full_name || "",
        primary_age: group.members[0]?.summary.age,
        primary_city:
          group.members[0]?.summary.address.split(",")[0]?.trim() || "",
        primary_state:
          group.members[0]?.summary.address.split(",")[1]?.trim() || "",
        average_confidence: this.getAverageConfidence(group),
        age_conflict: group.age_conflict,
        age_note: group.age_note,
        sources: group.members.map((m) => m.summary.broker),
        members_count: group.members.length,
        full_data: this.formatGroupData(group),
        phase1_cost_usd: 0.0025,
      }).select("id");

      if (error) {
        console.error(`Error storing dedup group: ${error.message}`);
        continue;
      }

      if (data && data[0]) {
        dedupGroupIds.push(data[0].id);
      }
    }

    console.log(`✓ Stored ${dedupGroupIds.length} dedup groups`);

    return dedupGroupIds;
  }

  /**
   * Get average confidence for a group
   */
  private getAverageConfidence(group: DedupGroup): number {
    if (group.members.length === 0) return 0;
    const sum = group.members.reduce((total, m) => total + m.match_score, 0);
    return Math.round((sum / group.members.length) * 100) / 100;
  }

  /**
   * Format dedup group for JSONB storage
   */
  private formatGroupData(group: DedupGroup): Record<string, unknown> {
    return {
      dedup_id: group.dedup_id,
      members: group.members.map((m) => ({
        broker: m.summary.broker,
        summary: {
          full_name: m.summary.full_name,
          address: m.summary.address,
          age_range: m.summary.age_range,
          age: m.summary.age,
          location: m.summary.location,
          profile_url: m.summary.profile_url,
        },
        match_score: m.match_score,
      })),
      age_conflict: group.age_conflict,
      age_note: group.age_note,
    };
  }
}

/**
 * Phase 1 orchestration options
 */
export interface Phase1Options {
  useScraperLab?: boolean; // Try scraper-lab first (default: true)
  timeout?: number; // Overall timeout in ms (default: 60000)
}
