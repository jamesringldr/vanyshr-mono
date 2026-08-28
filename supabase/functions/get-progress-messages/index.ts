/**
 * get-progress-messages — read the progress log for one scan.
 *
 * Pre-auth, like summary-scan / full-profile-scan beside it: no session
 * exists at this point in the funnel, so the quickscanId uuid is the
 * capability. It is generated server-side on form submit and lives only in
 * the submitting browser's sessionStorage. The sibling functions accept the
 * same id with no auth and return full PII (names, addresses, phones,
 * relatives, emails); this one returns status strings and counts, so it does
 * not widen the surface those already established.
 *
 * Input: { quickscanId }.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quickscanId = String(body.quickscanId || body.quickscan_id || "").trim();
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

    const { data, error } = await supabase
      .schema("quickscan")
      .from("quickscan_progress")
      .select("id, message, step, created_at")
      .eq("quickscans_id", quickscanId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(`get-progress-messages failed (scan=${quickscanId}): ${error.message}`);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // An unknown id and a scan that has not logged anything yet are the same
    // empty list — the poller treats both as "nothing new," so there is no
    // need to distinguish them (and no oracle for probing ids).
    return new Response(
      JSON.stringify({ success: true, messages: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("get-progress-messages error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
