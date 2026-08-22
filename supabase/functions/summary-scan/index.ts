/**
 * summary-scan — the intro-scan sequence's summary/full-scan step.
 *
 * Given an existing quickscan.quickscans row, runs the 4-broker parallel
 * search (scrapeBrokersConcurrently — same context.dev path pilot-scan
 * Phase 1 uses) but only *awaits* Zaba, which is already full-profile-grade
 * data on its own -- the selection modal needs nothing else. FPS/NPD/AnyWho
 * are consistently the slow, sometimes-failing part (NPD alone was 18-25s
 * across real test runs, once timing out entirely -- see quickscan.
 * scan_timings), and the modal doesn't need them at all, so this responds
 * the moment Zaba resolves and finishes fetching/writing/matching the other
 * three in the background via EdgeRuntime.waitUntil().
 *
 * No-Zaba fallback: when Zaba comes back with zero results for this scan,
 * there's no fast path to protect -- the modal has nothing to show until
 * fps/npd/anywho are in anyway, so this waits on them right here instead of
 * backgrounding, then offers their matched results as fallback candidates
 * (one per match group, deduped) so the user still gets a pick when Zaba
 * alone doesn't have the person. quickscans.status skips straight to
 * 'summary_scan_complete' in this case -- there's no 'zaba_ready' to report.
 *
 * quickscans.status marks the handoff otherwise: 'zaba_ready' the instant
 * this function responds, 'summary_scan_complete' once the background pass
 * finishes (or fails -- always set to something terminal, since
 * full-profile-scan polls this and would otherwise wait forever on a
 * background error). full-profile-scan checks for 'summary_scan_complete'
 * before doing any work and returns { notReady: true } instead if the
 * background pass isn't done yet; the frontend just retries.
 *
 * Zaba bypasses summary_results entirely: its search results are already
 * full-profile-grade data, so they're written straight to
 * full_profile_results (summary_result_id left NULL). FPS/NPD/AnyWho write to
 * summary_results — their full-profile scrape is a later step, not this one.
 *
 * Input: { quickscanId }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeBrokersConcurrently } from "../_shared/quickscan/html-scrapers.ts";
import { DedupEngine } from "../_shared/quickscan/DedupEngine.ts";
import { logTiming } from "../_shared/quickscan/consolidation.ts";
import {
  BrokerName,
  type QuickScanInput,
  type ScrapeResult,
  type SummaryResult,
  type DedupGroup,
} from "../_shared/quickscan/quickscan-phase1-phase2-models.ts";

type StoredRow = { table: "summary_results" | "full_profile_results"; id: string };

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quickscanId = String(body.quickscanId || body.quickscan_id || body.id || "").trim();
    if (!quickscanId) {
      return new Response(
        JSON.stringify({ success: false, error: "quickscanId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Whole-function wall time -- literally "time to the selector modal",
    // since the modal renders off this response.
    const functionStarted = Date.now();

    const { data: quickscan, error: fetchError } = await supabase
      .schema("quickscan")
      .from("quickscans")
      .select("id, search_input")
      .eq("id", quickscanId)
      .maybeSingle();

    if (fetchError || !quickscan) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError?.message || "quickscan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchInput = (quickscan.search_input || {}) as Record<string, string>;
    const input: QuickScanInput = {
      first_name: searchInput.first_name,
      last_name: searchInput.last_name,
      city: searchInput.city,
      state: searchInput.state,
    };

    console.log(
      `🔍 summary-scan ${quickscanId}: ${input.first_name} ${input.last_name}, ${input.city}, ${input.state}`,
    );

    // All 4 fetches start together; only Zaba is awaited here.
    const brokerPromises = scrapeBrokersConcurrently(input);

    const zabaResult = await brokerPromises[BrokerName.ZABA];
    await logTiming(supabase, quickscanId, "summary_scan_broker", zabaResult.timing_ms, {
      broker: zabaResult.broker,
      resultCount: zabaResult.summaries.length,
      status: zabaResult.status,
      error: zabaResult.error,
    });

    // Keyed by broker+result_id so the matching pass can turn a DedupGroup
    // (in-memory SummaryResult objects) back into row ids to stamp
    // match_group_id onto. Shared with finishScan() below -- both add to the
    // same map, Zaba's entries now, the other three later.
    const stored = new Map<string, StoredRow>();
    const summaryCounts: Record<string, number> = { [BrokerName.ZABA]: zabaResult.summaries.length };
    // Candidates for the frontend's selection modal. Normally Zaba's own
    // results -- the only target with full-profile-grade data at this point.
    // When Zaba has none, this is filled from fps/npd/anywho's matched
    // results instead (see the zabaResult.summaries.length === 0 branch
    // below) so the user still gets something to pick from.
    const zabaCandidates: Record<string, unknown>[] = [];

    if (zabaResult.summaries.length === 0) {
      await writePlaceholder(supabase, quickscanId, zabaResult);
    } else {
      for (const summary of zabaResult.summaries) {
        const row = await writeFullProfile(supabase, quickscanId, summary);
        if (row) {
          stored.set(candidateKey(summary), row);
          zabaCandidates.push({
            broker: summary.broker,
            name: summary.full_name,
            address: summary.address,
            age: summary.age,
            age_range: summary.age_range,
            phone: summary.phone,
            aliases: summary.aliases,
            relatives: summary.relatives,
            previous_addresses: summary.previous_addresses,
            // The frontend's pick action needs this to fold selection into
            // full-profile-scan's request — see full-profile-scan/index.ts.
            result_id: row.id,
          });
        }
      }
    }

    if (zabaResult.summaries.length > 0) {
      // The fast path: Zaba has data, so respond with it immediately and
      // keep fps/npd/anywho going in the background.
      await supabase
        .schema("quickscan")
        .from("quickscans")
        .update({ status: "zaba_ready", deepest_page: "select_profile" })
        .eq("id", quickscanId);

      await logTiming(supabase, quickscanId, "summary_scan_response", Date.now() - functionStarted, { resultCount: stored.size });
      console.log(`✅ summary-scan ${quickscanId}: responding with ${zabaCandidates.length} Zaba candidates, FPS/NPD/AnyWho continuing in the background`);

      // fps/npd/anywho fetch + write + the cross-broker match, continuing
      // after the response below has already gone out. full-profile-scan
      // polls quickscans.status for 'summary_scan_complete' rather than
      // racing this.
      const backgroundWork = finishScan(supabase, quickscanId, functionStarted, zabaResult, brokerPromises, stored, summaryCounts);

      // deno-lint-ignore no-explicit-any
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(backgroundWork);
      } else {
        // No background-task support in this environment (e.g. local dev) --
        // fall back to awaiting it so the work isn't silently dropped when the
        // isolate tears down after the response. Loses the speed win there,
        // stays correct.
        await backgroundWork;
      }
    } else {
      // No-Zaba fallback: nothing to respond with yet regardless, so wait on
      // fps/npd/anywho right here instead of backgrounding, then offer their
      // matched results as candidates. Skips 'zaba_ready' -- finishScan()
      // lands straight on the terminal 'summary_scan_complete' status.
      console.log(`… summary-scan ${quickscanId}: Zaba found nothing, waiting on FPS/NPD/AnyWho for a fallback candidate list`);
      const { groups } = await finishScan(supabase, quickscanId, functionStarted, zabaResult, brokerPromises, stored, summaryCounts);

      for (const group of groups) {
        // NPD is consistently the slowest/least reliable target (see
        // scan_timings) -- prefer a non-NPD member as the representative
        // when a group has one, purely for which fields get shown, not
        // which brokers get scraped (full-profile-scan still fetches every
        // matched member regardless of which one is shown here).
        const representative = group.members.find((m) => m.summary.broker !== BrokerName.NPD) ?? group.members[0];
        if (!representative) continue;
        const row = stored.get(candidateKey(representative.summary));
        if (!row) continue;
        const summary = representative.summary;
        zabaCandidates.push({
          broker: summary.broker,
          name: summary.full_name,
          address: summary.address,
          age: summary.age,
          age_range: summary.age_range,
          phone: summary.phone,
          aliases: summary.aliases,
          relatives: summary.relatives,
          previous_addresses: summary.previous_addresses,
          result_id: row.id,
        });
      }

      await logTiming(supabase, quickscanId, "summary_scan_response", Date.now() - functionStarted, { resultCount: zabaCandidates.length });
      console.log(`✅ summary-scan ${quickscanId}: Zaba empty, responding with ${zabaCandidates.length} fallback candidates from FPS/NPD/AnyWho`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        quickscan_id: quickscanId,
        zaba_candidates: zabaCandidates,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("summary-scan error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Fetches fps/npd/anywho (already in flight via brokerPromises), writes
 * their summary_results, clusters everything (Zaba included) into
 * match_groups, links stored rows to their group, and always lands
 * quickscans.status on 'summary_scan_complete' -- on success or failure,
 * since full-profile-scan polls for that status and would otherwise wait
 * forever on a background error it never hears about.
 *
 * Called two ways: fire-and-forget via EdgeRuntime.waitUntil() when Zaba
 * already has data to respond with, or awaited directly when Zaba has none
 * and the response itself needs these results. Returns the dedup groups
 * either way so the zaba-empty caller can build fallback candidates from
 * them; the backgrounded caller ignores the return value.
 */
