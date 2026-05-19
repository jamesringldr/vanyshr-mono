/**
 * admin-send-invite — Send concierge invite email via Resend (not Supabase Auth).
 *
 * Env:
 *   ADMIN_PARSE_SECRET      — x-admin-secret header
 *   RESEND_INVITE_API_KEY   — Resend API key (no-reply domain)
 *   INVITE_FROM_EMAIL       — e.g. "Vanyshr <no-reply@vanyshr.com>"
 *   SITE_URL                — e.g. https://app.vanyshr.com
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

function inviteEmailHtml(firstName: string, inviteUrl: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #022136; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>${greeting}</p>
  <p>Your Vanyshr privacy report is ready. We scanned public data brokers and compiled what we found about your online exposure.</p>
  <p style="margin: 28px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background: #00BFFF; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 24px; border-radius: 12px;">View your invite</a>
  </p>
  <p style="font-size: 13px; color: #7A92A8;">This link is personal to you. If you did not expect this email, you can ignore it.</p>
  <p style="font-size: 13px; color: #7A92A8;">— The Vanyshr Team</p>
</body>
</html>`;
}

async function sendInviteEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_INVITE_API_KEY") ?? Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITE_FROM_EMAIL");

  if (!apiKey) {
    throw new Error("RESEND_INVITE_API_KEY is not configured");
  }
  if (!from) {
    throw new Error("INVITE_FROM_EMAIL is not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get("ADMIN_PARSE_SECRET");
    if (adminSecret) {
      const provided = req.headers.get("x-admin-secret");
      if (provided !== adminSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const body: AdminSendInviteRequest = await req.json();
    const { scan_id, email } = body;

    if (!scan_id || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "scan_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: scan, error: scanError } = await supabaseClient
      .from("quick_scans")
      .select("id, source, profile_data, search_input, converted_to_user_id")
      .eq("id", scan_id)
      .maybeSingle();

    if (scanError) {
      console.error("Error fetching scan:", scanError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch scan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!scan) {
      return new Response(
        JSON.stringify({ success: false, error: "Scan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (scan.source !== "invite") {
      return new Response(
        JSON.stringify({ success: false, error: "Scan is not an invite scan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!scan.profile_data) {
      return new Response(
        JSON.stringify({ success: false, error: "Scan has no profile_data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updateScanError } = await supabaseClient
      .from("quick_scans")
      .update({ email: normalizedEmail })
      .eq("id", scan_id);

    if (updateScanError) {
      console.error("Error updating quick_scans.email:", updateScanError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update scan email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (scan.converted_to_user_id) {
      const { error: profileError } = await supabaseClient
        .from("user_profiles")
        .update({ email: normalizedEmail })
        .eq("id", scan.converted_to_user_id);

      if (profileError) {
        console.error("Error updating user_profiles.email:", profileError);
      }
    }

    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://app.vanyshr.com").replace(/\/$/, "");
    const inviteUrl = `${siteUrl}/invite?id=${scan_id}`;
    const searchInput = scan.search_input as { first_name?: string } | null;
    const firstName = searchInput?.first_name?.trim() ?? "";

    await sendInviteEmail(
      normalizedEmail,
      "You've been invited to Vanyshr",
      inviteEmailHtml(firstName, inviteUrl),
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invite sent",
        invite_url: inviteUrl,
        email: normalizedEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-send-invite error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
