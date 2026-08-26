/**
 * full-profile-scan — post-identify resolution + detail scrape.
 *
 * The pick is the reference. If the pick is FPS/AnyWho/NPD, its detail
 * page is scraped first so matching has phones/relatives the summary
 * didn't. Other brokers' already-stored summaries are scored against
 * that full profile (DedupEngine.matchReference). At most one hit per
 * broker above MERGE_THRESHOLD; a candidate that matches a rejected card
 * better than the pick is dropped. Unresolved brokers are not scraped.
 *
 * Zaba's search page is already full-profile-grade — reuse that row.
 * Then fan into per-type tables and rebuild consolidated_profile.
 *
 * Input: { quickscanId, fullProfileResultId, rejected? }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeBrokerDetails, detailToSummary, type BrokerDetailProfile } from "../_shared/quickscan/detail-scrapers.ts";
import { populateFromSummaryResult, populateFromBrokerDetail, buildConsolidatedProfile, logTiming, exposedFieldsFromDetail, exposedFieldsFromSummary } from "../_shared/quickscan/consolidation.ts";
import { DedupEngine } from "../_shared/quickscan/DedupEngine.ts";
import { BrokerName, type DedupMember, type SummaryResult } from "../_shared/quickscan/quickscan-phase1-phase2-models.ts";

// deno-lint-ignore no-explicit-any
type Row = any;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quickscanId = String(body.quickscanId || body.quickscan_id || body.id || "").trim();
    // The zaba full_profile_results row id the user picked in the modal.
    // Accepted here rather than requiring a separate "select" call first —
    // one round trip instead of two.
    const pickedId = String(body.fullProfileResultId || body.selectedFullProfileResultId || "").trim();
    const rejectedInput = Array.isArray(body.rejected) ? body.rejected : [];
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

    const functionStarted = Date.now();

    const { data: quickscan, error: qsError } = await supabase
      .schema("quickscan")
      .from("quickscans")
      .select("id, status, selected_full_profile_result_id, selected_summary_result_id")
      .eq("id", quickscanId)
      .maybeSingle();

    if (qsError || !quickscan) {
      return new Response(
        JSON.stringify({ success: false, error: qsError?.message || "quickscan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // summary-scan responds as soon as FPS resolves and keeps AnyWho/Zaba/NPD
    // in the background (status 'identify_ready' until that finishes,
    // 'summary_scan_complete' once it does — always one or the other, even
    // on a background failure, so this can't wait forever). The user can
    // click "pick" before that background pass is done; rather than proceed
    // with an incomplete match or block the pick button, this says so
    // cheaply and the frontend just retries.
    if (quickscan.status !== "summary_scan_complete") {
      return new Response(
        JSON.stringify({ success: true, notReady: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const selectedId = pickedId || quickscan.selected_full_profile_result_id || quickscan.selected_summary_result_id;
    if (!selectedId) {
      return new Response(
        JSON.stringify({ success: false, error: "no profile selected — pass fullProfileResultId or select first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The pick is usually an FPS summary_results row (FPS-first picker).
    // Zaba picks land on full_profile_results because that search page is
    // already full-profile-grade. Try full_profile_results first so a Zaba
    // fallback pick still resolves, then summary_results.
    const { data: zaba } = await supabase
      .schema("quickscan")
      .from("full_profile_results")
      .select("id, match_group_id, raw")
      .eq("id", selectedId)
      .maybeSingle();

    let matchGroupId: string | null = null;
    let zabaSummary: SummaryResult | undefined;
    let zabaRowId: string | undefined;
    let fallbackPick: Row | null = null;
    // Which field types each individual broker exposed — for the Brokers
    // page, which shows each broker's own listing rather than the merged
    // consolidated_profile.
    const brokerFields: Record<string, string[]> = {};

    if (zaba) {
      matchGroupId = zaba.match_group_id;
      zabaSummary = summaryFromRaw(BrokerName.ZABA, zaba.id, zaba.raw);
      zabaRowId = zaba.id;
      brokerFields.zaba = exposedFieldsFromSummary(zabaSummary);
      if (pickedId && pickedId !== quickscan.selected_full_profile_result_id) {
        const { error: selectError } = await supabase
          .schema("quickscan")
          .from("quickscans")
          .update({ selected_full_profile_result_id: pickedId, match_outcome: "matched" })
          .eq("id", quickscanId);
        if (selectError) {
          return new Response(
            JSON.stringify({ success: false, error: `Could not record selection: ${selectError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } else {
      const { data: picked, error: pickedError } = await supabase
        .schema("quickscan")
        .from("summary_results")
        .select("*")
        .eq("id", selectedId)
        .maybeSingle();

      if (pickedError || !picked) {
        return new Response(
          JSON.stringify({ success: false, error: pickedError?.message || "selected result not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      fallbackPick = picked;
      matchGroupId = picked.match_group_id;
      if (pickedId && pickedId !== quickscan.selected_summary_result_id) {
        const { error: selectError } = await supabase
          .schema("quickscan")
          .from("quickscans")
          .update({ selected_summary_result_id: pickedId, match_outcome: "matched" })
          .eq("id", quickscanId);
        if (selectError) {
          return new Response(
            JSON.stringify({ success: false, error: `Could not record selection: ${selectError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    let pickSummary: SummaryResult | undefined = zabaSummary ?? (
      fallbackPick
        ? summaryFromRaw(fallbackPick.target as BrokerName, fallbackPick.id, fallbackPick.raw, fallbackPick)
        : undefined
    );

    if (!pickSummary) {
      return new Response(
        JSON.stringify({ success: false, error: "could not load the selected profile" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`🔍 full-profile-scan ${quickscanId}: ${pickSummary.full_name}, resolving against pick`);

    const { data: allSummaries } = await supabase
      .schema("quickscan")
      .from("summary_results")
      .select("*")
      .eq("quickscans_id", quickscanId)
      .eq("status", "success");

    const { data: allZaba } = await supabase
      .schema("quickscan")
      .from("full_profile_results")
      .select("*")
      .eq("quickscans_id", quickscanId)
      .eq("target", "zaba")
      .eq("status", "success");

    const candidatesByBroker: Record<string, SummaryResult[]> = {
      [BrokerName.FPS]: [],
      [BrokerName.NPD]: [],
      [BrokerName.ANYWHO]: [],
      [BrokerName.ZABA]: [],
    };
    const summaryById = new Map<string, Row>();
    const zabaById = new Map<string, Row>();

    for (const row of allSummaries ?? []) {
      const s = summaryFromRaw(row.target as BrokerName, row.id, row.raw, row);
      candidatesByBroker[row.target]?.push(s);
      summaryById.set(row.id, row);
    }
    for (const row of allZaba ?? []) {
      const s = summaryFromRaw(BrokerName.ZABA, row.id, row.raw);
      candidatesByBroker[BrokerName.ZABA].push(s);
      zabaById.set(row.id, row);
    }

    const rejected = rejectedInput
      .filter((c: Row) => c && typeof c === "object")
      .map((c: Row) => pickerToSummary(c));

    // FPS/AnyWho/NPD summaries are thin (FPS has no phone). Scrape the pick
    // first so matchReference has the full profile, then score the others.
    const prefetched: Record<string, BrokerDetailProfile> = {};
    if (!zabaSummary && pickSummary.profile_url) {
      const { profiles, timings } = await scrapeBrokerDetails([{
        summary: pickSummary,
        match_score: 100,
      }]);
      for (const [broker, timing] of Object.entries(timings)) {
        await logTiming(supabase, quickscanId, "full_profile_fetch", timing.timingMs, { broker, status: timing.status });
      }
      const detail = profiles[pickSummary.broker] as BrokerDetailProfile | undefined;
      if (detail) {
        prefetched[pickSummary.broker] = detail;
        pickSummary = detailToSummary(
          pickSummary.broker,
          pickSummary.result_id || String(fallbackPick?.id || ""),
          detail,
          pickSummary,
        );
        brokerFields[pickSummary.broker] = exposedFieldsFromDetail(detail);
      }
    }

    const resolved = pickSummary
      ? new DedupEngine().matchReference(pickSummary, candidatesByBroker, rejected)
      : [];

    const { data: groupRow, error: groupError } = await supabase
      .schema("quickscan")
      .from("match_groups")
      .insert({
        quickscans_id: quickscanId,
        confidence: resolved.length
          ? resolved.reduce((s, r) => s + r.match_score, 0) / resolved.length
          : 100,
        matched_on: {
          reference: pickSummary?.broker ?? null,
          brokers: [pickSummary?.broker, ...resolved.map((r) => r.broker)].filter(Boolean),
        },
      })
      .select("id")
      .single();

    if (groupError || !groupRow) {
      console.error(`✗ match_groups insert failed (scan=${quickscanId}): ${groupError?.message}`);
    } else {
      matchGroupId = groupRow.id;
      const stamp = async (table: string, id: string) => {
        const { error } = await supabase.schema("quickscan").from(table).update({ match_group_id: matchGroupId }).eq("id", id);
        if (error) console.error(`✗ ${table} match_group_id update failed (id=${id}): ${error.message}`);
      };
      if (zabaRowId) await stamp("full_profile_results", zabaRowId);
      if (fallbackPick) await stamp("summary_results", fallbackPick.id);
      for (const r of resolved) {
        if (r.broker === BrokerName.ZABA) await stamp("full_profile_results", r.summary.result_id || "");
        else await stamp("summary_results", r.summary.result_id || "");
      }
    }

    const matchedCandidates: Row[] = [];
    const seen = new Set<string>();
    const addSummaryRow = (row: Row | undefined) => {
      if (!row?.id || seen.has(row.id) || !row.profile_url) return;
      seen.add(row.id);
      matchedCandidates.push(row);
    };

    if (fallbackPick) addSummaryRow(fallbackPick);
    for (const r of resolved) {
      if (r.broker === BrokerName.ZABA) {
        const row = zabaById.get(r.summary.result_id || "");
        if (row && !zabaSummary) {
          zabaSummary = summaryFromRaw(BrokerName.ZABA, row.id, row.raw);
          zabaRowId = row.id;
          brokerFields.zaba = exposedFieldsFromSummary(zabaSummary);
        }
        continue;
      }
      addSummaryRow(summaryById.get(r.summary.result_id || ""));
    }

    const members: DedupMember[] = matchedCandidates
      .filter((c) => c.profile_url && !prefetched[c.target])
      .map((c) => ({
        summary: summaryFromRaw(c.target as BrokerName, c.id, c.raw, c),
        match_score: 100,
      }));

    const { profiles: scraped, timings: fetchTimings } = members.length
      ? await scrapeBrokerDetails(members)
      : { profiles: {} as Record<string, unknown>, timings: {} as Record<string, { timingMs: number; status: string }> };

    for (const [broker, timing] of Object.entries(fetchTimings)) {
      await logTiming(supabase, quickscanId, "full_profile_fetch", timing.timingMs, { broker, status: timing.status });
    }

    const details: Record<string, unknown> = { ...scraped, ...prefetched };

    // Write the new full_profile_results rows and fan them into the per-type
    // tables. Zaba's already-existing row is fanned out here too — this is
    // the first time anything reads its data past the summary-scan write.
    const newRows: { fullProfileResultId: string; broker: BrokerName }[] = [];

    for (const candidate of matchedCandidates) {
      const detail = details[candidate.target];
      if (!detail) continue;
      brokerFields[candidate.target] = exposedFieldsFromDetail(detail as BrokerDetailProfile);

      const { data: row, error } = await supabase
        .schema("quickscan")
        .from("full_profile_results")
        .insert({
          quickscans_id: quickscanId,
          target: candidate.target,
          summary_result_id: candidate.id,
          match_group_id: matchGroupId,
          status: "success",
          raw: detail,
          // AnyWho only; undefined for every other broker, which the
          // columns being nullable already handles. detail comes back as
          // Record<string, unknown> from scrapeBrokerDetails() -- cast to
          // read its actual (all-optional) BrokerDetailProfile shape, same
          // as populateFromBrokerDetail(..., detail) below already assumes
          // structurally without needing the cast (every field there is
          // optional, so {} satisfies it; reading a named property does not).
          legal_records_county: (detail as BrokerDetailProfile).legalRecords?.countyRecords?.location ?? null,
          legal_records_county_count: (detail as BrokerDetailProfile).legalRecords?.countyRecords?.count ?? null,
          legal_records_nationwide_count: (detail as BrokerDetailProfile).legalRecords?.nationwideCount ?? null,
        })
        .select("id")
        .single();

      if (error || !row) {
        console.error(`✗ full_profile_results insert failed (${candidate.target}, scan=${quickscanId}): ${error?.message}`);
        continue;
      }
      newRows.push({ fullProfileResultId: row.id, broker: candidate.target });

      // The per-field select-then-insert loop (see consolidation.ts) --
      // timed separately from the fetch above so fetch-vs-write is directly
      // comparable per broker.
      const populateStarted = Date.now();
      await populateFromBrokerDetail(supabase, quickscanId, row.id, detail);
      await logTiming(supabase, quickscanId, "full_profile_populate", Date.now() - populateStarted, { broker: candidate.target });
    }

    if (zabaSummary && zabaRowId) {
      const populateStarted = Date.now();
      await populateFromSummaryResult(supabase, quickscanId, zabaRowId, zabaSummary);
      await logTiming(supabase, quickscanId, "full_profile_populate", Date.now() - populateStarted, { broker: "zaba" });
    }

    const rollupStarted = Date.now();
    await buildConsolidatedProfile(supabase, quickscanId, matchGroupId, {
      full_name: zabaSummary?.full_name ?? fallbackPick?.full_name,
      age: zabaSummary?.age ?? fallbackPick?.age,
    });
    await logTiming(supabase, quickscanId, "rollup", Date.now() - rollupStarted);

    await supabase
      .schema("quickscan")
      .from("quickscans")
      .update({ status: "full_profile_scan_complete", deepest_page: "full_profile" })
      .eq("id", quickscanId);

    // Returned inline rather than making the frontend read it back separately —
    // this is the data the email-confirmation step needs next.
    const { data: consolidatedProfile } = await supabase
      .schema("quickscan")
      .from("consolidated_profile")
      .select("*")
      .eq("quickscans_id", quickscanId)
      .maybeSingle();

    console.log(`✅ full-profile-scan ${quickscanId}: ${newRows.length} broker profiles fetched`);
    await logTiming(supabase, quickscanId, "full_profile_scan_total", Date.now() - functionStarted, { resultCount: newRows.length });

    return new Response(
      JSON.stringify({
        success: true,
        quickscan_id: quickscanId,
        brokers_scraped: newRows.map((r) => r.broker),
        broker_fields: brokerFields,
        consolidated_profile: consolidatedProfile,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("full-profile-scan error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asAge(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function summaryFromRaw(
  broker: BrokerName,
  id: string,
  raw: unknown,
  row?: Row,
): SummaryResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    broker,
    full_name: asString(r.full_name || row?.full_name),
    address: asString(r.address || row?.address || row?.current_address),
    age_range: asString(r.age_range || (row?.age != null ? String(row.age) : "")),
    age: asAge(r.age) ?? asAge(row?.age),
    location: asString(r.location || r.address || row?.address),
    profile_url: asString(r.profile_url || row?.profile_url),
    result_id: id,
    phone: asString(r.phone || row?.phone),
    email: asString(r.email || row?.email),
    aliases: asString(r.aliases || row?.aliases),
    relatives: asString(r.relatives || row?.relatives),
    previous_addresses: asString(r.previous_addresses || row?.previous_addresses),
  };
}

function pickerToSummary(c: Row): SummaryResult {
  const broker = (asString(c.broker) || BrokerName.ZABA) as BrokerName;
  return summaryFromRaw(broker, asString(c.result_id || c.id), {
    full_name: c.name || c.full_name,
    address: c.address,
    age: c.age,
    age_range: c.age_range,
    phone: c.phone,
    aliases: c.aliases,
    relatives: c.relatives,
    previous_addresses: c.previous_addresses,
    profile_url: c.profile_url,
  });
}
