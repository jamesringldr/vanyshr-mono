import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { quickscanId } = await req.json();
    if (!quickscanId) {
      return new Response(
        JSON.stringify({ success: false, error: "quickscanId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the scan exists and get its ownership info
    const { data: scan, error: scanError } = await serviceRoleSupabase
      .schema("quickscan")
      .from("quickscans")
      .select("id, created_by")
      .eq("id", quickscanId)
      .maybeSingle();

    if (scanError || !scan) {
      console.warn(`Scan not found: ${quickscanId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Scan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For authenticated scans: verify ownership. Anonymous scans are accessible to anyone with the ID.
    let currentUserId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && scan.created_by) {
      // Only verify auth if scan has a creator (authenticated scan)
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        }
      );

      const { data: { user }, error: userError } = await userSupabase.auth.getUser();
      if (userError || !user) {
        console.warn(`Auth failed for authenticated scan ${quickscanId}`);
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      currentUserId = user.id;

      // Verify ownership for authenticated scans
      if (scan.created_by !== currentUserId) {
        console.warn(`Unauthorized access to scan ${quickscanId} by user ${currentUserId}`);
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Anonymous scans (created_by is null) are accessible to anyone with the ID

    // Fetch progress messages
    const { data, error } = await serviceRoleSupabase
      .schema("quickscan")
      .from("quickscan_progress")
      .select("id, message, step, created_at")
      .eq("quickscans_id", quickscanId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(`get-progress-messages error for ${quickscanId}:`, error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messages: data || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-progress-messages error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
