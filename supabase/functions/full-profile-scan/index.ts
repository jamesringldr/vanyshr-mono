/**
 * full-profile-scan — the intro-scan sequence's post-selection step.
 *
 * Triggered the instant quickscans.selected_full_profile_result_id is set
 * (always a Zaba row — see summary-scan). Fetches the FPS/NPD/AnyWho detail
 * pages for whichever summary_results share that Zaba row's match_group_id,
 * writes their full_profile_results rows, then fans every broker's data
 * (Zaba included) into the per-type tables and rebuilds
 * quickscan.consolidated_profile.
 *
 * Input: { quickscanId }. Not wired to the frontend yet.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { scrapeBrokerDetails, type BrokerDetailProfile } from "../_shared/quickscan/detail-scrapers.ts";
import { populateFromSummaryResult, populateFromBrokerDetail, buildConsolidatedProfile } from "../_shared/quickscan/consolidation.ts";
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

    const { data: quickscan, error: qsError } = await supabase
      .schema("quickscan")
      .from("quickscans")
      .select("id, selected_full_profile_result_id")
      .eq("id", quickscanId)
      .maybeSingle();

    if (qsError || !quickscan) {
      return new Response(
        JSON.stringify({ success: false, error: qsError?.message || "quickscan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const selectedId = pickedId || quickscan.selected_full_profile_result_id;
    if (!selectedId) {
      return new Response(
        JSON.stringify({ success: false, error: "no profile selected — pass fullProfileResultId or select first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const { data: zaba, error: zabaError } = await supabase
      .schema("quickscan")
      .from("full_profile_results")
      .select("id, match_group_id, raw")
      .eq("id", selectedId)
      .maybeSingle();

    if (zabaError || !zaba) {
      return new Response(
        JSON.stringify({ success: false, error: zabaError?.message || "selected full_profile_results row not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const zabaSummary = zaba.raw as SummaryResult;
    console.log(`🔍 full-profile-scan ${quickscanId}: ${zabaSummary?.full_name}, group=${zaba.match_group_id}`);

    // The matched fps/npd/anywho candidates from summary-scan, if any.
    let matchedCandidates: Row[] = [];
    if (zaba.match_group_id) {
      const { data } = await supabase
        .schema("quickscan")
        .from("summary_results")
        .select("*")
        .eq("match_group_id", zaba.match_group_id)
        .in("target", ["fps", "npd", "anywho"]);
      matchedCandidates = data ?? [];
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

    const details = members.length ? await scrapeBrokerDetails(members) : {};

    // Write the new full_profile_results rows and fan them into the per-type
    // tables. Zaba's already-existing row is fanned out here too — this is
    // the first time anything reads its data past the summary-scan write.
    const newRows: { fullProfileResultId: string; broker: BrokerName }[] = [];

    for (const candidate of matchedCandidates) {
      const detail = details[candidate.target];
      if (!detail) continue;

      const { data: row, error } = await supabase
        .schema("quickscan")
        .from("full_profile_results")
        .insert({
          quickscans_id: quickscanId,
          target: candidate.target,
          summary_result_id: candidate.id,
          match_group_id: zaba.match_group_id,
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
      await populateFromBrokerDetail(supabase, quickscanId, row.id, detail);
    }

    if (zabaSummary) {
      await populateFromSummaryResult(supabase, quickscanId, zaba.id, zabaSummary);
    }

    await buildConsolidatedProfile(supabase, quickscanId, zaba.match_group_id, {
      full_name: zabaSummary?.full_name,
      age: zabaSummary?.age,
    });

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

    return new Response(
      JSON.stringify({
        success: true,
        quickscan_id: quickscanId,
        brokers_scraped: newRows.map((r) => r.broker),
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
