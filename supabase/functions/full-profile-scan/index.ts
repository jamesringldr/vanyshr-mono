/**
 * full-profile-scan — the intro-scan sequence's post-selection step.
 *
 * Triggered once the user picks a candidate in the selection modal. Usually
 * that's a Zaba full_profile_results row (Zaba's search results are already
 * full-profile-grade — see summary-scan). But when Zaba found nothing for a
 * scan, summary-scan falls back to offering fps/npd/anywho's own matched
 * summary_results as candidates instead — so the pick can be either kind of
 * row; both are tried below. Fetches the FPS/NPD/AnyWho detail pages for
 * whichever summary_results share the pick's match_group_id (or, for a
 * fallback pick with no cross-broker match, just the pick itself), writes
 * their full_profile_results rows, then fans every broker's data into the
 * per-type tables and rebuilds quickscan.consolidated_profile.
 *
 * Input: { quickscanId }. Not wired to the frontend yet.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeBrokerDetails, type BrokerDetailProfile } from "../_shared/quickscan/detail-scrapers.ts";
import { populateFromSummaryResult, populateFromBrokerDetail, buildConsolidatedProfile, logTiming, exposedFieldsFromDetail, exposedFieldsFromSummary } from "../_shared/quickscan/consolidation.ts";
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

    // summary-scan responds as soon as Zaba resolves and keeps matching
    // FPS/NPD/AnyWho in the background (status 'zaba_ready' until that
    // finishes, 'summary_scan_complete' once it does — always one or the
    // other, even on a background failure, so this can't wait forever).
    // The user can click "pick" before that background pass is done; rather
    // than proceed with an incomplete match or block the pick button, this
    // says so cheaply and the frontend just retries.
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

    // The pick is usually a Zaba full_profile_results row -- try that first,
    // the overwhelmingly common case. Falls back to summary_results when
    // Zaba found nothing for this scan and the modal offered an fps/npd/
    // anywho candidate instead (see summary-scan's zaba-empty fallback path).
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
      zabaSummary = zaba.raw as SummaryResult;
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

    console.log(`🔍 full-profile-scan ${quickscanId}: ${zabaSummary?.full_name ?? fallbackPick?.full_name}, group=${matchGroupId}`);

    // The matched fps/npd/anywho candidates from summary-scan. A fallback
    // pick with no cross-broker match is its own sole candidate -- still
    // needs its own detail scrape, same as a matched one would.
    let matchedCandidates: Row[] = [];
    if (matchGroupId) {
      const { data } = await supabase
        .schema("quickscan")
        .from("summary_results")
        .select("*")
        .eq("match_group_id", matchGroupId)
        .in("target", ["fps", "npd", "anywho"]);
      matchedCandidates = data ?? [];
    } else if (fallbackPick) {
      matchedCandidates = [fallbackPick];
    }

    const members: DedupMember[] = matchedCandidates
      .filter((c) => c.profile_url)
      .map((c) => ({
        summary: {
          broker: c.target as BrokerName,
          full_name: c.full_name || "",
          address: c.address || "",
          age_range: c.age != null ? String(c.age) : "",
          age: c.age ?? undefined,
          location: c.address || "",
          profile_url: c.profile_url,
          result_id: c.id,
        } as SummaryResult,
        match_score: 100,
      }));

    const { profiles: details, timings: fetchTimings } = members.length
      ? await scrapeBrokerDetails(members)
      : { profiles: {} as Record<string, unknown>, timings: {} as Record<string, { timingMs: number; status: string }> };

    for (const [broker, timing] of Object.entries(fetchTimings)) {
      await logTiming(supabase, quickscanId, "full_profile_fetch", timing.timingMs, { broker, status: timing.status });
    }

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
