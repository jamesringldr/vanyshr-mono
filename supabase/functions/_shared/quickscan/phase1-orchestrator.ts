/**
 * Phase 1 Orchestrator
 * Parallel 4-broker search with deduplication
 *
 * Pilot path:
 * 1. Context.dev HTML scrape for FPS / NPD / AnyWho
 * 2. Zaba via serv-01 residential service (ZABA_SERVICE_*)
 * 3. Deduplicate with DedupEngine
 * 4. Store results in database
 */

import { DedupEngine } from "./DedupEngine.ts";
import {
  QuickScanInput,
  BrokerName,
  ScrapeResult,
  DedupGroup,
} from "./quickscan-phase1-phase2-models.ts";
import {
  searchAnyWhoViaContextDev,
  searchFpsViaContextDev,
  searchNpdViaContextDev,
} from "./context-dev-brokers.ts";
import { searchZabaViaService } from "./zaba-service-client.ts";

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
    used_context_dev?: boolean;
    used_zaba_service?: boolean;
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
   */
  async runPhase1(userInput: QuickScanInput, options: Phase1Options = {}): Promise<Phase1SearchResult> {
    const startTime = Date.now();
    const { timeout = 150000 } = options;
    const perBrokerTimeout = Math.min(90000, Math.max(30000, Math.floor(timeout * 0.7)));

    console.log(
      `🔍 Phase 1 starting (Context.dev + Zaba service): ${userInput.first_name} ${userInput.last_name}, ${userInput.city}, ${userInput.state}`,
    );

    try {
      const [fps, npd, anywho, zaba] = await Promise.all([
        searchFpsViaContextDev(userInput, perBrokerTimeout),
        searchNpdViaContextDev(userInput, perBrokerTimeout),
        searchAnyWhoViaContextDev(userInput, perBrokerTimeout),
        // Edge Functions can't reach Tailscale serv-01; fail fast if unreachable
        searchZabaViaService(userInput, { timeoutMs: Math.min(20000, timeout) }),
      ]);

      const rawResults: Record<string, ScrapeResult> = {
        [BrokerName.FPS]: fps,
        [BrokerName.NPD]: npd,
        [BrokerName.ANYWHO]: anywho,
        [BrokerName.ZABA]: zaba,
      };

      const profilesFound = Object.values(rawResults).reduce(
        (sum, r) => sum + r.summaries.length,
        0,
      );
      const brokersOk = Object.values(rawResults).filter((r) => r.status !== "failed").length;

      if (profilesFound === 0 && brokersOk === 0) {
        const errors = Object.values(rawResults)
          .map((r) => r.error)
          .filter(Boolean)
          .join("; ");
        return {
          success: false,
          dedup_groups: [],
          raw_results: rawResults,
          metadata: {
            total_time_ms: Date.now() - startTime,
            phase: "summary",
            profiles_found: 0,
            brokers_scraped: Object.keys(rawResults),
            used_context_dev: true,
            used_zaba_service: true,
            phase_timings: {
              fps: fps.timing_ms,
              npd: npd.timing_ms,
              anywho: anywho.timing_ms,
              zaba: zaba.timing_ms,
            },
          },
          error: errors || "All brokers failed",
        };
      }

      const dedupGroups = this.dedupEngine.deduplicate(rawResults);
      const timingMs = Date.now() - startTime;

      console.log(
        `✓ Phase 1 complete: ${profilesFound} summaries → ${dedupGroups.length} groups in ${timingMs}ms`,
      );

      return {
        success: true,
        dedup_groups: dedupGroups,
        raw_results: rawResults,
        metadata: {
          total_time_ms: timingMs,
          phase: "summary",
          profiles_found: profilesFound,
          brokers_scraped: Object.keys(rawResults),
          used_context_dev: true,
          used_zaba_service: true,
          phase_timings: {
            fps: fps.timing_ms,
            npd: npd.timing_ms,
            anywho: anywho.timing_ms,
            zaba: zaba.timing_ms,
          },
        },
      };
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
   * Store Phase 1 results in database
   */
  async storeResults(
    supabaseClient: any,
    quickScanId: string,
    result: Phase1SearchResult,
    sessionId?: string,
  ): Promise<string[]> {
    const dedupGroupIds: string[] = [];

    if (!result.success || result.dedup_groups.length === 0) {
      return dedupGroupIds;
    }

    console.log(`💾 Storing ${result.dedup_groups.length} dedup groups...`);

    for (let rank = 0; rank < result.dedup_groups.length; rank++) {
      const group = result.dedup_groups[rank];

      const { data, error } = await supabaseClient.from("quickscan_dedup_groups").insert({
        quick_scan_id: quickScanId,
        session_id: sessionId ?? null,
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

  private getAverageConfidence(group: DedupGroup): number {
    if (group.members.length === 0) return 0;
    const sum = group.members.reduce((total, m) => total + m.match_score, 0);
    return Math.round((sum / group.members.length) * 100) / 100;
  }

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
  timeout?: number; // Overall timeout in ms (default: 150000)
}
