/**
 * summary-scan — the intro-scan sequence's summary/full-scan step.
 *
 * Given an existing quickscan.quickscans row, runs the 4-broker parallel
 * search (scrapeAllBrokers — same context.dev path pilot-scan Phase 1 uses),
 * writes each candidate to a child table, then clusters everything into
 * quickscan.match_groups so a later selection (or "none of these"/no-Zaba
 * fallback) already has matched candidates to work from.
 *
 * Zaba bypasses summary_results entirely: its search results are already
 * full-profile-grade data, so they're written straight to
 * full_profile_results (summary_result_id left NULL). FPS/NPD/AnyWho write to
 * summary_results — their full-profile scrape is a later step, not this one.
 *
 * Input: { quickscanId }. Not wired to the frontend yet — call directly with
 * the id intro-scan returned.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeAllBrokers } from "../_shared/quickscan/html-scrapers.ts";
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

    const fetchStarted = Date.now();
    const rawResults = await scrapeAllBrokers(input);
    await logTiming(supabase, quickscanId, "summary_scan_fetch", Date.now() - fetchStarted, {
      resultCount: Object.values(rawResults as Record<string, ScrapeResult>).reduce((n, r) => n + r.summaries.length, 0),
    });

    // Write every candidate. Keyed by broker+result_id so the matching pass
    // below can turn a DedupGroup (in-memory SummaryResult objects) back into
    // row ids to stamp match_group_id onto.
    const stored = new Map<string, StoredRow>();
    const summaryCounts: Record<string, number> = {};
    // Zaba candidates for the frontend's selection modal — the only target
    // with full-profile-grade data at this point, so the only one worth
    // returning here. Shaped like the old pilot-scan ScanMember the modal
    // already knows how to render.
    const zabaCandidates: Record<string, unknown>[] = [];

    const writeStarted = Date.now();
    for (const result of Object.values(rawResults) as ScrapeResult[]) {
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
        const row = summary.broker === BrokerName.ZABA
          ? await writeFullProfile(supabase, quickscanId, summary)
          : await writeSummary(supabase, quickscanId, summary);
        if (row) stored.set(candidateKey(summary), row);
        if (row && summary.broker === BrokerName.ZABA) {
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
    await logTiming(supabase, quickscanId, "summary_scan_write", Date.now() - writeStarted, { resultCount: stored.size });

    // No results from any target at all — the "no_data" terminal outcome.
    // Distinct from "rejected" (user turned down data that did come back),
    // which is a later, UI-driven write once the fallback flow exists.
    const totalCandidates = Object.values(summaryCounts).reduce((a, b) => a + b, 0);

    await supabase
      .schema("quickscan")
      .from("quickscans")
      .update({
        summary_result_counts: summaryCounts,
        status: "summary_scan_complete",
        deepest_page: "select_profile",
        ...(totalCandidates === 0 ? { match_outcome: "no_data" } : {}),
      })
      .eq("id", quickscanId);

    // Cluster everything — no user pick exists yet. deduplicate() (unlike
    // matchReference, which needs a pick) groups all summaries on their own,
    // which is exactly the "already matched by the time the modal needs a
    // fallback" background pass this step exists for.
    const matchStarted = Date.now();
    const groups = new DedupEngine().deduplicate(rawResults);
    await logTiming(supabase, quickscanId, "match", Date.now() - matchStarted, { resultCount: groups.length });
    let groupsStored = 0;

    const matchWriteStarted = Date.now();
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
    await logTiming(supabase, quickscanId, "match_write", Date.now() - matchWriteStarted, { resultCount: groupsStored });

    console.log(`✅ summary-scan ${quickscanId}: ${stored.size} candidates, ${groupsStored} match groups`);
    await logTiming(supabase, quickscanId, "summary_scan_total", Date.now() - functionStarted, { resultCount: stored.size });

    return new Response(
      JSON.stringify({
        success: true,
        quickscan_id: quickscanId,
        summary_result_counts: summaryCounts,
        candidates_stored: stored.size,
        match_groups: groupsStored,
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
