import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Service role client — required to call SECURITY DEFINER function
    // and write to user_profiles without an authenticated session.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { scan_id, email, source } = await req.json();

    if (!scan_id) {
      return new Response(
        JSON.stringify({ success: false, error: "scan_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolvedEmail =
      typeof email === "string" && email.trim() ? email.trim() : null;

    if (!resolvedEmail) {
      const { data: scanRow } = await supabaseClient
        .from("quick_scans")
        .select("email")
        .eq("id", scan_id)
        .maybeSingle();
      if (scanRow?.email && String(scanRow.email).trim()) {
        resolvedEmail = String(scanRow.email).trim();
      }
    }

    console.log(`🧩 create-pending-profile: scan_id=${scan_id} email=${resolvedEmail ?? "(none)"}`);

    const profileSource =
      typeof source === "string" && ["invite", "quickscan"].includes(source)
        ? source
        : "quickscan";

    const { data, error } = await supabaseClient
      .rpc("create_pending_profile", {
        p_scan_id: scan_id,
        p_email:   resolvedEmail,
        p_source:  profileSource,
      });

    if (error) {
      console.error("❌ create_pending_profile error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.success) {
      return new Response(
        JSON.stringify({ success: false, error: data?.error ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Pending profile created: profile_id=${data.profile_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: data.profile_id,
        scan_id: data.scan_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ create-pending-profile error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