async function finishScan(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  functionStarted: number,
  zabaResult: ScrapeResult,
  brokerPromises: Record<string, Promise<ScrapeResult>>,
  stored: Map<string, StoredRow>,
  summaryCounts: Record<string, number>,
): Promise<{ groups: DedupGroup[] }> {
  try {
    const rawResults: Record<string, ScrapeResult> = { [BrokerName.ZABA]: zabaResult };
    const others = await Promise.all(
      [BrokerName.FPS, BrokerName.NPD, BrokerName.ANYWHO].map((b) => brokerPromises[b]),
    );

    for (const result of others) {
      rawResults[result.broker] = result;
      summaryCounts[result.broker] = result.summaries.length;
      // scrapeOne() already times its own fetch+parse per broker (see
      // ScrapeResult.timing_ms) -- reused here rather than re-timed.
      await logTiming(supabase, quickscanId, "summary_scan_broker", result.timing_ms, {
        broker: result.broker,
        resultCount: result.summaries.length,
        status: result.status,
        error: result.error,
      });

      if (result.summaries.length === 0) {
        await writePlaceholder(supabase, quickscanId, result);
        continue;
      }
      for (const summary of result.summaries) {
        const row = await writeSummary(supabase, quickscanId, summary);
        if (row) stored.set(candidateKey(summary), row);
      }
    }

    // No results from any target at all — the "no_data" terminal
    // outcome. Distinct from "rejected" (user turned down data that did
    // come back), which is a later, UI-driven write once the fallback
    // flow exists. Can only be decided here, now that all 4 brokers'
    // counts are known -- Zaba alone having 0 results doesn't mean
    // FPS/NPD/AnyWho will too (the frontend already handles an empty
    // zaba_candidates array as its own "no results" case regardless).
    const totalCandidates = Object.values(summaryCounts).reduce((a, b) => a + b, 0);

    // Cluster everything — no user pick exists yet, so this groups all
    // summaries on their own rather than matching against a reference.
    const groups = new DedupEngine().deduplicate(rawResults);
    let groupsStored = 0;

    for (const group of groups) {
      // deduplicate() gives every summary its own singleton group by
      // construction when nothing else matches it. A group with no
      // cross-broker corroboration isn't a "match" worth recording — its
      // member's match_group_id just stays NULL.
      if (group.members.length < 2) continue;

      const { data: groupRow, error: groupError } = await supabase
        .schema("quickscan")
        .from("match_groups")
        .insert({
          quickscans_id: quickscanId,
          confidence: averageScore(group),
          matched_on: {
            brokers: group.members.map((m) => m.summary.broker),
            age_conflict: group.age_conflict,
            age_note: group.age_note ?? null,
          },
        })
        .select("id")
        .single();

      if (groupError || !groupRow) {
        console.error(`✗ match_groups insert failed (scan=${quickscanId}): ${groupError?.message}`);
        continue;
      }

      groupsStored++;
      for (const member of group.members) {
        const row = stored.get(candidateKey(member.summary));
        if (!row) continue;
        const { error: linkError } = await supabase
          .schema("quickscan")
          .from(row.table)
          .update({ match_group_id: groupRow.id })
          .eq("id", row.id);
        if (linkError) {
          console.error(`✗ ${row.table} match_group_id update failed (id=${row.id}): ${linkError.message}`);
        }
      }
    }

    await supabase
      .schema("quickscan")
      .from("quickscans")
      .update({
        summary_result_counts: summaryCounts,
        status: "summary_scan_complete",
        ...(totalCandidates === 0 ? { match_outcome: "no_data" } : {}),
      })
      .eq("id", quickscanId);

    console.log(`✅ summary-scan ${quickscanId} finish: ${stored.size} candidates, ${groupsStored} match groups`);
    await logTiming(supabase, quickscanId, "summary_scan_background_total", Date.now() - functionStarted, { resultCount: stored.size });
    return { groups };
  } catch (err) {
    // Always land on a terminal status -- full-profile-scan polls for
    // 'summary_scan_complete' and would otherwise wait forever on a
    // background failure it never hears about.
    console.error(`✗ summary-scan finish failed (scan=${quickscanId}):`, err);
    await logTiming(supabase, quickscanId, "summary_scan_background_total", Date.now() - functionStarted, {
      status: "failed",
      error: (err as Error).message,
    });
    await supabase
      .schema("quickscan")
      .from("quickscans")
      .update({ status: "summary_scan_complete" })
      .eq("id", quickscanId);
    return { groups: [] };
  }
}

