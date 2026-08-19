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
  ScrapeResult,
  DedupGroup,
  SequenceOutput,
  BrokerName,
} from "./quickscan-phase1-phase2-models.ts";
import { contextDevEnabled } from "./context-dev-client.ts";
import { scrapeAllBrokers } from "./html-scrapers.ts";

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
    const { useScraperLab = false, timeout = 60000, brokers } = options;

    console.log(`🔍 Phase 1 starting: ${userInput.first_name} ${userInput.last_name}, ${userInput.city}, ${userInput.state}${brokers ? ` [${brokers.join(",")}]` : ""}`);

    try {
      // context.dev HTML is the live path. Lab/Funnel is fallback only.
      const native = await this.nativeSearch(userInput, timeout, brokers);
      if (native.success) return native;

      if (useScraperLab) {
        console.warn(
          `⚠️ context.dev failed (${native.error}) — falling back to scraper-lab/serv01 for ${userInput.first_name} ${userInput.last_name}`,
        );
        const lab = await this.tryScraperLab(userInput, timeout);
        if (lab?.success) {
          console.warn(`⚠️ SERV01 FALLBACK USED — Phase 1 result came from scraper-lab, not context.dev`);
          return lab;
        }
      }

      return native;
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
   * Call scraper-lab POST /api/quickscan.
   * @returns null if SCRAPER_LAB_URL is unset (not configured).
   *          Otherwise a Phase1SearchResult — success or a surfaced lab error.
   */
  private async tryScraperLab(userInput: QuickScanInput, timeout: number): Promise<Phase1SearchResult | null> {
    const scraperLabUrl = Deno.env.get("SCRAPER_LAB_URL")?.replace(/\/$/, "");
    const scraperLabToken = Deno.env.get("SCRAPER_LAB_TOKEN");

    if (!scraperLabUrl) {
      return null;
    }

    const startTime = Date.now();
    const fail = (error: string): Phase1SearchResult => ({
      success: false,
      dedup_groups: [],
      raw_results: {},
      metadata: {
        total_time_ms: Date.now() - startTime,
        phase: "summary",
        profiles_found: 0,
        brokers_scraped: [],
        used_scraper_lab: true,
      },
      error,
    });

    try {
      console.log("🔗 Calling scraper-lab bridge for 4-broker parallel search...");

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
        const body = await response.text().catch(() => "");
        const snippet = body.slice(0, 200);
        return fail(`Scraper-lab HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`);
      }

      const data = await response.json() as SequenceOutput;
      if (!data || !Array.isArray(data.dedup_groups) || !data.raw_results) {
        return fail("Scraper-lab response missing dedup_groups or raw_results");
      }

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
      return fail(`Scraper-lab call failed: ${(error as Error).message}`);
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
  private async nativeSearch(userInput: QuickScanInput, timeout: number, brokers?: BrokerName[]): Promise<Phase1SearchResult> {
    const startTime = Date.now();

    if (!contextDevEnabled()) {
      return {
        success: false,
        dedup_groups: [],
        raw_results: {},
        metadata: {
          total_time_ms: Date.now() - startTime,
          phase: "summary",
          profiles_found: 0,
          brokers_scraped: [],
          used_scraper_lab: false,
          used_context_dev: false,
        },
        error: "CONTEXT_DEV_API_KEY is not set",
      };
    }

    console.log(`🔍 Phase 1 via context.dev HTML (${brokers?.join("/") ?? "FPS/NPD/AnyWho/Zaba"})`);
    const perBrokerTimeout = Math.min(25000, Math.max(8000, timeout - 5000));
    const raw_results = await scrapeAllBrokers(userInput, perBrokerTimeout, brokers);
    const completed = Object.values(raw_results).filter((r) => r.status !== "failed");
    const timingMs = Date.now() - startTime;

    if (completed.length === 0) {
      const errors = Object.values(raw_results).map((r) => r.error).filter(Boolean).join("; ");
      return {
        success: false,
        dedup_groups: [],
        raw_results,
        metadata: {
          total_time_ms: timingMs,
          phase: "summary",
          profiles_found: 0,
          brokers_scraped: Object.keys(raw_results),
          used_scraper_lab: false,
          used_context_dev: true,
        },
        error: errors || "All brokers failed",
      };
    }

    const dedup_groups = this.dedupEngine.deduplicate(raw_results);
    return {
      success: true,
      dedup_groups,
      raw_results,
      metadata: {
        total_time_ms: timingMs,
        phase: "summary",
        profiles_found: dedup_groups.length,
        brokers_scraped: Object.keys(raw_results),
        used_scraper_lab: false,
        used_context_dev: true,
      },
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
          phone: m.summary.phone,
          email: m.summary.email,
          aliases: m.summary.aliases,
          relatives: m.summary.relatives,
          previous_addresses: m.summary.previous_addresses,
          result_id: m.summary.result_id,
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
  useScraperLab?: boolean; // Fallback if context.dev fails — serv01, opt-in only (default: false)
  timeout?: number; // Overall timeout in ms (default: 60000)
  brokers?: BrokerName[]; // Subset to search (default: all 4) — used for the fast/slow two-tier split
}
