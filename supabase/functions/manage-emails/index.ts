/**
 * manage-emails — the intro-scan email confirmation step.
 *
 * action "add"/"remove": toggle an email in/out of quickscan.emails and sync
 * consolidated_profile.emails immediately — cheap, no scraping.
 *
 * action "confirm": the trigger for Holehe + Leakcheck. Skips any email that
 * already has a successful result (so re-confirming doesn't re-spend API
 * calls), then updates consolidated_profile's services_found/breaches/
 * breach_count.
 *
 * `emails` narrows what confirm scans without changing what the profile
 * holds. A quickscan surfaces every address the brokers listed, but only the
 * few the user picks get run through Holehe and Leakcheck — being scanned and
 * being the user's are different questions, and `confirmed` only answers the
 * second. Omit it and every confirmed address is scanned, as before.
 *
 * Input: { quickscanId, action, email?, emails? }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { normalizeEmail, isValidEmail } from "../_shared/quickscan/email-extractor.ts";
import { checkMxRecord, syncConfirmedEmails, logTiming } from "../_shared/quickscan/consolidation.ts";
import { enrichMultipleEmails as enrichWithHolehe } from "../_shared/quickscan/holehe-enricher.ts";
import { enrichMultipleEmails as enrichWithLeakcheck } from "../_shared/quickscan/leakcheck-enricher.ts";

// deno-lint-ignore no-explicit-any
type Row = any;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quickscanId = String(body.quickscanId || body.quickscan_id || "").trim();
    const action = String(body.action || "").trim();

    if (!quickscanId || !["add", "remove", "confirm"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "quickscanId and a valid action (add/remove/confirm) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (action === "add") return await handleAdd(supabase, corsHeaders, quickscanId, String(body.email || ""));
    if (action === "remove") return await handleRemove(supabase, corsHeaders, quickscanId, String(body.email || ""));
    const scanOnly = Array.isArray(body.emails)
      ? body.emails.map((e: unknown) => normalizeEmail(String(e ?? ""))).filter(Boolean)
      : null;
    return await handleConfirm(supabase, corsHeaders, quickscanId, scanOnly);
  } catch (error) {
    console.error("manage-emails error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleAdd(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  corsHeaders: Record<string, string>,
  quickscanId: string,
  email: string,
) {
  if (!isValidEmail(email)) {
    return new Response(
      JSON.stringify({ success: false, error: "invalid email" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const normalized = normalizeEmail(email);

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("emails")
    .select("id")
    .eq("quickscans_id", quickscanId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .maybeSingle();

  if (existing) {
    await supabase.schema("quickscan").from("emails").update({ confirmed: true }).eq("id", existing.id);
  } else {
    // Same rule as broker-sourced rows: a user typing in a dead domain is
    // exactly the noise this check exists to catch, self-inflicted or not.
    const mxValid = await checkMxRecord(normalized);
    const { error } = await supabase.schema("quickscan").from("emails").insert({
      quickscans_id: quickscanId,
      source: "user",
      raw_value: email.trim(),
      normalized_value: normalized,
      mx_valid: mxValid,
      confirmed: mxValid !== false,
    });
    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  await syncConfirmedEmails(supabase, quickscanId);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleRemove(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  corsHeaders: Record<string, string>,
  quickscanId: string,
  email: string,
) {
  const normalized = normalizeEmail(email);
  await supabase
    .schema("quickscan")
    .from("emails")
    .update({ confirmed: false })
    .eq("quickscans_id", quickscanId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null);

  await syncConfirmedEmails(supabase, quickscanId);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleConfirm(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  corsHeaders: Record<string, string>,
  quickscanId: string,
  scanOnly: string[] | null = null,
) {
  const { data: profile } = await supabase
    .schema("quickscan")
    .from("consolidated_profile")
    .select("emails")
    .eq("quickscans_id", quickscanId)
    .maybeSingle();

  const profileEmails: string[] = profile?.emails ?? [];
  // Intersect rather than trust the caller's list outright: an address that
  // is not on the profile was never confirmed for this scan, and confirm is
  // what spends the Holehe/Leakcheck budget.
  const confirmedEmails = scanOnly
    ? profileEmails.filter((e) => scanOnly.includes(normalizeEmail(e)))
    : profileEmails;

  if (!confirmedEmails.length) {
    return new Response(
      JSON.stringify({ success: true, message: "no confirmed emails to check" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Don't re-spend API calls on an email that already has a successful result.
  const [{ data: existingHolehe }, { data: existingLeakcheck }] = await Promise.all([
    supabase.schema("quickscan").from("holehe_results").select("email").eq("quickscans_id", quickscanId).eq("status", "success"),
    supabase.schema("quickscan").from("leakcheck_results").select("email").eq("quickscans_id", quickscanId).eq("status", "success"),
  ]);
  const doneHolehe = new Set(((existingHolehe ?? []) as Row[]).map((r) => r.email));
  const doneLeakcheck = new Set(((existingLeakcheck ?? []) as Row[]).map((r) => r.email));

  const toHolehe = confirmedEmails.filter((e) => !doneHolehe.has(e));
  const toLeakcheck = confirmedEmails.filter((e) => !doneLeakcheck.has(e));

  // Run concurrently but time each independently -- Promise.all only
  // resolves once both are done, so timing around the combined call would
  // attribute the slower one's wait to both.
  async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
    const started = Date.now();
    const result = await fn();
    return { result, ms: Date.now() - started };
  }

  const [holeheTimed, leakcheckTimed] = await Promise.all([
    timed(() => (toHolehe.length ? enrichWithHolehe(toHolehe) : Promise.resolve([]))),
    timed(() => (toLeakcheck.length ? enrichWithLeakcheck(toLeakcheck) : Promise.resolve([]))),
  ]);
  const holeheResults = holeheTimed.result;
  const leakcheckResults = leakcheckTimed.result;
  await logTiming(supabase, quickscanId, "holehe", holeheTimed.ms, { resultCount: toHolehe.length });
  await logTiming(supabase, quickscanId, "leakcheck", leakcheckTimed.ms, { resultCount: toLeakcheck.length });

  if (holeheResults.length) {
    await supabase.schema("quickscan").from("holehe_results").insert(
      holeheResults.map((r) => ({
        quickscans_id: quickscanId,
        email: r.email,
        status: r.status,
        services_found: r.services,
        services_checked: r.services_checked,
        error: r.error ?? null,
      })),
    );
  }
  if (leakcheckResults.length) {
    await supabase.schema("quickscan").from("leakcheck_results").insert(
      leakcheckResults.map((r) => ({
        quickscans_id: quickscanId,
        email: r.email,
        status: r.status,
        breaches: r.breaches,
        breach_count: r.breach_count,
        fields_exposed: r.fields_exposed,
        error: r.error ?? null,
      })),
    );
  }

  // Rebuild the aggregate off everything on record for this scan, not just
  // this call's batch, so a second confirm doesn't drop earlier results.
  const [{ data: allHolehe }, { data: allLeakcheck }] = await Promise.all([
    supabase.schema("quickscan").from("holehe_results").select("services_found").eq("quickscans_id", quickscanId).eq("status", "success"),
    supabase.schema("quickscan").from("leakcheck_results").select("email, breaches, fields_exposed").eq("quickscans_id", quickscanId).eq("status", "success"),
  ]);
  const servicesFound = [...new Set(((allHolehe ?? []) as Row[]).flatMap((r) => r.services_found ?? []))];
  // Grouped by email (not flattened) -- the risk-summary "Critical" area
  // shows one container per breached email, since that's the actual
  // Leakcheck query unit: fields_exposed is a per-email aggregate, not
  // attributable to any one breach source within it.
  const breachesByEmail = ((allLeakcheck ?? []) as Row[])
    .filter((r) => (r.breaches ?? []).length > 0)
    .map((r) => ({ email: r.email, breaches: r.breaches ?? [], fields_exposed: r.fields_exposed ?? [] }));
  const breachCount = breachesByEmail.reduce((sum, e) => sum + e.breaches.length, 0);

  // select() back so the frontend can refresh its cached copy (the pick-time
  // snapshot it's been holding has none of this — see loading.tsx) without a
  // second round trip.
  const { data: consolidatedProfile } = await supabase
    .schema("quickscan")
    .from("consolidated_profile")
    .update({ services_found: servicesFound, breaches: breachesByEmail, breach_count: breachCount })
    .eq("quickscans_id", quickscanId)
    .select("*")
    .maybeSingle();

  // Confirm is the last step before the report — the funnel watermark moves
  // here, not on page navigation, since that's still a client-side event and
  // this is the service-role write that's allowed to make it.
  await supabase
    .schema("quickscan")
    .from("quickscans")
    .update({ deepest_page: "report" })
    .eq("id", quickscanId);

  console.log(`✅ manage-emails confirm ${quickscanId}: ${toHolehe.length} holehe, ${toLeakcheck.length} leakcheck checked`);

  return new Response(
    JSON.stringify({
      success: true,
      holehe_checked: toHolehe.length,
      leakcheck_checked: toLeakcheck.length,
      services_found: servicesFound,
      breach_count: breachCount,
      consolidated_profile: consolidatedProfile ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
