/**
 * Intro-scan submit — creates quickscan.quickscans before any scrape.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildSummaryUrls } from "../_shared/quickscan/summary-urls.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const firstName = String(body.firstName || body.first_name || "").trim();
    const lastName = String(body.lastName || body.last_name || "").trim();
    const zip = String(body.zip || body.zipCode || body.zipcode || "").replace(/\D/g, "").slice(0, 5);
    let city = String(body.city || "").trim();
    let state = String(body.state || "").trim();

    if (!firstName || !lastName || zip.length !== 5) {
      return new Response(
        JSON.stringify({ success: false, error: "firstName, lastName, and a 5-digit zip are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (!city || !state) {
      const { data: zipRow } = await supabase
        .from("zip_lookup")
        .select("city, state_code")
        .eq("zip", zip)
        .maybeSingle();
      city = city || zipRow?.city || "";
      state = state || zipRow?.state_code || "";
    }

    if (!city || !state) {
      return new Response(
        JSON.stringify({ success: false, error: `Could not resolve city/state for ZIP ${zip}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const search_input = {
      first_name: firstName,
      last_name: lastName,
      zip,
      city,
      state,
    };
    const summary_urls = buildSummaryUrls({
      first_name: firstName,
      last_name: lastName,
      city,
      state,
    });

    const { data, error } = await supabase
      .schema("quickscan")
      .from("quickscans")
      .insert({
        search_input,
        summary_urls,
        status: "created",
        deepest_page: "form",
        signup_status: "in_progress",
      })
      .select("id, session_id, time_sort, purge_after, search_input, summary_urls")
      .single();

    if (error || !data) {
      console.error("intro-scan insert failed:", error?.message);
      return new Response(
        JSON.stringify({ success: false, error: error?.message || "Insert failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, ...data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("intro-scan error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
