/**
 * admin-send-invite — Send magic link OTP to invited user for admin invite flow
 *
 * Env vars consumed:
 *   - ADMIN_PARSE_SECRET: x-admin-secret header validation
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role API key for RPC + admin auth
 *   - SITE_URL: Magic link redirect base (e.g. https://app.vanyshr.com or Vercel preview URL)
 *
 * Example requests:
 *
 * Success:
 *   curl -X POST http://localhost:54321/functions/v1/admin-send-invite \
 *     -H "Content-Type: application/json" \
 *     -H "x-admin-secret: your-secret" \
 *     -d '{"scan_id":"<uuid>","email":"user@example.com"}'
 *   Response: {"success":true,"profile_id":"<uuid>","message":"Invite sent","existing":false}
 *
 * Auth failure:
 *   curl -X POST http://localhost:54321/functions/v1/admin-send-invite \
 *     -H "Content-Type: application/json" \
 *     -H "x-admin-secret: wrong-secret" \
 *     -d '{"scan_id":"<uuid>","email":"user@example.com"}'
 *   Response: {"success":false,"error":"Unauthorized"} (401)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

interface AdminSendInviteRequest {
  scan_id: string;
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate admin secret header
    const adminSecret = Deno.env.get("ADMIN_PARSE_SECRET");
    if (adminSecret) {
      const provided = req.headers.get("x-admin-secret");
      if (provided !== adminSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse and validate request body
    const body: AdminSendInviteRequest = await req.json();
    const { scan_id, email } = body;

    if (!scan_id || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "scan_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize service role client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch scan to validate it exists and has profile_data
    const { data: scan, error: scanError } = await supabaseClient
      .from("quick_scans")
      .select("id, status, profile_data, converted_to_user_id, invited_email")
      .eq("id", scan_id)
      .maybeSingle();

    if (scanError) {
      console.error("Error fetching scan:", scanError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch scan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!scan) {
      return new Response(
        JSON.stringify({ success: false, error: "Scan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate scan status and profile_data
    const validStatuses = ["admin_sent", "pending_signup"];
    if (!validStatuses.includes(scan.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Scan status must be admin_sent or pending_signup, got ${scan.status}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!scan.profile_data) {
      return new Response(
        JSON.stringify({ success: false, error: "Scan has no profile_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Update quick_scans with normalized invited_email and invited_at
    const { error: updateScanError } = await supabaseClient
      .from("quick_scans")
      .update({
        invited_email: normalizedEmail,
        invited_at: new Date().toISOString(),
      })
      .eq("id", scan_id);

    if (updateScanError) {
      console.error("Error updating quick_scans:", updateScanError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update scan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call create_pending_profile RPC (idempotent)
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      "create_pending_profile",
      {
        p_scan_id: scan_id,
        p_email: normalizedEmail,
      }
    );

    if (rpcError) {
      console.error("Error calling create_pending_profile:", rpcError);
      return new Response(
        JSON.stringify({ success: false, error: `RPC failed: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rpcResult?.success) {
      console.error("RPC returned non-success:", rpcResult);
      return new Response(
        JSON.stringify({ success: false, error: rpcResult?.error ?? "RPC failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = rpcResult.profile_id as string;
    const isExisting = rpcResult.existing === true;

    // Derive ORIGIN for magic link redirect
    const siteUrl = Deno.env.get("SITE_URL");
    const origin =
      siteUrl ||
      req.headers.get("origin") ||
      "https://app.vanyshr.com";

    // Build redirectTo URL with profile_id and next path
    const redirectTo = `${origin}/auth/callback?profile_id=${profileId}&next=${encodeURIComponent(
      `/quick-scan/pre-profile/${scan_id}`
    )}`;

    // Generate magic link via Supabase admin API
    const { data: linkData, error: linkError } =
      await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: {
          redirectTo,
          data: {
            profile_id: profileId,
            source_quick_scan_id: scan_id,
            flow: "admin_invite",
          },
        },
      });

    if (linkError) {
      console.error("Error generating magic link:", linkError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to generate link: ${linkError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profileId,
        message: "Invite sent",
        existing: isExisting,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-send-invite error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
