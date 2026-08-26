/**
 * summary-scan — fetch raw broker summaries. Does not identify anyone.
 *
 * All four brokers start together. Zaba is awaited (its search page is already
 * person-shaped, so the picker can open). FPS/NPD/AnyWho finish in the
 * background. Nothing is grouped: matching happens after the user picks, in
 * full-profile-scan.
 *
 * Identification order is Zaba → FPS → AnyWho (NPD is never shown). If Zaba
 * is empty this waits on the others and returns FPS (then AnyWho) as the
 * first picker list. `listBroker` re-reads an already-written list so the
 * client can walk that order without re-scraping. `rejectAll` records that
 * the user turned down every shown card.
 *
 * Input: { quickscanId, listBroker?, rejectAll? }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeBrokersConcurrently } from "../_shared/quickscan/html-scrapers.ts";
import { logTiming } from "../_shared/quickscan/consolidation.ts";
import {
  BrokerName,
  type QuickScanInput,
  type ScrapeResult,
  type SummaryResult,
} from "../_shared/quickscan/quickscan-phase1-phase2-models.ts";

const IDENTIFY_BROKERS = [BrokerName.FPS, BrokerName.ANYWHO] as const;

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

    const listBroker = String(body.listBroker || body.list_broker || "").trim().toLowerCase();
    const rejectAll = Boolean(body.rejectAll || body.reject_all);

    const { data: quickscan, error: fetchError } = await supabase
      .schema("quickscan")
      .from("quickscans")
      .select("id, search_input, status")
      .eq("id", quickscanId)
      .maybeSingle();

    if (fetchError || !quickscan) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError?.message || "quickscan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (rejectAll) {
      await supabase
        .schema("quickscan")
        .from("quickscans")
        .update({ match_outcome: "rejected" })
        .eq("id", quickscanId);
      return new Response(
        JSON.stringify({ success: true, quickscan_id: quickscanId, match_outcome: "rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (listBroker) {
      const broker = listBroker === "zaba" || listBroker === "fps" || listBroker === "anywho"
        ? listBroker
        : "";
      if (!broker) {
        return new Response(
          JSON.stringify({ success: false, error: "listBroker must be zaba, fps, or anywho" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const ready = broker === "zaba"
        ? quickscan.status === "zaba_ready" || quickscan.status === "summary_scan_complete"
        : quickscan.status === "summary_scan_complete";
      if (!ready) {
        return new Response(
          JSON.stringify({ success: true, notReady: true, broker }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const candidates = await listCandidates(supabase, quickscanId, broker);
      return new Response(
        JSON.stringify({
          success: true,
          quickscan_id: quickscanId,
          broker,
          candidates,
          zaba_candidates: candidates,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotent: a retry after the scrape has started must not fire four
    // more context.dev calls. Return whatever list is already stored.
    if (quickscan.status === "zaba_ready" || quickscan.status === "summary_scan_complete") {
      const listed = await firstIdentifyList(supabase, quickscanId, quickscan.status);
      if (listed.notReady) {
        return new Response(
          JSON.stringify({ success: true, notReady: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          quickscan_id: quickscanId,
          broker: listed.broker,
          candidates: listed.candidates,
          zaba_candidates: listed.candidates,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    const stored = new Map<string, StoredRow>();
    const summaryCounts: Record<string, number> = { [BrokerName.ZABA]: zabaResult.summaries.length };
    const zabaCandidates: Record<string, unknown>[] = [];

    if (zabaResult.summaries.length === 0) {
      await writePlaceholder(supabase, quickscanId, zabaResult);
    } else {
      for (const summary of zabaResult.summaries) {
        const row = await writeFullProfile(supabase, quickscanId, summary);
        if (row) {
          stored.set(candidateKey(summary), row);
          zabaCandidates.push(toPickerCandidate(summary, row.id));
        }
      }
    }

    if (zabaResult.summaries.length > 0) {
      await supabase
        .schema("quickscan")
        .from("quickscans")
        .update({ status: "zaba_ready", deepest_page: "select_profile" })
        .eq("id", quickscanId);

      await logTiming(supabase, quickscanId, "summary_scan_response", Date.now() - functionStarted, { resultCount: stored.size });
      console.log(`✅ summary-scan ${quickscanId}: responding with ${zabaCandidates.length} Zaba candidates, FPS/NPD/AnyWho continuing in the background`);

      const backgroundWork = finishScan(supabase, quickscanId, functionStarted, zabaResult, brokerPromises, stored, summaryCounts);

      // deno-lint-ignore no-explicit-any
      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(backgroundWork);
      } else {
        await backgroundWork;
      }

      return new Response(
        JSON.stringify({
          success: true,
          quickscan_id: quickscanId,
          broker: BrokerName.ZABA,
          candidates: zabaCandidates,
          zaba_candidates: zabaCandidates,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`… summary-scan ${quickscanId}: Zaba found nothing, waiting on FPS/NPD/AnyWho for a fallback candidate list`);
    await finishScan(supabase, quickscanId, functionStarted, zabaResult, brokerPromises, stored, summaryCounts);

    const listed = await firstIdentifyList(supabase, quickscanId, "summary_scan_complete");
    await logTiming(supabase, quickscanId, "summary_scan_response", Date.now() - functionStarted, { resultCount: listed.candidates.length });
    console.log(`✅ summary-scan ${quickscanId}: Zaba empty, responding with ${listed.candidates.length} ${listed.broker} candidates`);

    return new Response(
      JSON.stringify({
        success: true,
        quickscan_id: quickscanId,
        broker: listed.broker,
        candidates: listed.candidates,
        zaba_candidates: listed.candidates,
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
 * their summary_results as raw rows, and always lands quickscans.status on
 * 'summary_scan_complete'. No clustering — the user has not identified
 * themselves yet.
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
): Promise<void> {
  try {
    const others = await Promise.all(
      [BrokerName.FPS, BrokerName.NPD, BrokerName.ANYWHO].map((b) => brokerPromises[b]),
    );

    for (const result of others) {
      summaryCounts[result.broker] = result.summaries.length;
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

    const totalCandidates = Object.values(summaryCounts).reduce((a, b) => a + b, 0);

    await supabase
      .schema("quickscan")
      .from("quickscans")
      .update({
        summary_result_counts: summaryCounts,
        status: "summary_scan_complete",
        ...(totalCandidates === 0 ? { match_outcome: "no_data" } : {}),
      })
      .eq("id", quickscanId);

    console.log(`✅ summary-scan ${quickscanId} finish: ${stored.size} candidates stored, no grouping`);
    await logTiming(supabase, quickscanId, "summary_scan_background_total", Date.now() - functionStarted, { resultCount: stored.size });
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
  }
}

function candidateKey(summary: SummaryResult): string {
  return `${summary.broker}:${summary.result_id ?? ""}`;
}

function toPickerCandidate(summary: SummaryResult, id: string): Record<string, unknown> {
  return {
    broker: summary.broker,
    name: summary.full_name,
    address: summary.address,
    age: summary.age,
    age_range: summary.age_range,
    phone: summary.phone,
    aliases: summary.aliases,
    relatives: summary.relatives,
    previous_addresses: summary.previous_addresses,
    result_id: id,
  };
}

function rowToPickerCandidate(
  broker: string,
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const name = String(row.full_name || raw.full_name || "").trim();
  if (!name) return null;
  return {
    broker,
    name,
    address: String(row.address || raw.address || ""),
    age: (row.age ?? raw.age) as number | undefined,
    age_range: String(raw.age_range || ""),
    phone: String(row.phone || raw.phone || ""),
    aliases: String(row.aliases || raw.aliases || ""),
    relatives: String(row.relatives || raw.relatives || ""),
    previous_addresses: String(row.previous_addresses || raw.previous_addresses || ""),
    result_id: String(row.id),
  };
}

async function listCandidates(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  broker: string,
): Promise<Record<string, unknown>[]> {
  const table = broker === BrokerName.ZABA ? "full_profile_results" : "summary_results";
  const { data, error } = await supabase
    .schema("quickscan")
    .from(table)
    .select("id, raw, status, target")
    .eq("quickscans_id", quickscanId)
    .eq("target", broker)
    .eq("status", "success");

  if (error) {
    console.error(`✗ listCandidates ${broker} failed (scan=${quickscanId}): ${error.message}`);
    return [];
  }

  const out: Record<string, unknown>[] = [];
  for (const row of data ?? []) {
    const candidate = rowToPickerCandidate(broker, row);
    if (candidate) out.push(candidate);
  }
  return out;
}

async function firstIdentifyList(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quickscanId: string,
  status: string,
): Promise<{ broker: string; candidates: Record<string, unknown>[]; notReady?: boolean }> {
  const zaba = await listCandidates(supabase, quickscanId, BrokerName.ZABA);
  if (zaba.length) return { broker: BrokerName.ZABA, candidates: zaba };

  if (status !== "summary_scan_complete") {
    return { broker: BrokerName.FPS, candidates: [], notReady: true };
  }

  for (const broker of IDENTIFY_BROKERS) {
    const candidates = await listCandidates(supabase, quickscanId, broker);
    if (candidates.length) return { broker, candidates };
  }
  return { broker: BrokerName.ZABA, candidates: [] };
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