function candidateKey(summary: SummaryResult): string {
  return `${summary.broker}:${summary.result_id ?? ""}`;
}

function averageScore(group: DedupGroup): number {
  if (!group.members.length) return 0;
  const sum = group.members.reduce((total, m) => total + m.match_score, 0);
  return Math.round((sum / group.members.length) * 100) / 100;
}

async function writeSummary(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  summary: SummaryResult,
): Promise<StoredRow | null> {
  const { data, error } = await supabase
    .schema("quickscan")
    .from("summary_results")
    .insert({
      quickscans_id: quickscanId,
      target: summary.broker,
      profile_url: summary.profile_url || null,
      full_name: summary.full_name || null,
      age: summary.age ?? null,
      address: summary.address || null,
      phone: summary.phone || null,
      email: summary.email || null,
      aliases: summary.aliases || null,
      relatives: summary.relatives || null,
      previous_addresses: summary.previous_addresses || null,
      status: "success",
      raw: summary,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`✗ summary_results insert failed (${summary.broker}, scan=${quickscanId}): ${error?.message}`);
    return null;
  }
  return { table: "summary_results", id: data.id };
}

async function writeFullProfile(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  summary: SummaryResult,
): Promise<StoredRow | null> {
  // Wide normalized columns were dropped in 20260821140000 — full-profile-scan
  // fans this row's `raw` out into the per-type tables post-selection instead.
  const { data, error } = await supabase
    .schema("quickscan")
    .from("full_profile_results")
    .insert({
      quickscans_id: quickscanId,
      target: summary.broker,
      status: "success",
      raw: summary,
      // Zaba only; undefined for every other broker, which the column
      // being nullable already handles.
      birth_date: summary.birth_date || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`✗ full_profile_results insert failed (${summary.broker}, scan=${quickscanId}): ${error?.message}`);
    return null;
  }
  return { table: "full_profile_results", id: data.id };
}

/**
 * One row recording a broker attempt that returned zero candidates —
 * no_results or failed. Keeps every target visible on the scan even when it
 * found nothing, rather than being indistinguishable from "never ran".
 */
async function writePlaceholder(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  result: ScrapeResult,
): Promise<void> {
  const table = result.broker === BrokerName.ZABA ? "full_profile_results" : "summary_results";
  const { error } = await supabase
    .schema("quickscan")
    .from(table)
    .insert({
      quickscans_id: quickscanId,
      target: result.broker,
      status: result.status,
      raw: result.error ? { error: result.error } : null,
    });

  if (error) {
    console.error(`✗ ${table} placeholder insert failed (${result.broker}, scan=${quickscanId}): ${error.message}`);
  }
}
